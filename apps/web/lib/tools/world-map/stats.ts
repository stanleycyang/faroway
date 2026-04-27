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
  let totalVisited = 0;
  for (const v of Object.values(visits)) {
    totalVisited += 1;
    const continent = CONTINENT_BY_ALPHA3[v.iso];
    if (continent) continentsTouched.add(continent);
  }
  return {
    totalVisited,
    totalCountries: TOTAL_COUNTRIES,
    continentsVisited: continentsTouched.size,
    continentsTotal: 6,
  };
}
