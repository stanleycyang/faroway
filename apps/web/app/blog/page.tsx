import type { Metadata } from "next";
import { getAllPostMetas, paginate, POSTS_PER_PAGE } from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { FeaturedHero } from "@/components/blog/FeaturedHero";
import { CategoryPills } from "@/components/blog/CategoryPills";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { Pagination } from "@/components/blog/Pagination";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
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
  const [{ page: pageParam }, allPosts] = await Promise.all([
    searchParams,
    getAllPostMetas(),
  ]);
  const requestedPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const featured = allPosts.find((post) => post.featured) || allPosts[0];
  const categories = [...new Set(allPosts.map((post) => post.category))];
  const isFirstPage = requestedPage === 1;

  // On page 1 we show the featured hero separately, so exclude it from the grid
  const gridPosts = isFirstPage
    ? allPosts.filter((p) => p.slug !== featured?.slug)
    : allPosts;

  const {
    items: posts,
    totalPages,
    page: currentPage,
  } = paginate(gridPosts, requestedPage, POSTS_PER_PAGE);

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
