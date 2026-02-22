import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, variant = 'light' }: { items: Crumb[]; variant?: 'light' | 'dark' }) {
  const isDark = variant === 'dark';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.tripgenie.ai'}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-500'} mb-6`}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className={isDark ? 'text-white/30' : 'text-gray-600'}>/</span>}
              {item.href ? (
                <Link href={item.href} className="hover:text-primary transition-colors">{item.label}</Link>
              ) : (
                <span className={`${isDark ? 'text-white/80' : 'text-slate-900'} font-medium`}>{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
