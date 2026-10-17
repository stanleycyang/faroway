import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBlogSupabase } from "@/lib/blog/supabase";
import {
  getAllPostMetas,
  getAllSitemapPostMetas,
  getPostsByCategory,
} from "@/lib/blog";
import sitemap from "@/app/sitemap";
import { GET as feed } from "@/app/blog/feed.xml/route";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { getCostProfile } from "@/lib/tools/cost-data";
import { getVisaInfoForDestination } from "@/lib/tools/visa-data";
import { JOURNAL_COVER_FALLBACK } from "@/lib/blog/fallback-image";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/blog/supabase", () => ({ getBlogSupabase: vi.fn() }));

const rows = Array.from({ length: 1001 }, (_, i) => ({
  slug: `post-${String(i).padStart(4, "0")}`,
  title: `Story ${i}`,
  description: "Travel & food <tips>",
  published_at: "2026-10-01T00:00:00Z",
  category: i === 1000 ? "Long Tail" : "Travel Tips",
  tags: [],
}));
let ranges: number[][];
let orders: string[][];

beforeEach(() => {
  ranges = [];
  orders = [];
  let requests = 0;
  vi.mocked(getBlogSupabase).mockReturnValue({
    from: () => {
      const order: string[] = [];
      orders.push(order);
      const read = (from: number, to: number) => {
        ranges.push([from, to]);
        // Equal timestamps may come back in different orders on each request.
        const data =
          !order.includes("slug") && requests++ % 2
            ? [...rows].reverse()
            : rows;
        return Promise.resolve({ data: data.slice(from, to + 1), error: null });
      };
      const query = {
        select: () => query,
        eq: () => query,
        order: (column: string) => {
          order.push(column);
          return query;
        },
        range: read,
        limit: (limit: number) => read(0, limit - 1),
      };
      return query;
    },
  } as unknown as ReturnType<typeof getBlogSupabase>);
});

describe("published discovery across the 1000-row boundary", () => {
  it.each([getAllPostMetas, getAllSitemapPostMetas])(
    "reads every row once in a deterministic order",
    async (read) => {
      const posts = await read();
      expect(posts.map((p) => p.slug)).toEqual(rows.map((p) => p.slug));
      expect(new Set(posts.map((p) => p.slug)).size).toBe(1001);
      expect(ranges).toEqual([
        [0, 999],
        [1000, 1999],
      ]);
      expect(orders).toEqual([
        ["published_at", "slug"],
        ["published_at", "slug"],
      ]);
      expect(posts[0].coverImage).toBe(JOURNAL_COVER_FALLBACK);
    },
  );

  it("keeps the long-tail article discoverable by category, sitemap and RSS", async () => {
    expect((await getPostsByCategory("long-tail")).map((p) => p.slug)).toEqual([
      "post-1000",
    ]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://www.faroway.ai/blog/post-1000");
    expect(urls).toContain("https://www.faroway.ai/blog/category/long-tail");
    const xml = await (await feed()).text();
    expect(xml.match(/<item>/g)).toHaveLength(1001);
    expect(xml).toContain("https://www.faroway.ai/blog/post-1000");
    expect(xml).toContain("Travel &amp; food &lt;tips&gt;");
  });

  it("generates only destination/tool sitemap URLs backed by local data", async () => {
    for (const slug of getGuideSlugs())
      expect(getGuideBySlug(slug)).toBeDefined();
    for (const { url } of await sitemap()) {
      const path = new URL(url).pathname;
      const slug = path.split("/").at(-1)!;
      if (path.startsWith("/destinations/"))
        expect(getGuideBySlug(slug)).toBeDefined();
      if (path.startsWith("/tools/best-time-to-visit/"))
        expect(getClimateData(slug)).toBeDefined();
      if (path.startsWith("/tools/trip-cost/"))
        expect(getCostProfile(slug)).toBeDefined();
      if (path.startsWith("/tools/visa-checker/"))
        expect(getVisaInfoForDestination(slug).length).toBeGreaterThan(0);
    }
  });
});
