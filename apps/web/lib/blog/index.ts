import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { cache } from "react";
import { JOURNAL_COVER_FALLBACK } from "./fallback-image";
import { unstable_cache } from "next/cache";
import { BlogPost, BlogPostMeta, AUTHORS, PaginatedResult } from "./types";
import { getClusterBySlug } from "./clusters";
import { getBlogSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Column selections — avoid fetching `content` on listing queries
// ---------------------------------------------------------------------------

const META_COLUMNS =
  "slug, title, description, author_slug, category, tags, cover_image, cover_image_alt, reading_time, featured, cluster, published_at, last_updated, view_count";

const FULL_COLUMNS = `${META_COLUMNS}, content`;

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
    lastUpdated: row.last_updated || undefined,
    author: AUTHORS[row.author_slug] || AUTHORS["faroway-team"],
    category: row.category || "Travel Tips",
    tags: row.tags || [],
    coverImage: row.cover_image || JOURNAL_COVER_FALLBACK,
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

/** Transport failure from an unreachable Supabase host, distinct from a coded outage. */
export class BlogDatabaseUnreachableError extends Error {
  constructor(detail: string) {
    super(`Blog database is unreachable: ${detail}`);
    this.name = "BlogDatabaseUnreachableError";
  }
}

function isUnreachableSupabaseError(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const code = typeof error.code === "string" ? error.code.trim() : "";
  if (code) return false;
  return /typo in the url or port|fetch failed|enotfound|econnrefused|enetunreach|eai_again|getaddrinfo|econnreset|socket hang up|und_err|certificate|timed out|timeout|network/i.test(
    error.message ?? "",
  );
}

function isBlogDatabaseUnreachable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "BlogDatabaseUnreachableError" ||
    message.startsWith("Blog database is unreachable:")
  );
}

let warnedUnreachableDuringBuild = false;

/**
 * An empty static blog is opt-in. A production build that cannot reach
 * Supabase must fail so a transient timeout does not publish zero posts.
 * Set FAROWAY_BUILD_WITHOUT_BLOG_DB=1 only for a local build that accepts
 * that empty collection. Coded outages still throw, and the empty result
 * stays outside the Data Cache.
 */
function allowEmptyBlogCollection(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" &&
    process.env.FAROWAY_BUILD_WITHOUT_BLOG_DB === "1"
  );
}

async function publishedMetasForPageCollection(
  read: () => Promise<BlogPostMeta[]>,
): Promise<BlogPostMeta[]> {
  try {
    return await read();
  } catch (error) {
    if (allowEmptyBlogCollection() && isBlogDatabaseUnreachable(error)) {
      if (!warnedUnreachableDuringBuild) {
        warnedUnreachableDuringBuild = true;
        console.warn(
          "FAROWAY_BUILD_WITHOUT_BLOG_DB=1: Supabase is unreachable during static page collection; continuing with no published blog posts.",
        );
      }
      return [];
    }
    throw error;
  }
}

/** Read all published metadata in a total order, including the 1000-row boundary. */
async function fetchAllPostMetas(): Promise<BlogPostMeta[]> {
  const supabase = getBlogSupabase();
  if (!supabase) throw new Error("Blog database is not configured");

  const posts: BlogPostMeta[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(META_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      // slug is unique; equal publication timestamps must not shuffle pages.
      .order("slug", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      if (isUnreachableSupabaseError(error)) {
        throw new BlogDatabaseUnreachableError(
          error.message || "network error",
        );
      }
      throw new Error(`getAllPostMetas failed (${error.code || "unknown"})`);
    }
    posts.push(...(data || []).map(rowToMeta));
    if (!data || data.length < pageSize) break;
  }
  return posts;
}

const compress = promisify(gzip);
const decompress = promisify(gunzip);

// Keep one coherent catalog snapshot while staying below the Data Cache's
// per-entry limit. Repeated author metadata otherwise pushes 3,000 posts over 2 MB.
const getCachedPostMetas = unstable_cache(
  async () =>
    (await compress(JSON.stringify(await fetchAllPostMetas()))).toString(
      "base64",
    ),
  [
    "published-blog-metadata-gzip-v4",
    process.env.NEXT_PUBLIC_SUPABASE_URL || "unconfigured",
  ],
  { revalidate: 21600, tags: ["published-blog-metadata"] },
);

// React cache deduplicates within a render; the Data Cache reuses public rows
// across listing, category, guide, related-post and feed requests.
export const getAllPostMetas = cache(() =>
  publishedMetasForPageCollection(async () => {
    const encoded = await getCachedPostMetas();
    return JSON.parse(
      (await decompress(Buffer.from(encoded, "base64"))).toString("utf8"),
    ) as BlogPostMeta[];
  }),
);

// Sitemap generation reads a fresh complete set and propagates coded failures.
export const getAllSitemapPostMetas = () =>
  publishedMetasForPageCollection(fetchAllPostMetas);

export const getAllPosts = cache(async (): Promise<BlogPost[]> => {
  const supabase = getBlogSupabase();
  if (!supabase) throw new Error("Blog database is not configured");

  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`getAllPosts failed (${error.code || "unknown"})`);
  }
  return (data || []).map(rowToPost);
});

export const getPostBySlug = cache(
  async (slug: string): Promise<BlogPost | null> => {
    const supabase = getBlogSupabase();
    if (!supabase) throw new Error("Blog database is not configured");

    const { data, error } = await supabase
      .from("blog_posts")
      .select(FULL_COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    // A missing published slug is a real 404; operational failures must not
    // replace a healthy ISR page with a cached "not found" response.
    if (error) {
      throw new Error(`getPostBySlug failed (${error.code || "unknown"})`);
    }
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

  const all = postMetas.filter((p) => p.slug !== slug);

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
  return posts.find((p) => p.featured) || posts[0];
}

export async function getPostsByCluster(
  clusterSlug: string,
): Promise<BlogPostMeta[]> {
  const cluster = getClusterBySlug(clusterSlug);
  if (!cluster) return [];

  const allPosts = await getAllPostMetas();

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

export const POSTS_PER_PAGE = 9;

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
