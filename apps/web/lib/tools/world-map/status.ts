// Atlas palette for the live editor map. Pulls from the shared editorial
// palette so the live map and the OG share posters stay visually identical.
import { PALETTE } from "./palette";

export const VISITED_FILL = PALETTE.visited;
export const VISITED_STROKE = PALETTE.visitedEdge;

// Sand land base for unvisited countries — gives the world a body so the
// red visited countries read as "places I've been on a real map" instead
// of stamps floating on cream.
export const UNVISITED_FILL = "#E8DFC4";
export const UNVISITED_STROKE = "#D8CDB1";

// Subtle ocean tone behind everything, slightly cooler than the page paper
// so the sphere outline reads as a separate layer.
export const OCEAN_FILL = "#F1ECDF";

// Graticule (lat/long grid) — visible only in oceans because land paints
// over them. Major lines (equator + prime meridian) get a heavier stroke.
export const GRATICULE_STROKE = "rgba(15, 23, 42, 0.05)";
export const GRATICULE_MAJOR_STROKE = "rgba(15, 23, 42, 0.10)";

// Page-level gradient (kept for back-compat with the existing container).
export const MAP_BG_TOP = PALETTE.paper;
export const MAP_BG_BOTTOM = PALETTE.paperEdge;
