import type { Status } from "./types";

export const STATUS_ORDER: Status[] = [
  "lived",
  "visited",
  "day_trip",
  "transit",
  "wishlist",
];

interface StatusConfig {
  label: string;
  shortLabel: string;
  description: string;
  fill: string;
  stroke: string;
  dashed: boolean;
  emoji: string;
}

export const STATUS_CONFIG: Record<Status, StatusConfig> = {
  lived: {
    label: "Lived",
    shortLabel: "Lived",
    description: "Resided ≥ 3 months",
    fill: "#B91C1C",
    stroke: "#7F1D1D",
    dashed: false,
    emoji: "🏠",
  },
  visited: {
    label: "Visited",
    shortLabel: "Visited",
    description: "Spent a night",
    fill: "#16A34A",
    stroke: "#15803D",
    dashed: false,
    emoji: "✈️",
  },
  day_trip: {
    label: "Day Trip",
    shortLabel: "Day",
    description: "No overnight stay",
    fill: "#CA8A04",
    stroke: "#A16207",
    dashed: false,
    emoji: "🌅",
  },
  transit: {
    label: "Transit",
    shortLabel: "Transit",
    description: "Airport layover only",
    fill: "#94A3B8",
    stroke: "#64748B",
    dashed: true,
    emoji: "🛬",
  },
  wishlist: {
    label: "Wishlist",
    shortLabel: "Wish",
    description: "Want to go",
    fill: "rgba(37, 99, 235, 0.08)",
    stroke: "#2563EB",
    dashed: true,
    emoji: "📍",
  },
};

export const UNVISITED_FILL = "#F3F4F6";
export const UNVISITED_STROKE = "#CBD5E1";

export const THEMES = {
  classic: {
    bg: "bg-white",
    mapBg: "#FAFAFA",
    ocean: "#EFF6FF",
    border: "#CBD5E1",
    unvisitedFill: "#F3F4F6",
  },
  vintage: {
    bg: "bg-amber-50",
    mapBg: "#FEF3C7",
    ocean: "#FEF9C3",
    border: "#D6A957",
    unvisitedFill: "#FDE68A",
  },
  dark: {
    bg: "bg-slate-900",
    mapBg: "#1E293B",
    ocean: "#0F172A",
    border: "#475569",
    unvisitedFill: "#334155",
  },
  parchment: {
    bg: "bg-stone-100",
    mapBg: "#F5F5DC",
    ocean: "#FAFAF0",
    border: "#A8A29E",
    unvisitedFill: "#E7E5E4",
  },
} as const;
