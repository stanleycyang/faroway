import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import type { ClusterDefinition } from "@/lib/blog/clusters";

interface RelatedClustersProps {
  clusters: ClusterDefinition[];
}

export function RelatedClusters({ clusters }: RelatedClustersProps) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <FadeInOnScroll>
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              Explore More
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Related Guides
            </h2>
          </div>
        </FadeInOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clusters.map((cluster, i) => (
            <FadeInOnScroll key={cluster.slug} delay={i * 100}>
              <Link
                href={`/blog/guides/${cluster.slug}`}
                className="group relative block overflow-hidden rounded-2xl aspect-[16/10]"
              >
                <Image
                  src={cluster.heroImage}
                  alt={cluster.heroImageAlt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {cluster.title}
                  </h3>
                  <p className="text-white/70 text-sm line-clamp-1 mb-2">
                    {cluster.tagline}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 group-hover:gap-2.5 transition-all">
                    Explore
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </FadeInOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
