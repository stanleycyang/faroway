import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPostMetas, type BlogPostMeta } from "@/lib/blog";
import {
  getBlogCategoryPage,
  getBlogIndexPage,
  parsePageParam,
} from "@/lib/blog/pages";

vi.mock("@/lib/blog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/blog")>()),
  getAllPostMetas: vi.fn(),
}));

const posts = Array.from({ length: 20 }, (_, i) => ({
  slug: `post-${i}`,
  featured: i === 5,
  category: "Travel Tips",
})) as BlogPostMeta[];

beforeEach(() => {
  vi.mocked(getAllPostMetas).mockReset().mockResolvedValue(posts);
});

describe("blog route pagination", () => {
  it.each([undefined, ""])(
    "defaults an absent/empty page to one: %s",
    (raw) => {
      expect(parsePageParam(raw)).toBe(1);
    },
  );
  it.each([
    "0",
    "-1",
    "01",
    "2abc",
    "1.5",
    "1e2",
    " 2",
    "NaN",
    "9007199254740992",
    ["1", "2"],
  ])("rejects invalid page values: %s", (raw) =>
    expect(parsePageParam(raw)).toBeNull(),
  );
  it("returns each article exactly once across the hero and every page", async () => {
    const pages = await Promise.all(["1", "2", "3"].map(getBlogIndexPage));
    const slugs = [
      pages[0].featured.slug,
      ...pages.flatMap((page) => page.items.map((post) => post.slug)),
    ];
    expect(slugs).toHaveLength(20);
    expect(new Set(slugs)).toEqual(new Set(posts.map((post) => post.slug)));
    expect(pages.map((page) => page.totalPages)).toEqual([3, 3, 3]);
  });
  it("uses the first article as the hero when none is featured", async () => {
    vi.mocked(getAllPostMetas).mockResolvedValue(
      posts.map((post) => ({ ...post, featured: false })),
    );
    const page = await getBlogIndexPage(undefined);
    expect(page.featured.slug).toBe("post-0");
    expect(page.items[0].slug).toBe("post-1");
  });
  it("keeps a successful empty journal on page one and rejects later pages", async () => {
    vi.mocked(getAllPostMetas).mockResolvedValue([]);
    expect((await getBlogIndexPage(undefined)).items).toEqual([]);
    await expect(getBlogIndexPage("2")).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
  it.each(["4", "2abc", ["1", "2"]])(
    "returns 404 rather than clamping index page %s",
    async (raw) => {
      await expect(getBlogIndexPage(raw)).rejects.toThrow(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
    },
  );
  it("validates categories and their page range", async () => {
    expect((await getBlogCategoryPage("travel-tips", "3")).items).toHaveLength(
      2,
    );
    await expect(getBlogCategoryPage("missing", undefined)).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    await expect(getBlogCategoryPage("travel-tips", "4")).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
  it("propagates outages to metadata and page callers", async () => {
    vi.mocked(getAllPostMetas).mockRejectedValue(
      new Error("backend unavailable"),
    );
    await expect(getBlogIndexPage(undefined)).rejects.toThrow(
      "backend unavailable",
    );
    await expect(getBlogCategoryPage("travel-tips", undefined)).rejects.toThrow(
      "backend unavailable",
    );
  });
});
