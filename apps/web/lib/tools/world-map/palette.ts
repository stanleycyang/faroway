// Single source of truth for the editorial atlas palette. Both the live
// editor page and the server-side share-poster route read from here so the
// share moment looks visually continuous with the editing moment.

export const PALETTE = {
  paper: "#FAF6EF",
  paperEdge: "#EDE5D2",
  ink: "#0F172A",
  inkSubtle: "#475569",
  inkFaint: "#94A3B8",
  visited: "#B91C1C",
  visitedEdge: "#7F1D1D",
  unvisitedEdge: "#D6D3CB",
  hairline: "rgba(15, 23, 42, 0.10)",
} as const;
