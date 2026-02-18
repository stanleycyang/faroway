import type { Metadata } from 'next';
import { getAllPostMetas, getFeaturedPost, CATEGORIES } from '@/lib/blog';
import { BlogCard, FeaturedBlogCard } from '@/components/blog/BlogCard';
import { NewsletterCTA } from '@/components/blog/NewsletterCTA';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Travel Blog — Tips, Guides & Inspiration',
  description: 'Expert travel tips, destination guides, budget hacks, and AI-powered planning advice. Everything you need to plan your next adventure.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'TripGenie Travel Blog — Tips, Guides & Inspiration',
    description: 'Expert travel tips, destination guides, and AI-powered planning advice.',
    type: 'website',
    url: '/blog',
  },
};

export default function BlogIndex() {
  const posts = getAllPostMetas();
  const featured = getFeaturedPost();
  const remaining = posts.filter((p) => p.slug !== featured?.slug);

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20">
        {/* Hero */}
        <section className="container mx-auto px-6 max-w-7xl pt-8 pb-4">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Travel Blog
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Expert tips, destination guides, and insights to help you travel smarter with AI.
            </p>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <Link
              href="/blog"
              className="px-4 py-2 rounded-full bg-primary-500 text-white text-sm font-medium"
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog/category/${cat.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-primary-50 hover:text-primary-600 text-sm font-medium transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>

          {/* Featured Post */}
          {featured && <FeaturedBlogCard post={featured} />}
        </section>

        {/* Post Grid */}
        <section className="container mx-auto px-6 max-w-7xl py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Latest Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {remaining.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <div className="container mx-auto px-6 max-w-4xl">
          <NewsletterCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
