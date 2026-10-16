"use client";

import { useEffect, useState } from "react";
import { Check, Printer } from "lucide-react";
import type { PackingCategory } from "@/lib/tools/packing-data";

interface PackingChecklistProps {
  categories: PackingCategory[];
  storageKey: string;
}

export function PackingChecklist({
  categories,
  storageKey,
}: PackingChecklistProps) {
  // Remount the state owner whenever the list identity changes. A previous
  // list must never be persisted under a newly selected destination's key.
  return (
    <SavedPackingChecklist
      key={storageKey}
      categories={categories}
      storageKey={storageKey}
    />
  );
}

function SavedPackingChecklist({
  categories,
  storageKey,
}: PackingChecklistProps) {
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const validItems = new Set(
      categories.flatMap((category) =>
        category.items.map((item) => `${category.category}:${item.name}`),
      ),
    );
    let savedItems: string[] = [];
    let unavailable = false;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          savedItems = parsed.filter(
            (item): item is string =>
              typeof item === "string" && validItems.has(item),
          );
        }
      }
    } catch (error) {
      // Malformed data can be replaced; denied storage cannot promise a save.
      unavailable = !(error instanceof SyntaxError);
    }
    const frame = requestAnimationFrame(() => {
      setChecked(new Set(savedItems));
      setStorageUnavailable(unavailable);
      setHasHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [categories, storageKey]);

  const persist = (items: Set<string>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...items]));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  };

  const toggle = (item: string) => {
    if (!hasHydrated) return;
    const next = new Set(checked);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked(next);
    persist(next);
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const checkedCount = checked.size;
  const progressPercent =
    totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

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
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors print-hidden"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Packing progress"
          aria-valuemin={0}
          aria-valuemax={totalItems}
          aria-valuenow={checkedCount}
          className="h-2.5 bg-slate-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <p role="status" className="mb-6 text-sm text-slate-600">
        {!hasHydrated
          ? "Restoring your packing progress…"
          : storageUnavailable
            ? "Your progress is available in this tab, but this browser cannot save it. Keep this tab open until you finish."
            : "Your progress saves on this device as you pack."}
      </p>

      {/* Categories */}
      <div className="space-y-8">
        {categories.map((category) => {
          const categoryChecked = category.items.filter((i) =>
            checked.has(`${category.category}:${i.name}`),
          ).length;

          return (
            <div key={category.category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{category.emoji}</span>
                <h2 className="text-lg font-bold text-slate-900">
                  {category.category}
                </h2>
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
                      type="button"
                      key={key}
                      onClick={() => toggle(key)}
                      disabled={!hasHydrated}
                      aria-pressed={isChecked}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                        isChecked
                          ? "bg-primary/5 text-slate-400 line-through"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isChecked
                            ? "bg-primary border-primary"
                            : "border-slate-300"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
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
