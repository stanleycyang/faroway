import { expect, it, vi } from "vitest";
import { getAllPostMetas } from "@/lib/blog";
import { getBlogCategoryPage } from "@/lib/blog/pages";
import sitemap from "@/app/sitemap";

const state = vi.hoisted(() => ({
  rows: [
    {
      slug: "old-story",
      category: "Travel Tips",
      published_at: "2026-10-01T00:00:00Z",
    },
  ],
}));

// Retain a successful cached snapshot instead of the identity cache mock used
// by query tests. A fresh sitemap read can observe a newer publication.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => {
    let value: Promise<unknown> | undefined;
    return () => (value ??= fn());
  },
}));
vi.mock("@/lib/blog/supabase", () => ({
  getBlogSupabase: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: () => Promise.resolve({ data: [...state.rows], error: null }),
      };
      return query;
    },
  }),
}));

it("advertises only categories the cached category route can resolve", async () => {
  await getAllPostMetas();
  state.rows.push({
    slug: "new-story",
    category: "New Category",
    published_at: "2026-10-02T00:00:00Z",
  });
  const urls = (await sitemap()).map(({ url }) => url);
  expect(urls).toContain("https://www.faroway.ai/blog/new-story");
  expect(urls).toContain("https://www.faroway.ai/blog/category/travel-tips");
  expect(urls).not.toContain(
    "https://www.faroway.ai/blog/category/new-category",
  );
  await expect(
    getBlogCategoryPage("travel-tips", undefined),
  ).resolves.toMatchObject({ label: "Travel Tips" });
  await expect(getBlogCategoryPage("new-category", undefined)).rejects.toThrow(
    "NEXT_HTTP_ERROR_FALLBACK;404",
  );
});
