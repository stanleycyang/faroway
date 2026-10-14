import Link from "next/link";
import { Sparkles } from "lucide-react";

interface ToolCTAProps {
  destination?: string;
  title?: string;
  description?: string;
}

export function ToolCTA({
  title = "Ready to Plan Your Trip?",
  description = "Bring your places, dates, and travel style together in a thoughtful itinerary.",
  destination,
}: ToolCTAProps) {
  return (
    <section className="bg-[#253A34] py-16">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {title}
        </h2>
        <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
          {description}
        </p>
        <Link
          href={
            destination
              ? `/create?destination=${encodeURIComponent(destination)}`
              : "/create"
          }
          className="inline-flex items-center gap-2 bg-white text-[#253A34] px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl motion-safe:hover:-translate-y-0.5 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Start planning
        </Link>
      </div>
    </section>
  );
}
