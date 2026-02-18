import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blog';
import { Breadcrumbs } from '@/components/blog/Breadcrumbs';
import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { NewsletterCTA } from '@/components/blog/NewsletterCTA';
import { BlogCard } from '@/components/blog/BlogCard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai';

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.lastUpdated || post.date,
      authors: [post.author.name],
      tags: post.tags,
      images: [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }],
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [post.coverImage],
    },
  };
}

// Simple markdown-to-HTML (handles headings, bold, italic, links, lists, blockquotes, images, hr)
function renderMarkdown(md: string): string {
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // HR
    .replace(/^---$/gm, '<hr />')
    // Headings (with IDs for TOC)
    .replace(/^### (.+)$/gm, (_m, t) => {
      const id = t.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return `<h3 id="${id}">${t}</h3>`;
    })
    .replace(/^## (.+)$/gm, (_m, t) => {
      const id = t.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return `<h2 id="${id}">${t}</h2>`;
    });

  // Process blocks (paragraphs, lists, blockquotes)
  const lines = html.split('\n');
  const out: string[] = [];
  let inList = false;
  let listType = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (/^- /.test(line)) {
      if (!inList || listType !== 'ul') {
        if (inList) out.push(`</${listType}>`);
        out.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (!inList || listType !== 'ol') {
        if (inList) out.push(`</${listType}>`);
        out.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      out.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
    } else {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      if (/^> (.+)/.test(line)) {
        out.push(`<blockquote><p>${line.slice(2)}</p></blockquote>`);
      } else if (/^<(h[23]|pre|hr|img|ul|ol|blockquote)/.test(line) || line.trim() === '') {
        out.push(line);
      } else if (line.trim()) {
        out.push(`<p>${line}</p>`);
      }
    }
  }
  if (inList) out.push(`</${listType}>`);

  return out.join('\n');
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 3);
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const contentHtml = renderMarkdown(post.content);

  // Article JSON-LD
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: post.coverImage,
    datePublished: post.date,
    dateModified: post.lastUpdated || post.date,
    author: { '@type': 'Person', name: post.author.name },
    publisher: {
      '@type': 'Organization',
      name: 'TripGenie',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/icon.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
  };

  return (
    <>
      <Header />
      <ReadingProgressBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <main className="min-h-screen pt-20">
        {/* Hero Image */}
        <div className="relative w-full aspect-[21/9] max-h-[500px] overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        <div className="container mx-auto px-6 max-w-7xl">
          <div className="max-w-3xl mx-auto -mt-20 relative z-10">
            {/* Breadcrumbs */}
            <div className="bg-white rounded-t-2xl pt-6 px-2">
              <Breadcrumbs
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Blog', href: '/blog' },
                  { label: post.category, href: `/blog/category/${post.category.toLowerCase().replace(/\s+/g, '-')}` },
                  { label: post.title },
                ]}
              />
            </div>

            {/* Post Header */}
            <header className="bg-white px-2 pb-8">
              <div className="flex items-center gap-3 text-sm mb-4">
                <Link
                  href={`/blog/category/${post.category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-primary-600 font-semibold hover:text-primary-800"
                >
                  {post.category}
                </Link>
                <span className="text-gray-300">•</span>
                <time dateTime={post.date} className="text-gray-500">
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </time>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">{post.readingTime} min read</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                {post.title}
              </h1>
              <p className="text-xl text-gray-500 mb-6">{post.description}</p>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Image
                    src={post.author.avatar}
                    alt={post.author.name}
                    width={44}
                    height={44}
                    className="rounded-full"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{post.author.name}</p>
                    {post.lastUpdated && (
                      <p className="text-xs text-gray-400">
                        Updated {new Date(post.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <ShareButtons url={postUrl} title={post.title} description={post.description} />
              </div>
            </header>
          </div>

          {/* Content + TOC */}
          <div className="flex gap-12 max-w-7xl mx-auto">
            <article className="max-w-3xl mx-auto flex-1 min-w-0">
              <div
                className="prose prose-lg prose-gray max-w-none
                  prose-headings:font-bold prose-headings:tracking-tight
                  prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                  prose-p:leading-relaxed prose-p:text-gray-700
                  prose-a:text-primary-600 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-primary-800
                  prose-strong:text-gray-900
                  prose-ul:my-4 prose-li:my-1
                  prose-img:rounded-xl prose-img:shadow-lg
                  prose-blockquote:border-primary-400 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r-xl prose-blockquote:py-1"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />

              {/* Tags */}
              <div className="mt-12 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Author Bio */}
              <div className="mt-8 p-6 bg-gray-50 rounded-2xl flex gap-4 items-start">
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  width={56}
                  height={56}
                  className="rounded-full flex-shrink-0"
                />
                <div>
                  <p className="font-bold text-gray-900">{post.author.name}</p>
                  <p className="text-gray-600 text-sm mt-1">{post.author.bio}</p>
                </div>
              </div>

              <ShareButtons url={postUrl} title={post.title} description={post.description} />

              <NewsletterCTA />
            </article>

            {/* Sidebar TOC */}
            <aside className="hidden xl:block w-64 flex-shrink-0">
              <TableOfContents content={post.content} />
            </aside>
          </div>

          {/* Related Posts */}
          {related.length > 0 && (
            <section className="max-w-7xl mx-auto py-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">You Might Also Like</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {related.map((p) => (
                  <BlogCard key={p.slug} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
