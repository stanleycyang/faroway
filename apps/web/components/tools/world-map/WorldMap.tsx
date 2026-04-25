"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Maximize, Minus, Plus } from "lucide-react";
import { numericToAlpha3 } from "@/lib/tools/world-map/iso";
import {
  MAP_BG_BOTTOM,
  MAP_BG_TOP,
  UNVISITED_FILL,
  UNVISITED_STROKE,
  VISITED_FILL,
  VISITED_STROKE,
} from "@/lib/tools/world-map/status";
import type { CountryVisit } from "@/lib/tools/world-map/types";
import { MapTooltip } from "./MapTooltip";

const GEO_URL = "/world-map/countries-110m.json";

interface HoverState {
  iso: string;
  name: string;
  x: number;
  y: number;
}

export type CountryClickIntent = "toggle" | "edit";

interface WorldMapProps {
  visits: Record<string, CountryVisit>;
  readOnly?: boolean;
  onCountryClick?: (
    iso: string,
    name: string,
    intent: CountryClickIntent,
  ) => void;
}

const LONG_PRESS_MS = 500;
const HOME_POSITION = { coordinates: [10, 20] as [number, number], zoom: 1 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.6;

export function WorldMap({ visits, readOnly, onCountryClick }: WorldMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [position, setPosition] = useState(HOME_POSITION);
  const containerRef = useRef<HTMLDivElement>(null);

  // Long-press / right-click bookkeeping. Long-press on touch and right-click
  // on desktop both open the detail drawer (intent: "edit"); a regular left
  // click toggles the pin.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  }, []);

  // Reset hover on scroll so the tooltip doesn't stick when the page moves.
  useEffect(() => {
    const onScroll = () => setHover(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleMoveEnd = useCallback(
    (pos: { coordinates: [number, number]; zoom: number }) => {
      setPosition(pos);
    },
    [],
  );

  const zoomIn = () =>
    setPosition((p) => ({
      ...p,
      zoom: Math.min(p.zoom * ZOOM_STEP, MAX_ZOOM),
    }));
  const zoomOut = () =>
    setPosition((p) => ({
      ...p,
      zoom: Math.max(p.zoom / ZOOM_STEP, MIN_ZOOM),
    }));
  const resetZoom = () => setPosition(HOME_POSITION);

  // d3-zoom interprets trackpad pinch + ctrl-scroll as wheel events, which is
  // exactly the gesture that felt janky. Block wheel zoom entirely; only the
  // explicit buttons and touch pinch can change zoom. The `filterZoomEvent`
  // type in @types/react-simple-maps is stale (declared as `SVGElement` instead
  // of the actual d3-zoom event), so cast it.
  const filterZoomEvent = useCallback(
    (event: Event | SVGElement) => (event as Event).type !== "wheel",
    [],
  ) as unknown as (element: SVGElement) => boolean;

  const containerStyle: CSSProperties = {
    background: `radial-gradient(ellipse at top, ${MAP_BG_TOP} 0%, ${MAP_BG_BOTTOM} 100%)`,
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden border border-ink/15"
      style={containerStyle}
    >
      {/* Paper grain — barely visible, gives the canvas a subtle atlas texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Corner tick marks — modern editorial restraint, four tiny L-shapes */}
      <CornerTicks />

      {/* Projection caption, bottom-right corner of the map canvas */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500/80">
        Equal Earth Projection
      </div>

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        width={980}
        height={500}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          filterZoomEvent={filterZoomEvent}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const iso = numericToAlpha3(geo.id as string);
                const visit = iso ? visits[iso] : undefined;
                const isVisited = Boolean(visit);
                const fill = isVisited ? VISITED_FILL : UNVISITED_FILL;
                const stroke = isVisited ? VISITED_STROKE : UNVISITED_STROKE;
                const name =
                  (geo.properties as { name?: string }).name ?? iso ?? "";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(event: ReactMouseEvent) => {
                      if (!iso) return;
                      const rect =
                        containerRef.current?.getBoundingClientRect();
                      setHover({
                        iso,
                        name,
                        x: event.clientX - (rect?.left ?? 0),
                        y: event.clientY - (rect?.top ?? 0),
                      });
                    }}
                    onMouseMove={(event: ReactMouseEvent) => {
                      const rect =
                        containerRef.current?.getBoundingClientRect();
                      setHover((h) =>
                        h
                          ? {
                              ...h,
                              x: event.clientX - (rect?.left ?? 0),
                              y: event.clientY - (rect?.top ?? 0),
                            }
                          : h,
                      );
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (readOnly || !iso || !onCountryClick) return;
                      if (longPressFiredRef.current) {
                        longPressFiredRef.current = false;
                        return;
                      }
                      onCountryClick(iso, name, "toggle");
                    }}
                    onContextMenu={(event: ReactMouseEvent) => {
                      if (readOnly || !iso || !onCountryClick) return;
                      event.preventDefault();
                      onCountryClick(iso, name, "edit");
                    }}
                    onPointerDown={(event: ReactPointerEvent) => {
                      if (
                        readOnly ||
                        !iso ||
                        !onCountryClick ||
                        event.pointerType !== "touch"
                      )
                        return;
                      pointerStartRef.current = {
                        x: event.clientX,
                        y: event.clientY,
                      };
                      longPressFiredRef.current = false;
                      clearLongPress();
                      longPressTimerRef.current = setTimeout(() => {
                        longPressFiredRef.current = true;
                        onCountryClick(iso, name, "edit");
                      }, LONG_PRESS_MS);
                    }}
                    onPointerMove={(event: ReactPointerEvent) => {
                      const start = pointerStartRef.current;
                      if (!start) return;
                      const dx = event.clientX - start.x;
                      const dy = event.clientY - start.y;
                      if (dx * dx + dy * dy > 100) clearLongPress();
                    }}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    style={{
                      default: {
                        fill,
                        stroke,
                        strokeWidth: 0.5,
                        outline: "none",
                        transition:
                          "fill 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 200ms ease",
                      },
                      hover: {
                        fill: isVisited ? "#ef4444" : "#e2e8f0",
                        stroke,
                        strokeWidth: readOnly ? 0.5 : 0.9,
                        outline: "none",
                        cursor: readOnly ? "default" : "pointer",
                        filter: readOnly
                          ? undefined
                          : "drop-shadow(0 2px 6px rgba(220, 38, 38, 0.25))",
                      },
                      pressed: {
                        fill,
                        stroke,
                        strokeWidth: 1,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls — quiet ivory chip, no wheel/trackpad zoom. */}
      <div className="absolute top-3 right-3 flex flex-col bg-paper/95 backdrop-blur border border-ink/15">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          disabled={position.zoom >= MAX_ZOOM}
          className="w-9 h-9 flex items-center justify-center text-ink hover:bg-ink/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
        </button>
        <div className="h-px bg-ink/10 mx-1.5" aria-hidden />
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          disabled={position.zoom <= MIN_ZOOM}
          className="w-9 h-9 flex items-center justify-center text-ink hover:bg-ink/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" strokeWidth={2} />
        </button>
        <div className="h-px bg-ink/10 mx-1.5" aria-hidden />
        <button
          type="button"
          onClick={resetZoom}
          aria-label="Reset zoom"
          disabled={position.zoom === 1 && position.coordinates[0] === 10}
          className="w-9 h-9 flex items-center justify-center text-ink hover:bg-ink/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
        >
          <Maximize className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {hover && (
        <MapTooltip iso={hover.iso} name={hover.name} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}

// Four small L-shaped tick marks anchored to the corners of the map canvas.
// A modern, restrained alternative to a full vintage frame.
function CornerTicks() {
  const len = 14; // px
  const inset = 6; // px from edge
  const stroke = "rgba(15, 23, 42, 0.30)";
  const w = 1; // hairline thickness
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {/* top-left */}
      <span
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          width: len,
          height: w,
          background: stroke,
        }}
      />
      <span
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          width: w,
          height: len,
          background: stroke,
        }}
      />
      {/* top-right */}
      <span
        style={{
          position: "absolute",
          top: inset,
          right: inset,
          width: len,
          height: w,
          background: stroke,
        }}
      />
      <span
        style={{
          position: "absolute",
          top: inset,
          right: inset,
          width: w,
          height: len,
          background: stroke,
        }}
      />
      {/* bottom-left */}
      <span
        style={{
          position: "absolute",
          bottom: inset,
          left: inset,
          width: len,
          height: w,
          background: stroke,
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: inset,
          left: inset,
          width: w,
          height: len,
          background: stroke,
        }}
      />
      {/* bottom-right */}
      <span
        style={{
          position: "absolute",
          bottom: inset,
          right: inset,
          width: len,
          height: w,
          background: stroke,
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: inset,
          right: inset,
          width: w,
          height: len,
          background: stroke,
        }}
      />
    </div>
  );
}
