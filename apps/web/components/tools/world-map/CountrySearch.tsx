"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { flagEmoji, NUMERIC_TO_ALPHA3 } from "@/lib/tools/world-map/iso";

interface CountryOption {
  iso: string;
  name: string;
}

interface Props {
  onPick: (iso: string, name: string) => void;
}

// Lazy-loaded list of (iso, name) pairs extracted from the TopoJSON names.
let CACHED: CountryOption[] | null = null;
async function loadCountries(): Promise<CountryOption[]> {
  if (CACHED) return CACHED;
  const res = await fetch("/world-map/countries-110m.json");
  const json = (await res.json()) as {
    objects: {
      countries: {
        geometries: Array<{ id: string; properties: { name?: string } }>;
      };
    };
  };
  const out: CountryOption[] = [];
  for (const g of json.objects.countries.geometries) {
    const iso = NUMERIC_TO_ALPHA3[String(g.id).padStart(3, "0")];
    if (!iso) continue;
    out.push({ iso, name: g.properties.name ?? iso });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  CACHED = out;
  return out;
}

export function CountrySearch({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CountryOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) loadCountries().then(setOptions).catch(console.error);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        e.key === "/" &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) || o.iso.toLowerCase() === q,
      )
      .slice(0, 8);
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <div className="flex items-center gap-2 bg-white rounded-full ring-1 ring-slate-200 px-2 py-1 shadow-sm min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Find a country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) {
                onPick(filtered[0].iso, filtered[0].name);
                setOpen(false);
                setQuery("");
              }
            }}
            className="flex-1 min-w-0 bg-transparent py-1 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery("");
            }}
            className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
            aria-label="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="inline-flex items-center gap-2 bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-slate-500 px-3 py-2 rounded-full text-sm font-medium transition-all"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden md:inline-block text-[10px] font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 ml-1">
            /
          </kbd>
        </button>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-50 animate-fade-in">
          {filtered.map((o) => (
            <button
              key={o.iso}
              type="button"
              onClick={() => {
                onPick(o.iso, o.name);
                setOpen(false);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left transition-colors"
            >
              <span className="text-xl leading-none">{flagEmoji(o.iso)}</span>
              <span className="text-sm font-medium text-slate-900 flex-1 truncate">
                {o.name}
              </span>
              <span className="text-xs font-mono text-slate-400">{o.iso}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
