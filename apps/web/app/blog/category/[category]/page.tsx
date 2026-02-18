import type { Metadata } from 'next';
import { getPostsByCategory, getAllCategories, CATEGORIES } from '@/lib/blog';
import { BlogCard } from '@/components/blog/BlogCard';
import { Breadcrumbs } from '@/components/blog/Breadcrumbs';
import { NewsletterCTA } from '@/components/blog/NewsletterCTA';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

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

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const posts = getPostsByCategory(category);
  const label = CATEGORIES.find((c) => c.toLowerCase().replace(/\s+/g, '-') === category) || category;

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20">
        <div className="container mx-auto px-6 max-w-7xl py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Blog', href: '/blog' },
              { label: String(label) },
            ]}
          />

          <h1 className="text-4xl font-bold text-gray-900 mb-2">{String(label)}</h1>
          <p className="text-gray-500 mb-8">{posts.length} article{posts.length !== 1 ? 's' : ''}</p>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-10">
            <Link href="/blog" className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-600 text-sm font-medium transition-colors">
              All
            </Link>
            {CATEGORIES.map((cat) => {
              const slug = cat.toLowerCase().replace(/\s+/g, '-');
              const active = slug === category;
              return (
                <Link
                  key={cat}
                  href={`/blog/category/${slug}`}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}
                >
                  {cat}
                </Link>
              );
            })}
          </div>

          {posts.length === 0 ? (
            <p className="text-gray-400 text-center py-20">No articles in this category yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            <NewsletterCTA />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
