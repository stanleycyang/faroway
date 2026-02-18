import type { Metadata } from 'next';
import { getPostsByCategory, getAllCategories, paginate, CATEGORIES, POSTS_PER_PAGE } from '@/lib/blog';
import { BlogCard } from '@/components/blog/BlogCard';
import { Breadcrumbs } from '@/components/blog/Breadcrumbs';
import { CategoryPills } from '@/components/blog/CategoryPills';
import { NewsletterCTA } from '@/components/blog/NewsletterCTA';
import { Pagination } from '@/components/blog/Pagination';

export function generateStaticParams() {
  return getAllCategories().map((cat) => ({
    category: cat.toLowerCase().replace(/\s+/g, '-'),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORIES.find((c) => c.toLowerCase().replace(/\s+/g, '-') === category) || category;
  return {
    title: `${label} Articles — Travel Blog`,
    description: `Browse our best ${label.toLowerCase()} articles. Expert advice, tips, and guides from the TripGenie team.`,
    alternates: { canonical: `/blog/category/${category}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1);

  const allPosts = getPostsByCategory(category);
  const label = CATEGORIES.find((c) => c.toLowerCase().replace(/\s+/g, '-') === category) || category;

  const { items: posts, totalPages, totalItems } = paginate(allPosts, currentPage, POSTS_PER_PAGE);

  return (
    <main className="min-h-screen pt-20">
      <div className="container mx-auto px-6 max-w-7xl py-8">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: String(label) },
          ]}
        />

        <h1 className="text-4xl font-bold text-slate-900 mb-2">{String(label)}</h1>
        <p className="text-slate-600 mb-8">
          {totalItems} article{totalItems !== 1 ? 's' : ''}
          {totalPages > 1 && <span> · Page {currentPage} of {totalPages}</span>}
        </p>

        {/* Category tabs */}
        <div className="mb-10">
          <CategoryPills activeCategory={category} />
        </div>

        {posts.length === 0 ? (
          <p className="text-slate-500 text-center py-20">No articles in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
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
