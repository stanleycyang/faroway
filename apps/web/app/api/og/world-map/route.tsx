import { ImageResponse } from "next/og";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { decodeProfileFromUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import { numericToAlpha3 } from "@/lib/tools/world-map/iso";
import topology from "@/lib/tools/world-map/topology.json";

export const runtime = "edge";

type Format = "landscape" | "square" | "story";

const SIZES: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

// One palette, no gradients, confident flat color.
const COLORS = {
  bg: "#FAF6EF",
  bgEdge: "#F0E9DA",
  ink: "#0F172A",
  inkSubtle: "#475569",
  inkFaint: "#94A3B8",
  visited: "#B91C1C",
  visitedEdge: "#7F1D1D",
  unvisitedEdge: "#D1D5DB",
  hairline: "rgba(15, 23, 42, 0.08)",
};

// Parse the topology once per edge instance — cold start amortizes across requests.
const TOPO = topology as unknown as Topology<{
  countries: GeometryCollection<{ name?: string }>;
}>;
const COUNTRIES_GEOJSON = feature(
  TOPO,
  TOPO.objects.countries,
) as FeatureCollection<Geometry, { name?: string }>;

interface MapPath {
  d: string;
  visited: boolean;
}

function buildMapPaths(
  width: number,
  height: number,
  visitedSet: Set<string>,
): MapPath[] {
  const projection = geoEqualEarth().fitSize(
    [width, height],
    COUNTRIES_GEOJSON,
  );
  const path = geoPath(projection);
  const out: MapPath[] = [];
  for (const feat of COUNTRIES_GEOJSON.features) {
    const id = String(feat.id ?? "");
    const iso = numericToAlpha3(id);
    const d = path(feat);
    if (!d) continue;
    out.push({ d, visited: Boolean(iso && visitedSet.has(iso)) });
  }
  // Render unvisited first so visited countries paint on top of neighbours.
  return out.sort((a, b) => Number(a.visited) - Number(b.visited));
}

function MapSvg({
  width,
  height,
  paths,
}: {
  width: number;
  height: number;
  paths: MapPath[];
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.visited ? COLORS.visited : "transparent"}
          stroke={p.visited ? COLORS.visitedEdge : COLORS.unvisitedEdge}
          strokeWidth={p.visited ? 0.8 : 0.55}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

interface CardData {
  name: string;
  totalVisited: number;
  continentsVisited: number;
  totalCountries: number;
  continentsTotal: number;
  percent: number;
  visitedSet: Set<string>;
  year: string;
}

function buildCardData(d: string | null): CardData {
  let name = "Your World Map";
  let visits: Record<string, unknown> = {};
  let visitedSet = new Set<string>();

  if (d) {
    const decoded = decodeProfileFromUrl(d);
    if (decoded) {
      name = `${decoded.name}'s World`;
      visits = decoded.visits;
      visitedSet = new Set(Object.keys(decoded.visits));
    }
  }

  const stats = computeStats(visits as Parameters<typeof computeStats>[0]);
  const percent = stats.totalCountries
    ? Math.round((stats.totalVisited / stats.totalCountries) * 100)
    : 0;

  return {
    name,
    totalVisited: stats.totalVisited,
    continentsVisited: stats.continentsVisited,
    totalCountries: stats.totalCountries,
    continentsTotal: stats.continentsTotal,
    percent,
    visitedSet,
    year: String(new Date().getUTCFullYear()),
  };
}

// ---- Layouts -----------------------------------------------------------

function LandscapeCard({ data }: { data: CardData }) {
  const W = SIZES.landscape.width;
  const H = SIZES.landscape.height;
  const paths = buildMapPaths(W, H, data.visitedSet);

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 55%, ${COLORS.bgEdge} 100%)`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MapSvg width={W} height={H} paths={paths} />
      </div>

      {/* stat plate */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 56,
          padding: "32px 36px",
          background: "rgba(250, 246, 239, 0.92)",
          border: `1px solid ${COLORS.hairline}`,
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          maxWidth: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: COLORS.inkFaint,
          }}
        >
          {data.name}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginTop: 12,
            color: COLORS.ink,
          }}
        >
          <div
            style={{
              fontSize: 128,
              fontWeight: 700,
              letterSpacing: "-0.05em",
              fontFamily: "serif",
              lineHeight: 0.9,
              display: "flex",
            }}
          >
            {data.totalVisited}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              color: COLORS.inkFaint,
              display: "flex",
            }}
          >
            / {data.totalCountries}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: COLORS.inkSubtle,
            marginTop: 8,
          }}
        >
          {data.totalVisited === 1 ? "country" : "countries"} ·{" "}
          {data.continentsVisited} of {data.continentsTotal} continents
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${COLORS.hairline}`,
            fontSize: 16,
            color: COLORS.ink,
            fontWeight: 600,
          }}
        >
          {data.percent}% of the world
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 56,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          color: COLORS.inkSubtle,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: COLORS.visited,
            display: "flex",
          }}
        />
        faroway.ai · world map
      </div>
    </div>
  );
}

