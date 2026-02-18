'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { BlogPostMeta } from '@/lib/blog/types';

export function BlogCard({ post }: { post: BlogPostMeta }) {
  const categorySlug = post.category.toLowerCase().replace(/\s+/g, '-');

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <Link href={`/blog/${post.slug}`} className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={post.coverImage}
          alt={post.coverImageAlt || post.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </Link>
      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-3 text-sm mb-3">
          <Link
            href={`/blog/category/${categorySlug}`}
            className="text-primary-600 font-medium hover:text-primary-800 transition-colors"
          >
            {post.category}
          </Link>
          <span className="text-gray-300">•</span>
          <time className="text-gray-400" dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </time>
        </div>
        <Link href={`/blog/${post.slug}`} className="group/title">
          <h3 className="text-lg font-bold text-gray-900 group-hover/title:text-primary-600 transition-colors line-clamp-2 mb-2">
            {post.title}
          </h3>
        </Link>
        <p className="text-gray-500 text-sm line-clamp-2 flex-1">{post.description}</p>
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="text-sm text-gray-600">{post.author.name}</span>
          <span className="text-gray-300 ml-auto">•</span>
          <span className="text-sm text-gray-400">{post.readingTime} min read</span>
        </div>
      </div>
    </article>
  );
}

export function FeaturedBlogCard({ post }: { post: BlogPostMeta }) {
  const categorySlug = post.category.toLowerCase().replace(/\s+/g, '-');

  return (
    <article className="group relative overflow-hidden rounded-3xl bg-gray-900">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[21/9] md:aspect-[3/1]">
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="flex items-center gap-3 text-sm mb-3">
            <span className="px-3 py-1 bg-primary-500 text-white rounded-full text-xs font-semibold">Featured</span>
            <Link
              href={`/blog/category/${categorySlug}`}
              className="text-gray-300 hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {post.category}
            </Link>
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 max-w-3xl">
            {post.title}
          </h2>
          <p className="text-gray-300 text-base md:text-lg max-w-2xl line-clamp-2 mb-4">{post.description}</p>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{post.author.name}</span>
            <span>•</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </time>
            <span>•</span>
            <span>{post.readingTime} min read</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
