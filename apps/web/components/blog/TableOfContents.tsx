'use client';

import { useEffect, useState } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ content }: { content: string }) {
  const [activeId, setActiveId] = useState('');

  const headings: TOCItem[] = content
    .split('\n')
    .filter((line) => /^#{2,3}\s/.test(line))
    .map((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) return null;
      const text = match[2].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return { id, text, level: match[1].length };
    })
    .filter(Boolean) as TOCItem[];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  return (
    <nav className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto" aria-label="Table of contents">
      <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">On This Page</h2>
        <div className="h-0.5 w-12 bg-gradient-to-r from-primary to-amber-500 rounded-full mb-4" />
        <ul className="space-y-1 text-sm">
          {headings.map(({ id, text, level }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={`block py-1.5 rounded-lg transition-all duration-200 ${
                  level === 3 ? 'pl-6' : 'pl-3'
                } ${
                  activeId === id
                    ? 'text-primary-700 font-semibold bg-primary-50 border-l-2 border-primary'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-gray-100'
                }`}
              >
                {text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
