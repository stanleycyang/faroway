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
async function loadCountries(signal: AbortSignal): Promise<CountryOption[]> {
  if (CACHED) return CACHED;
  const res = await fetch("/world-map/countries-110m.json", { signal });
  if (!res.ok) throw new Error("Country list unavailable");
  const json = await res.json();
  const geometries = json?.objects?.countries?.geometries;
  if (!Array.isArray(geometries)) throw new Error("Invalid country list");
  if (signal.aborted) throw new Error("Country search cancelled");
  const out: CountryOption[] = [];
  for (const g of geometries) {
    if (
      !g ||
      typeof g !== "object" ||
      !["string", "number"].includes(typeof g.id)
    )
      continue;
    const iso = NUMERIC_TO_ALPHA3[String(g.id).padStart(3, "0")];
    if (!iso) continue;
    out.push({
      iso,
      name: typeof g.properties?.name === "string" ? g.properties.name : iso,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  CACHED = out;
  return out;
}

export function CountrySearch({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      if (cancelled) return;
      controller.abort();
      setLoading(false);
      setLoadError(true);
    }, 15_000);
    loadCountries(controller.signal)
      .then((countries) => {
        if (cancelled || controller.signal.aborted) return;
        setOptions(countries);
        setLoading(false);
        setLoadError(false);
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) return;
        setLoading(false);
        setLoadError(true);
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(deadline);
    };
  }, [open, retry]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
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
        (o) => o.name.toLowerCase().includes(q) || o.iso.toLowerCase() === q,
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
            type="search"
            aria-label="Search countries"
            placeholder="Find a country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading && !loadError && filtered[0]) {
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
          aria-label="Search countries (keyboard shortcut slash)"
          onClick={() => {
            setOpen(true);
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

      {open && (loading || loadError || filtered.length === 0) && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white p-4 shadow-xl ring-1 ring-slate-200/70 z-50">
          {loadError ? (
            <>
              <p role="alert" className="text-sm text-slate-700">
                Country search couldn’t load. You can still select countries on
                the map.
              </p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary"
                onClick={() => {
                  setLoading(true);
                  setLoadError(false);
                  setRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status" className="text-sm text-slate-600">
              {loading
                ? "Loading countries…"
                : "No matching countries. Try another name."}
            </p>
          )}
        </div>
      )}
      {open && !loading && !loadError && filtered.length > 0 && (
        <div
          id="country-search-results"
          aria-label="Country search results"
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl ring-1 ring-slate-200/70 overflow-hidden z-50 animate-fade-in"
        >
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
