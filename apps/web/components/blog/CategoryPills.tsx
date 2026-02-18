import Link from 'next/link';
import { CATEGORIES } from '@/lib/blog/types';

interface CategoryPillsProps {
  activeCategory?: string;
}

export function CategoryPills({ activeCategory }: CategoryPillsProps) {
  const allActive = !activeCategory;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Link
        href="/blog"
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          allActive
            ? 'bg-gradient-to-r from-primary to-amber-500 text-white shadow-lg shadow-primary/25'
            : 'bg-gray-50 text-slate-600 hover:bg-gray-100 hover:text-slate-900 border border-gray-200'
        }`}
      >
        All
      </Link>
      {CATEGORIES.map((cat) => {
        const slug = cat.toLowerCase().replace(/\s+/g, '-');
        const active = slug === activeCategory;
        return (
          <Link
            key={cat}
            href={`/blog/category/${slug}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              active
                ? 'bg-gradient-to-r from-primary to-amber-500 text-white shadow-lg shadow-primary/25'
                : 'bg-gray-50 text-slate-600 hover:bg-gray-100 hover:text-slate-900 border border-gray-200'
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
