import Link from "next/link";
import { CATEGORIES } from "@/lib/blog/types";

interface CategoryPillsProps {
  activeCategory?: string;
  categories?: readonly string[];
}

export function CategoryPills({
  activeCategory,
  categories = CATEGORIES,
}: CategoryPillsProps) {
  const allActive = !activeCategory;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Link
        href="/blog"
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          allActive
            ? "bg-slate-900 text-white"
            : "bg-gray-50 text-slate-600 hover:bg-gray-100 hover:text-slate-900 border border-gray-200"
        }`}
      >
        All
      </Link>
      {categories.map((cat) => {
        const slug = cat.toLowerCase().replace(/\s+/g, "-");
        const active = slug === activeCategory;
        return (
          <Link
            key={cat}
            href={`/blog/category/${slug}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              active
                ? "bg-slate-900 text-white"
                : "bg-gray-50 text-slate-600 hover:bg-gray-100 hover:text-slate-900 border border-gray-200"
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
