import type { Metadata } from "next";
import { getAllCategories } from "@/lib/blog";
import { getBlogCategoryPage } from "@/lib/blog/pages";
import { BlogCard } from "@/components/blog/BlogCard";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { CategoryPills } from "@/components/blog/CategoryPills";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { Pagination } from "@/components/blog/Pagination";
import { BlogPaginationNavigation } from "@/components/blog/BlogPaginationNavigation";

export async function generateStaticParams() {
  return (await getAllCategories()).map((cat) => ({
    category: cat.toLowerCase().replace(/\s+/g, "-"),
  }));
}

export const dynamicParams = true;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const [{ category }, { page: pageParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { label, page } = await getBlogCategoryPage(category, pageParam);
  const pageLabel = page > 1 ? ` — Page ${page}` : "";
  const canonical =
    page > 1
      ? `/blog/category/${category}?page=${page}`
      : `/blog/category/${category}`;
  return {
    title: `${label} Articles — Travel Blog${pageLabel}`,
    description: `Browse our best ${label.toLowerCase()} articles. Expert advice, tips, and guides from the Faroway team.`,
    alternates: { canonical },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ category }, { page: pageParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const {
    label,
    categories,
    items: posts,
    totalPages,
    totalItems,
    page: currentPage,
  } = await getBlogCategoryPage(category, pageParam);

  return (
    <main className="min-h-screen pt-20">
      <BlogPaginationNavigation />
      <div className="container mx-auto px-6 max-w-7xl py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            { label: String(label) },
          ]}
        />

        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          {String(label)}
        </h1>
        <p className="text-slate-600 mb-8">
          {totalItems} article{totalItems !== 1 ? "s" : ""}
          {totalPages > 1 && (
            <span>
              {" "}
              · Page {currentPage} of {totalPages}
            </span>
          )}
        </p>

        {/* Category tabs */}
        <div className="mb-10">
          <CategoryPills activeCategory={category} categories={categories} />
        </div>

        {posts.length === 0 ? (
          <p className="text-slate-500 text-center py-20">
            No articles in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <BlogCard
                key={post.slug}
                post={post}
                headingLevel="h2"
                eager={index < 3}
              />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={`/blog/category/${category}`}
        />

        {(currentPage === totalPages || totalPages <= 1) && (
          <div className="max-w-4xl mx-auto">
            <NewsletterCTA />
          </div>
        )}
      </div>
    </main>
  );
}
