import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBlogSupabase } from "@/lib/blog/supabase";
import {
  getAllPostMetas,
  getAllPosts,
  getAllSitemapPostMetas,
  getPostBySlug,
} from "@/lib/blog";

const cacheWrites = vi.hoisted(() => ({ values: [] as unknown[] }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => {
    const value = await fn();
    cacheWrites.values.push(value);
    return value;
  },
}));

vi.mock("@/lib/blog/supabase", () => ({ getBlogSupabase: vi.fn() }));

const row = {
  slug: "tokyo-guide",
  title: "Tokyo guide",
  published_at: "2026-10-01T00:00:00Z",
  tags: [],
  content: "Published article",
  category: "Guides",
};
const query = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  range: vi.fn(),
  maybeSingle: vi.fn(),
};
const client = { from: vi.fn(() => query) };
const readers = [getAllPostMetas, getAllPosts, getAllSitemapPostMetas];

describe("blog cache failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cacheWrites.values = [];
    client.from.mockReturnValue(query);
    for (const method of [query.select, query.eq, query.order])
      method.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [row], error: null });
    query.range.mockResolvedValue({ data: [row], error: null });
    query.maybeSingle.mockResolvedValue({ data: row, error: null });
    vi.mocked(getBlogSupabase).mockReturnValue(
      client as unknown as ReturnType<typeof getBlogSupabase>,
    );
  });

  it("stores a large catalog below the cache entry limit without losing posts", async () => {
    const pages = Array.from({ length: 3 }, (_, page) =>
      Array.from({ length: 1000 }, (_, i) => ({
        ...row,
        slug: `post-${page * 1000 + i}`,
        description: "Travel details ".repeat(100),
      })),
    );
    for (const data of pages)
      query.range.mockResolvedValueOnce({ data, error: null });
    query.range.mockResolvedValueOnce({ data: [], error: null });
    const posts = await getAllPostMetas();
    expect(posts).toHaveLength(3000);
    expect(posts[2999].slug).toBe("post-2999");
    expect(Buffer.byteLength(JSON.stringify(posts))).toBeGreaterThan(
      2 * 1024 * 1024,
    );
    expect(cacheWrites.values).toHaveLength(1);
    expect(typeof cacheWrites.values[0]).toBe("string");
    expect(
      Buffer.byteLength(JSON.stringify(cacheWrites.values[0])),
    ).toBeLessThan(2 * 1024 * 1024);
  });

  it.each(readers)(
    "propagates failures instead of caching an empty list",
    async (read) => {
      const failed = {
        data: null,
        error: { code: "503", message: "database unavailable" },
      };
      query.limit.mockResolvedValue(failed);
      query.range.mockResolvedValue(failed);
      await expect(read()).rejects.toThrow("503");
    },
  );

  it.each([getAllPostMetas, getAllSitemapPostMetas])(
    "never returns partial metadata when a later page fails",
    async (read) => {
      query.range
        .mockResolvedValueOnce({
          data: Array.from({ length: 1000 }, (_, i) => ({
            ...row,
            slug: `post-${i}`,
          })),
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: { code: "503" } });
      await expect(read()).rejects.toThrow("503");
      expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    },
  );

  it.each([getAllPostMetas, getAllSitemapPostMetas])(
    "finishes a full 1000-row page with one empty read",
    async (read) => {
      query.range
        .mockResolvedValueOnce({
          data: Array.from({ length: 1000 }, (_, i) => ({
            ...row,
            slug: `post-${i}`,
          })),
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });
      expect(await read()).toHaveLength(1000);
      expect(query.range.mock.calls).toEqual([
        [0, 999],
        [1000, 1999],
      ]);
      expect(query.order).toHaveBeenCalledWith("slug", { ascending: true });
    },
  );

  it.each(readers)(
    "returns successfully loaded published rows",
    async (read) => {
      const rows = await read();
      expect(rows).toHaveLength(1);
      expect(rows[0].slug).toBe(row.slug);
      expect(query.eq).toHaveBeenCalledWith("status", "published");
    },
  );

  it("returns null for a successful lookup with no published row", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getPostBySlug("missing")).resolves.toBeNull();
    expect(query.eq).toHaveBeenCalledWith("status", "published");
  });

  it.each(["503", "PGRST116"])(
    "does not turn a lookup error into a cached 404: %s",
    async (code) => {
      query.maybeSingle.mockResolvedValue({ data: null, error: { code } });
      await expect(getPostBySlug(row.slug)).rejects.toThrow(code);
    },
  );

  it("returns a successfully loaded article", async () => {
    await expect(getPostBySlug(row.slug)).resolves.toMatchObject({
      slug: row.slug,
      content: row.content,
    });
  });

  it.each([...readers, () => getPostBySlug(row.slug)])(
    "rejects missing configuration",
    async (read) => {
      vi.mocked(getBlogSupabase).mockReturnValue(null);
      await expect(read()).rejects.toThrow("not configured");
    },
  );

  it("does not treat an unreachable host as an empty cached list", async () => {
    const unreachable = {
      data: null,
      error: {
        code: "",
        message: "Error: Was there a typo in the url or port?",
      },
    };
    query.range.mockResolvedValue(unreachable);
    query.limit.mockResolvedValue(unreachable);
    await expect(getAllPostMetas()).rejects.toThrow("unreachable");
    await expect(getAllSitemapPostMetas()).rejects.toThrow("unreachable");
    await expect(getAllPosts()).rejects.toThrow("getAllPosts failed (unknown)");
  });

  it.each([
    {
      NEXT_PHASE: "phase-production-build",
      FAROWAY_BUILD_WITHOUT_BLOG_DB: undefined,
    },
    {
      NEXT_PHASE: "phase-production-build",
      FAROWAY_BUILD_WITHOUT_BLOG_DB: "0",
    },
    {
      NEXT_PHASE: "phase-production-build",
      FAROWAY_BUILD_WITHOUT_BLOG_DB: "true",
    },
    { NEXT_PHASE: undefined, FAROWAY_BUILD_WITHOUT_BLOG_DB: "1" },
  ])(
    "still throws when the empty-blog build flag is off ($NEXT_PHASE, $FAROWAY_BUILD_WITHOUT_BLOG_DB)",
    async (env) => {
      const previous = {
        NEXT_PHASE: process.env.NEXT_PHASE,
        FAROWAY_BUILD_WITHOUT_BLOG_DB:
          process.env.FAROWAY_BUILD_WITHOUT_BLOG_DB,
      };
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      query.range.mockResolvedValue({
        data: null,
        error: {
          code: "",
          message: "TypeError: fetch failed",
        },
      });
      try {
        await expect(getAllPostMetas()).rejects.toThrow("unreachable");
        await expect(getAllSitemapPostMetas()).rejects.toThrow("unreachable");
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    },
  );

  it("returns an empty collection only when FAROWAY_BUILD_WITHOUT_BLOG_DB=1 during the production build", async () => {
    const previous = {
      NEXT_PHASE: process.env.NEXT_PHASE,
      FAROWAY_BUILD_WITHOUT_BLOG_DB: process.env.FAROWAY_BUILD_WITHOUT_BLOG_DB,
    };
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.FAROWAY_BUILD_WITHOUT_BLOG_DB = "1";
    query.range.mockResolvedValue({
      data: null,
      error: {
        code: "",
        message: "Error: Was there a typo in the url or port?",
      },
    });
    try {
      await expect(getAllPostMetas()).resolves.toEqual([]);
      await expect(getAllSitemapPostMetas()).resolves.toEqual([]);
      query.range.mockResolvedValue({
        data: null,
        error: { code: "503", message: "database unavailable" },
      });
      await expect(getAllPostMetas()).rejects.toThrow("503");
      await expect(getAllSitemapPostMetas()).rejects.toThrow("503");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
