import type { Metadata } from 'next';
import { CLUSTERS, getPostsByCluster } from '@/lib/blog';
import { ClusterCard } from '@/components/blog/guides/ClusterCard';
import { NewsletterCTA } from '@/components/blog/NewsletterCTA';
import { FadeInOnScroll } from '@/components/landing/FadeInOnScroll';

export const metadata: Metadata = {
  title: 'Travel Guides — Curated Content Collections',
  description:
    'Explore our curated travel guide collections covering budget travel, destination guides, vibe-based trips, trip planning, group travel, and insider tips.',
  openGraph: {
    title: 'Travel Guides — Curated Content Collections | Faroway',
    description:
      'Explore our curated travel guide collections covering budget travel, destination guides, vibe-based trips, trip planning, group travel, and insider tips.',
    type: 'website',
  },
};

export default async function GuidesIndexPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.faroway.ai';

  // Pre-fetch cluster post counts in parallel
  const clusterCounts: Record<string, number> = Object.fromEntries(
    await Promise.all(
      CLUSTERS.map(async (c) => [c.slug, (await getPostsByCluster(c.slug)).length] as const),
    ),
  );

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${baseUrl}/blog` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${baseUrl}/blog/guides` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="pt-28 lg:pt-32 pb-12 lg:pb-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            Blog Guides
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
            Travel{' '}
            <span className="text-gradient">Guides</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Deep-dive content collections organized by theme. Pick a topic and start exploring.
          </p>
        </div>
      </section>

      {/* Cluster Grid */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CLUSTERS.map((cluster, i) => (
              <FadeInOnScroll key={cluster.slug} delay={i * 100}>
                <ClusterCard cluster={cluster} postCount={clusterCounts[cluster.slug] || 0} />
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <div className="max-w-7xl mx-auto px-6">
        <NewsletterCTA />
      </div>
    </>
  );
}
