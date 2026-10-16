import type { CountryVisit } from "./types";
import {
  CONTINENT_BY_ALPHA3,
  TOTAL_COUNTRIES,
  type Continent,
} from "./continents";

export interface Stats {
  totalVisited: number;
  totalCountries: number;
  continentsVisited: number;
  continentsTotal: number;
}

export function computeStats(visits: Record<string, CountryVisit>): Stats {
  const continentsTouched = new Set<Continent>();
  const countries = new Set<string>();
  for (const v of Object.values(visits)) {
    if (!v || !Object.hasOwn(CONTINENT_BY_ALPHA3, v.iso)) continue;
    const continent = CONTINENT_BY_ALPHA3[v.iso];
    if (continent === "Antarctica") continue;
    countries.add(v.iso);
    continentsTouched.add(continent);
  }
  return {
    totalVisited: countries.size,
    totalCountries: TOTAL_COUNTRIES,
    continentsVisited: continentsTouched.size,
    continentsTotal: 6,
  };
}
