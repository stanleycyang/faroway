import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogIndexWindow, getAllPostMetas, parsePageParam } from "@/lib/blog";
import { withBlogFallback } from "@/lib/blog/availability";
import { BlogCard } from "@/components/blog/BlogCard";
import { FeaturedHero } from "@/components/blog/FeaturedHero";
import { CategoryPills } from "@/components/blog/CategoryPills";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { Pagination } from "@/components/blog/Pagination";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

// Pagination and database failures must set the real status code. The blog
// layout is ISR, and a static shell would turn an outage into a 200.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const page = parsePageParam(pageParam);
  if (page == null) notFound();
  const allPosts = await withBlogFallback(() => getAllPostMetas(), []);
  if (blogIndexWindow(allPosts, page).outOfRange) notFound();
  const canonical = page > 1 ? `/blog?page=${page}` : "/blog";
  const pageLabel = page > 1 ? ` — Page ${page}` : "";
  return {
    title: `Travel Blog — Tips, Guides & Inspiration${pageLabel}`,
    description:
      "Expert travel tips, destination guides, budget hacks, and AI-powered planning advice. Everything you need to plan your next adventure.",
    alternates: { canonical },
    openGraph: {
      title: `Faroway Travel Blog — Tips, Guides & Inspiration${pageLabel}`,
      description:
        "Expert travel tips, destination guides, and AI-powered planning advice.",
      type: "website",
      url: canonical,
    },
  };
}

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = parsePageParam(pageParam);
  if (requestedPage == null) notFound();
  const allPosts = await withBlogFallback(() => getAllPostMetas(), []);
  const { featured, posts, totalPages, currentPage, outOfRange } =
    blogIndexWindow(allPosts, requestedPage);
  if (outOfRange) notFound();
  const categories = [...new Set(allPosts.map((post) => post.category))];
  const isFirstPage = currentPage === 1;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Faroway Travel Blog",
    description:
      "Expert travel tips, destination guides, budget hacks, and AI-powered planning advice.",
    url: `${baseUrl}/blog`,
    isPartOf: { "@type": "WebSite", name: "Faroway", url: baseUrl },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${baseUrl}/blog`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([collectionSchema, breadcrumbSchema]).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      {/* Hero */}
      <section className="container mx-auto px-6 max-w-7xl pt-8 pb-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Travel Blog
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Expert tips, destination guides, and insights to help you travel
            smarter with AI.
          </p>
        </div>

        {/* Category Filters */}
        <div className="mb-10">
          <CategoryPills categories={categories} />
        </div>

        {/* Featured Post — only on page 1 */}
        {isFirstPage && featured && <FeaturedHero post={featured} />}
      </section>

      {/* Post Grid */}
      <section className="container mx-auto px-6 max-w-7xl py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            {isFirstPage ? "Latest Articles" : `Page ${currentPage}`}
          </h2>
          {totalPages > 1 && (
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <BlogCard key={post.slug} post={post} eager={index < 3} />
          ))}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/blog"
        />
      </section>

      {/* Newsletter — only on last page or single page */}
      {(currentPage === totalPages || totalPages <= 1) && (
        <div className="container mx-auto px-6 max-w-4xl">
          <NewsletterCTA />
        </div>
      )}
    </main>
  );
}
