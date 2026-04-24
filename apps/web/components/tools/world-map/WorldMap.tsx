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
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
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

export function WorldMap({ visits, readOnly, onCountryClick }: WorldMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
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

  const containerStyle: CSSProperties = {
    background: `radial-gradient(ellipse at top, ${MAP_BG_TOP} 0%, ${MAP_BG_BOTTOM} 100%)`,
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-2xl ring-1 ring-slate-200/70 shadow-inner"
      style={containerStyle}
    >
      {/* Subtle paper grain — barely visible, adds atlas texture in PNG exports. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        width={980}
        height={500}
        style={{ width: "100%", height: "100%" }}
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
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHover({
                      iso,
                      name,
                      x: event.clientX - (rect?.left ?? 0),
                      y: event.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseMove={(event: ReactMouseEvent) => {
                    const rect = containerRef.current?.getBoundingClientRect();
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
      </ComposableMap>

      {hover && (
        <MapTooltip iso={hover.iso} name={hover.name} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}