function SquareCard({ data }: { data: CardData }) {
  const W = SIZES.square.width;
  const H = SIZES.square.height;
  const mapW = W - 96;
  const mapH = 580;
  const paths = buildMapPaths(mapW, mapH, data.visitedSet);

  return (
    <div
      style={{
        width: W,
        height: H,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        padding: "56px 48px 48px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLORS.inkFaint,
        }}
      >
        <span style={{ display: "flex" }}>{data.name}</span>
        <span style={{ display: "flex", color: COLORS.inkSubtle }}>
          {data.year}
        </span>
      </div>

      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: mapW,
          height: mapH,
        }}
      >
        <MapSvg width={mapW} height={mapH} paths={paths} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          marginTop: 24,
          color: COLORS.ink,
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            fontFamily: "serif",
            lineHeight: 0.85,
            display: "flex",
          }}
        >
          {data.totalVisited}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: COLORS.inkFaint,
            marginLeft: 16,
            marginBottom: 24,
            display: "flex",
          }}
        >
          / {data.totalCountries}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 26,
          color: COLORS.inkSubtle,
          marginTop: 4,
        }}
      >
        {data.totalVisited === 1 ? "country" : "countries"} ·{" "}
        {data.continentsVisited}/{data.continentsTotal} continents ·{" "}
        <span style={{ display: "flex", color: COLORS.visited, marginLeft: 8 }}>
          {data.percent}% of the world
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 48,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 16,
          color: COLORS.inkSubtle,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: COLORS.visited,
            display: "flex",
          }}
        />
        faroway.ai
      </div>
    </div>
  );
}

function StoryCard({ data }: { data: CardData }) {
  const W = SIZES.story.width;
  const H = SIZES.story.height;
  const mapW = W - 96;
  const mapH = 880;
  const paths = buildMapPaths(mapW, mapH, data.visitedSet);

  return (
    <div
      style={{
        width: W,
        height: H,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        padding: "120px 48px 80px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: COLORS.inkFaint,
        }}
      >
        {data.name}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 60,
          color: COLORS.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div
            style={{
              fontSize: 360,
              fontWeight: 700,
              letterSpacing: "-0.06em",
              fontFamily: "serif",
              lineHeight: 0.85,
              display: "flex",
            }}
          >
            {data.totalVisited}
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 500,
              color: COLORS.inkFaint,
              display: "flex",
            }}
          >
            / {data.totalCountries}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: COLORS.inkSubtle,
            marginTop: 20,
          }}
        >
          {data.totalVisited === 1 ? "country" : "countries"}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: COLORS.inkSubtle,
            marginTop: 16,
          }}
        >
          {data.continentsVisited}/{data.continentsTotal} continents ·{" "}
          <span
            style={{ display: "flex", color: COLORS.visited, marginLeft: 8 }}
          >
            {data.percent}% of the world
          </span>
        </div>
      </div>

      <div
        style={{
          width: 60,
          height: 3,
          background: COLORS.visited,
          marginTop: 56,
          marginBottom: 56,
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: mapW,
          height: mapH,
        }}
      >
        <MapSvg width={mapW} height={mapH} paths={paths} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 48,
          right: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 22,
          color: COLORS.inkSubtle,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex" }}>faroway.ai · world map</div>
        <div style={{ display: "flex", color: COLORS.inkFaint }}>
          {data.year}
        </div>
      </div>
    </div>
  );
}

// ---- Handler -----------------------------------------------------------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get("d");
  const fmtParam = (url.searchParams.get("format") ?? "landscape") as Format;
  const format: Format =
    fmtParam === "square" || fmtParam === "story" ? fmtParam : "landscape";
  const size = SIZES[format];

  const data = buildCardData(d);

  const card =
    format === "square" ? (
      <SquareCard data={data} />
    ) : format === "story" ? (
      <StoryCard data={data} />
    ) : (
      <LandscapeCard data={data} />
    );

  return new ImageResponse(card, {
    ...size,
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=31536000",
    },
  });
}
