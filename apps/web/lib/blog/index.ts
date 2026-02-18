import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { BlogPost, BlogPostMeta, AUTHORS } from './types';

const CONTENT_DIR = path.join(process.cwd(), 'content/blog');

function parseFrontmatter(slug: string): BlogPost | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const author = AUTHORS[data.author as string] || AUTHORS['tripgenie-team'];

  return {
    slug,
    title: data.title || '',
    description: data.description || '',
    date: data.date || new Date().toISOString(),
    lastUpdated: data.lastUpdated,
    author,
    category: data.category || 'Travel Tips',
    tags: data.tags || [],
    coverImage: data.coverImage || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    coverImageAlt: data.coverImageAlt || data.title,
    readingTime: data.readingTime || Math.ceil(content.split(/\s+/).length / 200),
    featured: data.featured || false,
    content,
  };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'));
  const posts = files
    .map((f) => parseFrontmatter(f.replace('.mdx', '')))
    .filter(Boolean) as BlogPost[];

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getAllPostMetas(): BlogPostMeta[] {
  return getAllPosts().map(({ content, ...meta }) => meta);
}

export function getPostBySlug(slug: string): BlogPost | null {
  return parseFrontmatter(slug);
}

export function getPostsByCategory(category: string): BlogPostMeta[] {
  return getAllPostMetas().filter(
    (p) => p.category.toLowerCase().replace(/\s+/g, '-') === category.toLowerCase()
  );
}

export function getRelatedPosts(slug: string, limit = 3): BlogPostMeta[] {
  const post = getPostBySlug(slug);
  if (!post) return [];

  const all = getAllPostMetas().filter((p) => p.slug !== slug);

  // Score by shared tags and same category
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

export function getAllCategories(): string[] {
  const posts = getAllPostMetas();
  return [...new Set(posts.map((p) => p.category))];
}

export function getAllTags(): string[] {
  const posts = getAllPostMetas();
  return [...new Set(posts.flatMap((p) => p.tags))];
}

export function getFeaturedPost(): BlogPostMeta | undefined {
  return getAllPostMetas().find((p) => p.featured) || getAllPostMetas()[0];
}

export { type BlogPost, type BlogPostMeta, type Author } from './types';
export { AUTHORS, CATEGORIES } from './types';
