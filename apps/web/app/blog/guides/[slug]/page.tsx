import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getClusterBySlug,
  getAllClusterSlugs,
  getRelatedClusters,
  getPostsByCluster,
} from "@/lib/blog";
import { BlogCard } from "@/components/blog/BlogCard";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { ClusterHero } from "@/components/blog/guides/ClusterHero";
import { TopicGrid } from "@/components/blog/guides/TopicGrid";
import { StartHerePath } from "@/components/blog/guides/StartHerePath";
import { RelatedClusters } from "@/components/blog/guides/RelatedClusters";
import { ClusterCTA } from "@/components/blog/guides/ClusterCTA";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllClusterSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cluster = getClusterBySlug(slug);
  if (!cluster) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

  return {
    title: cluster.seo.title,
    description: cluster.seo.description,
    alternates: { canonical: `/blog/guides/${cluster.slug}` },
    openGraph: {
      title: cluster.seo.title,
      description: cluster.seo.description,
      url: `${baseUrl}/blog/guides/${cluster.slug}`,
      images: [
        {
          url: cluster.heroImage,
          width: 1200,
          height: 630,
          alt: cluster.heroImageAlt,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: cluster.seo.title,
      description: cluster.seo.description,
      images: [cluster.heroImage],
    },
  };
}

export default async function ClusterPage({ params }: PageProps) {
  const { slug } = await params;
  const cluster = getClusterBySlug(slug);
  if (!cluster) notFound();

  const posts = await getPostsByCluster(slug);
  const relatedClusters = getRelatedClusters(slug);
  const displayPosts = posts.slice(0, 9);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

  // JSON-LD schemas
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog",
        item: `${baseUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guides",
        item: `${baseUrl}/blog/guides`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: cluster.title,
        item: `${baseUrl}/blog/guides/${cluster.slug}`,
      },
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: cluster.seo.title,
    description: cluster.seo.description,
    url: `${baseUrl}/blog/guides/${cluster.slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: displayPosts.map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${baseUrl}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      {/* Section 1: Hero */}
      <ClusterHero cluster={cluster} postCount={posts.length} />

      {/* Section 2: Topics */}
      <TopicGrid cluster={cluster} />

      {/* Section 3: Start Here */}
      <StartHerePath cluster={cluster} />

      {/* Section 4: Latest Posts */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInOnScroll>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
                Latest Articles
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                From the Blog
              </h2>
            </div>
          </FadeInOnScroll>

          {displayPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayPosts.map((post, i) => (
                <FadeInOnScroll key={post.slug} delay={i * 100}>
                  <BlogCard post={post} />
                </FadeInOnScroll>
              ))}
            </div>
          ) : (
            <FadeInOnScroll>
              <div className="text-center py-16 bg-slate-50 rounded-2xl border border-gray-200">
                <p className="text-slate-500 text-lg mb-2">
                  Articles coming soon
                </p>
                <p className="text-slate-400 text-sm">
                  We&apos;re working on in-depth guides for this topic. Check
                  back soon!
                </p>
              </div>
            </FadeInOnScroll>
          )}
        </div>
      </section>

      {/* Section 5: Related Clusters */}
      <RelatedClusters clusters={relatedClusters} />

      {/* Section 6: CTA */}
      <ClusterCTA cluster={cluster} />

      {/* Section 7: Newsletter */}
      <div className="max-w-7xl mx-auto px-6">
        <NewsletterCTA />
      </div>
    </>
  );
}
