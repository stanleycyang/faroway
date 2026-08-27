import Link from "next/link";
import Image from "next/image";
import type { BlogPostMeta } from "@/lib/blog/types";

export function FeaturedHero({ post }: { post: BlogPostMeta }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[21/9] md:aspect-[2.5/1]">
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="100vw"
            priority
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="glass-card rounded-2xl p-6 md:p-8 max-w-2xl glow-shadow">
            <div className="flex items-center gap-3 text-sm mb-4">
              <span className="px-3 py-1 bg-gradient-to-r from-primary to-amber-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-primary/25">
                Featured
              </span>
              <span className="text-primary-light font-medium">
                {post.category}
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-100 mb-3 leading-tight">
              {post.title}
            </h2>
            <p className="text-gray-400 text-base md:text-lg line-clamp-2 mb-4">
              {post.description}
            </p>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{post.author.name}</span>
              <span className="text-gray-600">·</span>
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span className="text-gray-600">·</span>
              <span>{post.readingTime} min read</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
