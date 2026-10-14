import Link from "next/link";
import { JournalImage } from "./JournalImage";
import type { BlogPostMeta } from "@/lib/blog/types";

export function FeaturedHero({ post }: { post: BlogPostMeta }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-[#f5f7f8]">
      <Link
        href={`/blog/${post.slug}`}
        className="group grid md:grid-cols-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
      >
        <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-96">
          <JournalImage
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>
        <div className="flex flex-col justify-center px-6 py-8 sm:p-10">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            Featured story · {post.category}
          </p>
          <h2 className="font-editorial text-3xl leading-tight text-slate-900 lg:text-4xl">
            {post.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {post.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
            <span>{post.author.name}</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            <span>{post.readingTime} min read</span>
          </div>
          <span className="mt-7 text-sm font-semibold text-slate-900">
            Read the story <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
