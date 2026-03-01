import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { ACCENT_COLORS, type ClusterDefinition } from "@/lib/blog/clusters";

interface StartHerePathProps {
  cluster: ClusterDefinition;
}

export function StartHerePath({ cluster }: StartHerePathProps) {
  const accent = ACCENT_COLORS[cluster.accent];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <FadeInOnScroll>
          <div className="text-center mb-16">
            <span
              className={`inline-flex items-center gap-2 ${accent.pill} rounded-full px-4 py-1.5 text-sm font-medium mb-4`}
            >
              Reading Path
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Start Here
            </h2>
            <p className="text-slate-600 mt-3 max-w-xl mx-auto">
              New to this topic? Follow this recommended reading path.
            </p>
          </div>
        </FadeInOnScroll>

        <div className="relative">
          {/* Connecting line — desktop horizontal, mobile vertical */}
          <div
            className={`hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r ${accent.gradient} opacity-20 -translate-y-1/2`}
          />
          <div
            className={`lg:hidden absolute top-0 bottom-0 left-8 w-0.5 bg-gradient-to-b ${accent.gradient} opacity-20`}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
            {cluster.startHere.map((item, i) => (
              <FadeInOnScroll key={item.title} delay={i * 150}>
                <div className="relative bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 group">
                  {/* Step number */}
                  <div
                    className={`absolute -top-4 left-6 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br ${accent.gradient} text-white text-sm font-bold flex items-center justify-center shadow-lg`}
                  >
                    {i + 1}
                  </div>

                  <div className="pt-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {item.description}
                    </p>
                    {item.slug ? (
                      <Link
                        href={`/blog/${item.slug}`}
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accent.text} group-hover:gap-2.5 transition-all`}
                      >
                        Read article
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400">
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
