export type Status = "lived" | "visited" | "day_trip" | "transit" | "wishlist";

export type Theme = "classic" | "vintage" | "dark" | "parchment";

export interface Trip {
  id: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  cities?: string[];
  notes?: string;
}

export interface CountryVisit {
  iso: string; // ISO 3166-1 alpha-3
  status: Status;
  firstVisit?: string;
  lastVisit?: string;
  visitCount?: number;
  pinnedCity?: string;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  photoDataUrl?: string;
  trips?: Trip[];
}

export interface Profile {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
  updatedAt: string;
  visits: Record<string, CountryVisit>;
}

export interface AppSettings {
  theme: Theme;
  showLegend: boolean;
  quickPin: boolean;
  lastBackupAt?: string;
}

export interface AppState {
  schemaVersion: number;
  profiles: Profile[];
  activeProfileId: string;
  settings: AppSettings;
}

export interface ShareableVisits {
  // Compact shape: [iso, statusIdx, firstVisit?, visitCount?, pinnedCity?]
  v: Array<[string, number, string?, number?, string?]>;
  n?: string; // profile name
  e?: string; // profile emoji
}
