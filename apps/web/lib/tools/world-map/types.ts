// One status. Pinned or not.
export type Status = "visited";

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
  // Kept for backward-compat with previously persisted state. The app no
  // longer reads them — the map has one theme and no legend toggle.
  theme?: string;
  showLegend?: boolean;
  quickPin?: boolean;
  lastBackupAt?: string;
}

export interface AppState {
  schemaVersion: number;
  profiles: Profile[];
  activeProfileId: string;
  settings: AppSettings;
}
