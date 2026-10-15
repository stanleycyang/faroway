import { cache } from "react";
import { unstable_cache } from "next/cache";
import { BlogPost, BlogPostMeta, AUTHORS, PaginatedResult } from "./types";
import { getClusterBySlug } from "./clusters";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { getBlogSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Column selections — avoid fetching `content` on listing queries
// ---------------------------------------------------------------------------

const META_COLUMNS_BASE =
  "slug, title, description, author_slug, category, tags, cover_image, cover_image_alt, reading_time, featured, cluster, published_at, last_updated, view_count";

const META_COLUMNS = `${META_COLUMNS_BASE}, noindex`;
const FULL_COLUMNS = `${META_COLUMNS}, content`;
const LEGACY_META_COLUMNS = META_COLUMNS_BASE;
const LEGACY_FULL_COLUMNS = `${META_COLUMNS_BASE}, content`;

type QueryError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/** True only for "column noindex does not exist" — not for outages. */
function isMissingNoindexColumn(error: QueryError): boolean {
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  return (
    /noindex/i.test(text) &&
    /(42703|PGRST204|does not exist|schema cache|could not find)/i.test(text)
  );
}

/**
 * Prefer queries that read `noindex`. If this database has not applied the
 * column yet, retry once without it so listings keep working (everything
 * stays indexable, which matches the column default of false).
 */
async function readBlogRows<T>(
  label: string,
  run: (
    columns: string,
    excludeNoindex: boolean,
  ) => PromiseLike<{ data: T | null; error: QueryError | null }>,
  columns: { withNoindex: string; withoutNoindex: string },
  excludeNoindex: boolean,
): Promise<T | null> {
  const first = await run(columns.withNoindex, excludeNoindex);
  if (!first.error) return first.data;

  if (isMissingNoindexColumn(first.error)) {
    const second = await run(columns.withoutNoindex, false);
    if (!second.error) return second.data;
    throw new Error(`${label} failed (${second.error.code || "unknown"})`);
  }

  throw new Error(`${label} failed (${first.error.code || "unknown"})`);
}

// ---------------------------------------------------------------------------
// Row → type mappers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMeta(row: any): BlogPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    date: row.published_at || new Date().toISOString(),
    noindex: row.noindex === true,
    lastUpdated: row.last_updated || undefined,
    author: AUTHORS[row.author_slug] || AUTHORS["faroway-team"],
    category: row.category || "Travel Tips",
    tags: row.tags || [],
    coverImage:
      row.cover_image || getImageUrl(IMAGE_PATHS.blog.defaultFallback),
    coverImageAlt: row.cover_image_alt || row.title,
    readingTime: row.reading_time || 5,
    featured: row.featured || false,
    cluster: row.cluster || undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPost(row: any): BlogPost {
  return {
    ...rowToMeta(row),
    content: row.content || "",
  };
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

function publishedPosts(
  supabase: NonNullable<ReturnType<typeof getBlogSupabase>>,
  columns: string,
  excludeNoindex: boolean,
) {
  const query = supabase
    .from("blog_posts")
    .select(columns)
    .eq("status", "published");
  return excludeNoindex ? query.eq("noindex", false) : query;
}

const getCachedPostMetas = unstable_cache(
  async (): Promise<BlogPostMeta[]> => {
    const supabase = getBlogSupabase();
    if (!supabase) throw new Error("Blog database is not configured");

    // Listing surfaces (index, categories, related posts, destination hubs)
    // only see indexable posts. The 1000 cap applies after that filter so
    // flagged posts don't crowd them out.
    const data = await readBlogRows(
      "getAllPostMetas",
      (columns, excludeNoindex) =>
        publishedPosts(supabase, columns, excludeNoindex)
          .order("published_at", { ascending: false })
          .limit(1000),
      { withNoindex: META_COLUMNS, withoutNoindex: LEGACY_META_COLUMNS },
      true,
    );

    return (data || []).map(rowToMeta).filter((post) => !post.noindex);
  },
  [
    "published-blog-metadata-v2",
    process.env.NEXT_PUBLIC_SUPABASE_URL || "unconfigured",
  ],
  {
    revalidate: 21600,
    tags: ["published-blog-metadata"],
  },
);

// React cache deduplicates within a render; the Data Cache reuses public rows
// across listing, category, guide, and related-post requests.
export const getAllPostMetas = cache(getCachedPostMetas);

/**
 * Fetch every published post for sitemap discovery. Listing pages intentionally
 * cap their working set, but the sitemap must not silently omit long-tail posts.
 */
export async function getAllSitemapPostMetas(): Promise<BlogPostMeta[]> {
  const supabase = getBlogSupabase();
  if (!supabase) throw new Error("Blog database is not configured");

  const posts: BlogPostMeta[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const data = await readBlogRows(
      "getAllSitemapPostMetas",
      (columns, excludeNoindex) =>
        publishedPosts(supabase, columns, excludeNoindex)
          .order("published_at", { ascending: false })
          .range(from, from + pageSize - 1),
      { withNoindex: META_COLUMNS, withoutNoindex: LEGACY_META_COLUMNS },
      true,
    );

    const page = (data || []).map(rowToMeta).filter((post) => !post.noindex);
    posts.push(...page);
    if (!data || data.length < pageSize) break;
  }

  return posts;
}

export const getAllPosts = cache(async (): Promise<BlogPost[]> => {
  const supabase = getBlogSupabase();
  if (!supabase) throw new Error("Blog database is not configured");

  // Includes noindex posts so their URLs can still be rendered (HTTP 200).
  // Callers that build public lists (RSS) filter the flag themselves.
  const data = await readBlogRows(
    "getAllPosts",
    (columns) =>
      publishedPosts(supabase, columns, false)
        .order("published_at", { ascending: false })
        .limit(1000),
    { withNoindex: FULL_COLUMNS, withoutNoindex: LEGACY_FULL_COLUMNS },
    false,
  );
  return (data || []).map(rowToPost);
});

export const getPostBySlug = cache(
  async (slug: string): Promise<BlogPost | null> => {
    const supabase = getBlogSupabase();
    if (!supabase) throw new Error("Blog database is not configured");

    // Do not filter noindex: a flagged post stays on its slug and returns 200.
    const data = await readBlogRows(
      "getPostBySlug",
      (columns) =>
        supabase
          .from("blog_posts")
          .select(columns)
          .eq("slug", slug)
          .eq("status", "published")
          .maybeSingle(),
      { withNoindex: FULL_COLUMNS, withoutNoindex: LEGACY_FULL_COLUMNS },
      false,
    );

    if (!data) return null;
    return rowToPost(data);
  },
);

// ---------------------------------------------------------------------------
// Derived async helpers
// ---------------------------------------------------------------------------

export async function getPostsByCategory(
  category: string,
): Promise<BlogPostMeta[]> {
  const all = await getAllPostMetas();
  return all.filter(
    (p) =>
      !p.noindex &&
      p.category.toLowerCase().replace(/\s+/g, "-") === category.toLowerCase(),
  );
}

export async function getRelatedPosts(
  slug: string,
  limit = 3,
): Promise<BlogPostMeta[]> {
  const [post, postMetas] = await Promise.all([
    getPostBySlug(slug),
    getAllPostMetas(),
  ]);
  if (!post) return [];

  const all = postMetas.filter((p) => p.slug !== slug && !p.noindex);

  const scored = all.map((p) => {
    let score = 0;
    if (p.category === post.category) score += 2;
    score += p.tags.filter((t) => post.tags.includes(t)).length;
    return { ...p, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getAllCategories(): Promise<string[]> {
  const posts = await getAllPostMetas();
  return [...new Set(posts.map((p) => p.category))];
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPostMetas();
  return [...new Set(posts.flatMap((p) => p.tags))];
}

export async function getFeaturedPost(): Promise<BlogPostMeta | undefined> {
  const posts = await getAllPostMetas();
  const visible = posts.filter((p) => !p.noindex);
  return visible.find((p) => p.featured) || visible[0];
}

export async function getPostsByCluster(
  clusterSlug: string,
): Promise<BlogPostMeta[]> {
  const cluster = getClusterBySlug(clusterSlug);
  if (!cluster) return [];

  const allPosts = (await getAllPostMetas()).filter((p) => !p.noindex);

  return allPosts.filter((post) => {
    if (post.cluster === clusterSlug) return true;
    if (cluster.matchCategories.some((cat) => post.category === cat))
      return true;
    const postTagsLower = post.tags.map((t) => t.toLowerCase());
    if (
      cluster.matchTags.some((tag) => postTagsLower.includes(tag.toLowerCase()))
    )
      return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Pagination (pure, synchronous — no change)
// ---------------------------------------------------------------------------

// Increase listing density to surface more content per click depth
export const POSTS_PER_PAGE = 24;

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = POSTS_PER_PAGE,
): PaginatedResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export {
  type BlogPost,
  type BlogPostMeta,
  type Author,
  type PaginatedResult,
} from "./types";
export { AUTHORS, CATEGORIES } from "./types";
export {
  CLUSTERS,
  getClusterBySlug,
  getAllClusterSlugs,
  getRelatedClusters,
} from "./clusters";
export type { ClusterDefinition } from "./clusters";
