interface ToolHeroProps {
  badge: string;
  title: string;
  gradientWord: string;
  description: string;
}

export function ToolHero({
  badge,
  title,
  gradientWord,
  description,
}: ToolHeroProps) {
  const parts = title.split(gradientWord);

  return (
    <section className="pt-28 lg:pt-32 pb-12 lg:pb-16">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
          {badge}
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
          {parts[0]}
          <span className="text-gradient">{gradientWord}</span>
          {parts[1] || ""}
        </h1>
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
      </div>
    </section>
  );
}
