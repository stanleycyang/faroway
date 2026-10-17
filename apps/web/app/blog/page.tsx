import Link from "next/link";
import type { Metadata } from "next";
import { getBlogIndexPage } from "@/lib/blog/pages";
import { BlogCard } from "@/components/blog/BlogCard";
import { FeaturedHero } from "@/components/blog/FeaturedHero";
import { CategoryPills } from "@/components/blog/CategoryPills";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { Pagination } from "@/components/blog/Pagination";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const { page } = await getBlogIndexPage(pageParam);
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
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page: pageParam } = await searchParams;
  const {
    allPosts,
    featured,
    items: posts,
    totalPages,
    page: currentPage,
  } = await getBlogIndexPage(pageParam);
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
          <h1 className="font-editorial text-4xl md:text-5xl text-slate-900 mb-4">
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
      {posts.length > 0 && (
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
      )}

      {allPosts.length === 0 && (
        <section
          aria-label="Journal updates"
          className="mx-auto max-w-xl px-6 py-16 text-center"
        >
          <h2 className="font-editorial text-3xl text-slate-900">
            The next story is on its way.
          </h2>
          <p className="mt-4 text-slate-600">
            Explore our destination guides while we prepare more travel stories.
          </p>
          <Link
            href="/destinations"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Explore destinations
          </Link>
        </section>
      )}

      {/* Newsletter — only on last page or single page */}
      {(currentPage === totalPages || totalPages <= 1) && (
        <div className="container mx-auto px-6 max-w-4xl">
          <NewsletterCTA />
        </div>
      )}
    </main>
  );
}
