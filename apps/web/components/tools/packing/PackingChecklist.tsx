'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Printer } from 'lucide-react';
import type { PackingCategory } from '@/lib/tools/packing-data';

interface PackingChecklistProps {
  categories: PackingCategory[];
  storageKey: string;
}

export function PackingChecklist({ categories, storageKey }: PackingChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setChecked(new Set(JSON.parse(saved)));
    } catch {}
  }, [storageKey]);

  // Save to localStorage
  const persist = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {}
    },
    [storageKey]
  );

  const toggle = (item: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      persist(next);
      return next;
    });
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const checkedCount = checked.size;
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      <div className="sticky top-28 lg:top-32 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/60 py-4 mb-6 print-static print-border-none">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-900">
            {checkedCount}/{totalItems} packed
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">
              {progressPercent}%
            </span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors print-hidden"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryChecked = category.items.filter((i) =>
            checked.has(`${category.category}:${i.name}`)
          ).length;

          return (
            <div key={category.category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{category.emoji}</span>
                <h3 className="text-lg font-bold text-slate-900">
                  {category.category}
                </h3>
                <span className="text-xs text-slate-400 ml-auto">
                  {categoryChecked}/{category.items.length}
                </span>
              </div>

              <div className="space-y-1">
                {category.items.map((item) => {
                  const key = `${category.category}:${item.name}`;
                  const isChecked = checked.has(key);

                  return (
                    <button
                      key={key}
                      onClick={() => toggle(key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                        isChecked
                          ? 'bg-primary/5 text-slate-400 line-through'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isChecked
                            ? 'bg-primary border-primary'
                            : 'border-slate-300'
                        }`}
                      >
                        {isChecked && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm">
                        {item.name}
                        {item.essential && !isChecked && (
                          <span className="ml-2 text-xs text-primary font-medium">
                            Essential
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
