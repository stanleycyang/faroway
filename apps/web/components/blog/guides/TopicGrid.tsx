import { FadeInOnScroll } from '@/components/landing/FadeInOnScroll';
import { ACCENT_COLORS, type ClusterDefinition } from '@/lib/blog/clusters';

interface TopicGridProps {
  cluster: ClusterDefinition;
}

export function TopicGrid({ cluster }: TopicGridProps) {
  const accent = ACCENT_COLORS[cluster.accent];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <FadeInOnScroll>
          <div className="text-center mb-12">
            <span
              className={`inline-flex items-center gap-2 ${accent.pill} rounded-full px-4 py-1.5 text-sm font-medium mb-4`}
            >
              Topics Covered
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              What You&apos;ll Learn
            </h2>
          </div>
        </FadeInOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cluster.topics.map((topic, i) => {
            const Icon = topic.icon;
            return (
              <FadeInOnScroll key={topic.title} delay={i * 100}>
                <div
                  className={`bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl ${accent.hoverShadow} transition-all duration-300`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${accent.iconBg} flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-6 h-6 ${accent.text}`} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {topic.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {topic.description}
                  </p>
                </div>
              </FadeInOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
