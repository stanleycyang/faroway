"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { numericToAlpha3 } from "@/lib/tools/world-map/iso";
import { STATUS_CONFIG, THEMES, UNVISITED_STROKE } from "@/lib/tools/world-map/status";
import type { CountryVisit, Theme } from "@/lib/tools/world-map/types";
import { MapTooltip } from "./MapTooltip";

const GEO_URL = "/world-map/countries-110m.json";

interface HoverState {
  iso: string;
  name: string;
  x: number;
  y: number;
}

interface WorldMapProps {
  visits: Record<string, CountryVisit>;
  theme: Theme;
  readOnly?: boolean;
  onCountryClick?: (iso: string, name: string) => void;
  highlightContinent?: string | null;
  getCountryContinent?: (iso: string) => string | undefined;
}

export function WorldMap({
  visits,
  theme,
  readOnly,
  onCountryClick,
  highlightContinent,
  getCountryContinent,
}: WorldMapProps) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [position, setPosition] = useState<{
    coordinates: [number, number];
    zoom: number;
  }>({ coordinates: [10, 20], zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const themeCfg = THEMES[theme];

  // Reset hover on unmount / touch.
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
    setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.4, 8) }));
  const zoomOut = () =>
    setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.4, 1) }));
  const resetZoom = () => setPosition({ coordinates: [10, 20], zoom: 1 });

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      background: `linear-gradient(180deg, ${themeCfg.ocean} 0%, ${themeCfg.mapBg} 100%)`,
    }),
    [themeCfg],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl ring-1 ring-slate-200/60 shadow-inner"
      style={containerStyle}
    >
      {/* Soft grid overlay for "atlas" feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155 }}
        width={980}
        height={500}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const iso = numericToAlpha3(geo.id as string);
                const visit = iso ? visits[iso] : undefined;
                const cfg = visit ? STATUS_CONFIG[visit.status] : null;
                const isDimmed =
                  highlightContinent &&
                  getCountryContinent &&
                  iso &&
                  getCountryContinent(iso) !== highlightContinent;

                const fill = cfg ? cfg.fill : themeCfg.unvisitedFill;
                const stroke = cfg
                  ? cfg.stroke
                  : theme === "dark"
                    ? "#475569"
                    : UNVISITED_STROKE;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(event) => {
                      if (!iso) return;
                      const rect =
                        containerRef.current?.getBoundingClientRect();
                      setHover({
                        iso,
                        name:
                          (geo.properties as { name?: string }).name ?? iso,
                        x: event.clientX - (rect?.left ?? 0),
                        y: event.clientY - (rect?.top ?? 0),
                      });
                    }}
                    onMouseMove={(event) => {
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
                      onCountryClick(
                        iso,
                        (geo.properties as { name?: string }).name ?? iso,
                      );
                    }}
                    style={{
                      default: {
                        fill,
                        stroke,
                        strokeWidth: 0.5,
                        strokeDasharray: cfg?.dashed ? "2 2" : undefined,
                        outline: "none",
                        opacity: isDimmed ? 0.25 : 1,
                        transition:
                          "fill 160ms ease, opacity 160ms ease, filter 160ms ease",
                      },
                      hover: {
                        fill,
                        stroke,
                        strokeWidth: readOnly ? 0.5 : 0.9,
                        outline: "none",
                        cursor: readOnly ? "default" : "pointer",
                        filter: readOnly
                          ? undefined
                          : "brightness(1.08) drop-shadow(0 1px 2px rgba(0,0,0,0.18))",
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

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 bg-white/90 backdrop-blur rounded-xl p-1 shadow-lg ring-1 ring-slate-200/60">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          aria-label="Reset zoom"
          className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-xs font-semibold"
        >
          1:1
        </button>
      </div>

      {hover && (
        <MapTooltip iso={hover.iso} name={hover.name} x={hover.x} y={hover.y} />
      )}
    </div>
  );
}
