import { cache } from "react";
import { notFound } from "next/navigation";
import { getAllPostMetas, paginate, POSTS_PER_PAGE } from "./index";

/** Reject ambiguous/repeated, malformed and unsafe page numbers. */
export function parsePageParam(
  raw: string | string[] | undefined,
): number | null {
  if (raw === undefined || raw === "") return 1;
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : null;
}

export const getBlogIndexPage = cache(
  async (raw: string | string[] | undefined) => {
    const page = parsePageParam(raw);
    if (page === null) notFound();
    const allPosts = await getAllPostMetas();
    const featured = allPosts.find((post) => post.featured) || allPosts[0];
    // Every page slices the same set. The hero appears only on the first page.
    const grid = allPosts.filter((post) => post.slug !== featured?.slug);
    if (page > Math.max(1, Math.ceil(grid.length / POSTS_PER_PAGE))) notFound();
    return { ...paginate(grid, page), featured, allPosts };
  },
);

export const getBlogCategoryPage = cache(
  async (category: string, raw: string | string[] | undefined) => {
    const page = parsePageParam(raw);
    if (page === null) notFound();
    const allPosts = await getAllPostMetas();
    const categories = [...new Set(allPosts.map((post) => post.category))];
    const label = categories.find(
      (value) => value.toLowerCase().replace(/\s+/g, "-") === category,
    );
    if (!label) notFound();
    const posts = allPosts.filter(
      (post) => post.category.toLowerCase().replace(/\s+/g, "-") === category,
    );
    if (page > Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE)))
      notFound();
    return { ...paginate(posts, page), label, categories };
  },
);
