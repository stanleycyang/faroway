import { BlogPost, BlogPostMeta, AUTHORS, PaginatedResult } from './types';
import { CLUSTERS, getClusterBySlug, getAllClusterSlugs, getRelatedClusters } from './clusters';
import type { ClusterDefinition } from './clusters';
import { IMAGE_PATHS, getImageUrl } from '@tripgenie/constants';
import { getBlogSupabase } from './supabase';

// ---------------------------------------------------------------------------
// Column selections — avoid fetching `content` on listing queries
// ---------------------------------------------------------------------------

const META_COLUMNS =
  'slug, title, description, author_slug, category, tags, cover_image, cover_image_alt, reading_time, featured, cluster, published_at, last_updated, view_count';

const FULL_COLUMNS = `${META_COLUMNS}, content`;

// ---------------------------------------------------------------------------
// Row → type mappers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMeta(row: any): BlogPostMeta {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    date: row.published_at || new Date().toISOString(),
    lastUpdated: row.last_updated || undefined,
    author: AUTHORS[row.author_slug] || AUTHORS['tripgenie-team'],
    category: row.category || 'Travel Tips',
    tags: row.tags || [],
    coverImage: row.cover_image || getImageUrl(IMAGE_PATHS.blog.defaultFallback),
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
    content: row.content || '',
  };
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

export async function getAllPostMetas(): Promise<BlogPostMeta[]> {
  const { data, error } = await getBlogSupabase()
    .from('blog_posts')
    .select(META_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('getAllPostMetas error:', error.message);
    return [];
  }
  return (data || []).map(rowToMeta);
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const { data, error } = await getBlogSupabase()
    .from('blog_posts')
    .select(FULL_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('getAllPosts error:', error.message);
    return [];
  }
  return (data || []).map(rowToPost);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await getBlogSupabase()
    .from('blog_posts')
    .select(FULL_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return null;
  return rowToPost(data);
}

// ---------------------------------------------------------------------------
// Derived async helpers
// ---------------------------------------------------------------------------

export async function getPostsByCategory(category: string): Promise<BlogPostMeta[]> {
  const all = await getAllPostMetas();
  return all.filter(
    (p) => p.category.toLowerCase().replace(/\s+/g, '-') === category.toLowerCase(),
  );
}

export async function getRelatedPosts(slug: string, limit = 3): Promise<BlogPostMeta[]> {
  const post = await getPostBySlug(slug);
  if (!post) return [];

  const all = (await getAllPostMetas()).filter((p) => p.slug !== slug);

  const scored = all.map((p) => {
    let score = 0;
    if (p.category === post.category) score += 2;
    score += p.tags.filter((t) => post.tags.includes(t)).length;
    return { ...p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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

export async function getPostsByCluster(clusterSlug: string): Promise<BlogPostMeta[]> {
  const cluster = getClusterBySlug(clusterSlug);
  if (!cluster) return [];

  const allPosts = await getAllPostMetas();

  return allPosts.filter((post) => {
    if (post.cluster === clusterSlug) return true;
    if (cluster.matchCategories.some((cat) => post.category === cat)) return true;
    const postTagsLower = post.tags.map((t) => t.toLowerCase());
    if (cluster.matchTags.some((tag) => postTagsLower.includes(tag.toLowerCase()))) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Pagination (pure, synchronous — no change)
// ---------------------------------------------------------------------------

export const POSTS_PER_PAGE = 9;

export function paginate<T>(items: T[], page: number, pageSize: number = POSTS_PER_PAGE): PaginatedResult<T> {
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

export { type BlogPost, type BlogPostMeta, type Author, type PaginatedResult } from './types';
export { AUTHORS, CATEGORIES } from './types';
export { CLUSTERS, getClusterBySlug, getAllClusterSlugs, getRelatedClusters } from './clusters';
export type { ClusterDefinition } from './clusters';
