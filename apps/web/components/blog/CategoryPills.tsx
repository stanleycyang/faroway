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
            ? "bg-[#143D46] text-white"
            : "bg-white text-slate-700 hover:bg-[#EFF5F3] hover:text-[#143D46] border border-[#DCE5E3]"
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
                ? "bg-[#143D46] text-white"
                : "bg-white text-slate-700 hover:bg-[#EFF5F3] hover:text-[#143D46] border border-[#DCE5E3]"
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}
