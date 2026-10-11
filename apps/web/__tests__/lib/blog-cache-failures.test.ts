import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBlogSupabase } from "@/lib/blog/supabase";
import {
  getAllPostMetas,
  getAllPosts,
  getAllSitemapPostMetas,
  getPostBySlug,
} from "@/lib/blog";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

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

  it("never returns a partial sitemap when a later page fails", async () => {
    query.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 1000 }, (_, i) => ({
          ...row,
          slug: `post-${i}`,
        })),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "503" } });
    await expect(getAllSitemapPostMetas()).rejects.toThrow("503");
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

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
});
