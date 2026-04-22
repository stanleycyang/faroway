import type { CountryVisit, Status } from "./types";
import {
  CONTINENTS,
  CONTINENT_BY_ALPHA3,
  CONTINENT_TOTALS,
  TOTAL_COUNTRIES,
  type Continent,
} from "./continents";

export interface ContinentStat {
  continent: Continent;
  visited: number;
  total: number;
  percent: number;
}

export interface Stats {
  totalVisited: number; // any status except wishlist
  totalCountries: number;
  continentsVisited: number;
  continentsTotal: number;
  byStatus: Record<Status, number>;
  byContinent: ContinentStat[];
}

const COUNTABLE_STATUSES: Status[] = [
  "lived",
  "visited",
  "day_trip",
  "transit",
];

export function computeStats(visits: Record<string, CountryVisit>): Stats {
  const byStatus: Record<Status, number> = {
    lived: 0,
    visited: 0,
    day_trip: 0,
    transit: 0,
    wishlist: 0,
  };
  const continentCounts: Record<Continent, number> = {
    Africa: 0,
    Antarctica: 0,
    Asia: 0,
    Europe: 0,
    "North America": 0,
    Oceania: 0,
    "South America": 0,
  };

  let totalVisited = 0;
  const continentsTouched = new Set<Continent>();

  for (const v of Object.values(visits)) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    if (COUNTABLE_STATUSES.includes(v.status)) {
      totalVisited += 1;
      const continent = CONTINENT_BY_ALPHA3[v.iso];
      if (continent) {
        continentCounts[continent] += 1;
        continentsTouched.add(continent);
      }
    }
  }

  const byContinent: ContinentStat[] = CONTINENTS.filter(
    (c) => c !== "Antarctica",
  ).map((c) => {
    const total = CONTINENT_TOTALS[c];
    const visited = continentCounts[c];
    return {
      continent: c,
      visited,
      total,
      percent: total > 0 ? Math.min(100, (visited / total) * 100) : 0,
    };
  });

  return {
    totalVisited,
    totalCountries: TOTAL_COUNTRIES,
    continentsVisited: continentsTouched.size,
    continentsTotal: 6,
    byStatus,
    byContinent,
  };
}
