"use client";

import { useMemo } from "react";
import {
  CONTINENT_BY_ALPHA3,
  CONTINENTS,
  type Continent,
} from "@/lib/tools/world-map/continents";
import type { CountryVisit } from "@/lib/tools/world-map/types";
import { numericToAlpha3 } from "@/lib/tools/world-map/iso";
import topology from "@/lib/tools/world-map/topology.json";

// Pull country names once at module load from the bundled TopoJSON we
// already use everywhere else for rendering. Keeps Field Notes self-
// contained without a separate data file.
const COUNTRY_NAME_BY_ALPHA3: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  type Geom = { id?: string | number; properties?: { name?: string } };
  type Topo = {
    objects?: { countries?: { geometries?: Geom[] } };
  };
  const t = topology as unknown as Topo;
  const geoms = t.objects?.countries?.geometries ?? [];
  for (const g of geoms) {
    const iso = numericToAlpha3(String(g.id ?? "").padStart(3, "0"));
    if (iso && g.properties?.name) {
      out[iso] = g.properties.name;
    }
  }
  return out;
})();

interface Props {
  visits: Record<string, CountryVisit>;
}

interface Group {
  continent: Continent;
  entries: Array<{ visit: CountryVisit; name: string }>;
}

function formatVisitYear(date?: string): string | null {
  if (!date) return null;
  // ISO yyyy-mm-dd → "2024" (year only keeps things tight in the index)
  const m = /^(\d{4})/.exec(date);
  return m ? m[1] : null;
}

export function FieldNotes({ visits }: Props) {
  const groups = useMemo<Group[]>(() => {
    const buckets: Record<Continent, Group["entries"]> = {
      Africa: [],
      Antarctica: [],
      Asia: [],
      Europe: [],
      "North America": [],
      Oceania: [],
      "South America": [],
    };
    for (const v of Object.values(visits)) {
      const continent = CONTINENT_BY_ALPHA3[v.iso];
      if (!continent) continue;
      buckets[continent].push({
        visit: v,
        name: COUNTRY_NAME_BY_ALPHA3[v.iso] ?? v.iso,
      });
    }
    for (const c of CONTINENTS) {
      buckets[c].sort((a, b) => a.name.localeCompare(b.name));
    }
    return CONTINENTS.filter((c) => buckets[c].length > 0).map((c) => ({
      continent: c,
      entries: buckets[c],
    }));
  }, [visits]);

  return (
    <section aria-labelledby="field-notes-title" className="flex flex-col">
      <header className="flex items-baseline gap-3">
        <h2
          id="field-notes-title"
          className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500"
        >
          Field Notes
        </h2>
        <div className="h-px flex-1 bg-ink/15" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 tabular-nums">
          {Object.keys(visits).length} pinned
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="mt-6 font-editorial text-lg italic text-slate-400">
          Field notes appear as you pin countries.
        </p>
      ) : (
        <div className="mt-6 columns-1 gap-x-12 sm:columns-2 xl:columns-3 [column-fill:_balance]">
          {groups.map((group) => (
            <article key={group.continent} className="mb-8 break-inside-avoid">
              <div className="flex items-baseline gap-2 border-b border-ink/15 pb-1.5">
                <h3 className="font-editorial text-xl font-bold text-ink">
                  {group.continent}
                </h3>
                <span className="text-[11px] font-bold tracking-[0.18em] text-slate-400 tabular-nums">
                  · {group.entries.length}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {group.entries.map(({ visit, name }) => {
                  const year = formatVisitYear(visit.firstVisit);
                  return (
                    <li
                      key={visit.iso}
                      className="flex items-baseline gap-2 text-sm text-slate-700"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 w-9 flex-shrink-0">
                        {visit.iso}
                      </span>
                      <span className="font-medium text-slate-800 truncate">
                        {name}
                      </span>
                      {(year || visit.pinnedCity) && (
                        <span className="ml-auto text-[12px] italic text-slate-500 truncate">
                          {[year, visit.pinnedCity].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
