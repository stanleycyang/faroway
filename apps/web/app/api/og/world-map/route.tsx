import { ImageResponse } from "next/og";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { decodeProfileFromUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import { numericToAlpha3 } from "@/lib/tools/world-map/iso";
import { PALETTE } from "@/lib/tools/world-map/palette";
import topology from "@/lib/tools/world-map/topology.json";

export const runtime = "edge";

// ---- Fonts -------------------------------------------------------------
// Without a real serif loaded, Satori falls back to whatever system serif
// the runtime offers — which is exactly why the cards looked generic.
// Playfair Display (variable) carries the hero numeral; Inter handles all
// supporting type. Files live next to the route and are bundled into the
// function via `new URL(..., import.meta.url)`.

const playfairBlackPromise = fetch(
  new URL("./fonts/playfair-display.woff", import.meta.url),
).then((r) => r.arrayBuffer());
const interRegularPromise = fetch(
  new URL("./fonts/inter-regular.ttf", import.meta.url),
).then((r) => r.arrayBuffer());
const interSemiBoldPromise = fetch(
  new URL("./fonts/inter-semibold.ttf", import.meta.url),
).then((r) => r.arrayBuffer());
const interBoldPromise = fetch(
  new URL("./fonts/inter-bold.ttf", import.meta.url),
).then((r) => r.arrayBuffer());

// ---- Layout config -----------------------------------------------------

type Format = "landscape" | "square" | "story";

const SIZES: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const COLORS = {
  bg: PALETTE.paper,
  bgEdge: PALETTE.paperEdge,
  ink: PALETTE.ink,
  inkSubtle: PALETTE.inkSubtle,
  inkFaint: PALETTE.inkFaint,
  visited: PALETTE.visited,
  visitedEdge: PALETTE.visitedEdge,
  unvisitedEdge: PALETTE.unvisitedEdge,
  hairline: PALETTE.hairline,
};

const FONTS = {
  display: "Playfair Display",
  ui: "Inter",
};

// ---- Topology + projection ---------------------------------------------

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
          strokeWidth={p.visited ? 0.9 : 0.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ---- Card data ---------------------------------------------------------

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
  let name = "Your World";
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

// ---- Shared bits -------------------------------------------------------

function Eyebrow({
  children,
  fontSize = 16,
  color = COLORS.inkFaint,
}: {
  children: React.ReactNode;
  fontSize?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontFamily: FONTS.ui,
        fontWeight: 700,
        fontSize,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

function BrandMark({
  fontSize = 14,
  color = COLORS.inkSubtle,
}: {
  fontSize?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: FONTS.ui,
        fontWeight: 700,
        fontSize,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: COLORS.visited,
          display: "flex",
        }}
      />
      faroway.ai · world map
    </div>
  );
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
        position: "relative",
        background: COLORS.bg,
        display: "flex",
        fontFamily: FONTS.ui,
      }}
    >
      {/* paper vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, ${COLORS.bgEdge} 100%)`,
          display: "flex",
        }}
      />

      {/* map fills the whole canvas */}
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

      {/* stat plate — sits on top of the map, top-left corner */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 56,
          padding: "28px 36px 30px",
          background: "rgba(250, 246, 239, 0.94)",
          border: `1px solid ${COLORS.hairline}`,
          borderRadius: 24,
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
          display: "flex",
          flexDirection: "column",
          maxWidth: 480,
        }}
      >
        <Eyebrow fontSize={13}>
          <span style={{ display: "flex" }}>{data.name}</span>
          <span
            style={{
              display: "flex",
              margin: "0 12px",
              color: COLORS.inkFaint,
            }}
          >
            ·
          </span>
          <span style={{ display: "flex" }}>{data.year}</span>
        </Eyebrow>

        <div
          style={{ display: "flex", flexDirection: "column", marginTop: 12 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              paddingBottom: 32,
              color: COLORS.ink,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.display,
                fontWeight: 900,
                fontSize: 168,
                letterSpacing: "-0.05em",
                lineHeight: 0.85,
                display: "flex",
              }}
            >
              {data.totalVisited}
            </div>
            <div
              style={{
                fontFamily: FONTS.ui,
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.inkFaint,
                marginLeft: 14,
                display: "flex",
              }}
            >
              / {data.totalCountries}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.inkSubtle,
            }}
          >
            <span style={{ display: "flex" }}>
              {data.totalVisited === 1 ? "country" : "countries"}
            </span>
            <span style={{ display: "flex", color: COLORS.inkFaint }}>·</span>
            <span style={{ display: "flex" }}>
              {data.continentsVisited}/{data.continentsTotal} continents
            </span>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 14,
              paddingTop: 14,
              borderTop: `1px solid ${COLORS.hairline}`,
              fontSize: 16,
              fontWeight: 700,
              color: COLORS.visited,
            }}
          >
            {data.percent}% of the world
          </div>
        </div>
      </div>

      {/* brand mark on its own translucent chip, bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 56,
          padding: "10px 16px",
          background: "rgba(250, 246, 239, 0.92)",
          border: `1px solid ${COLORS.hairline}`,
          borderRadius: 999,
          display: "flex",
        }}
      >
        <BrandMark fontSize={13} />
      </div>
    </div>
  );
}

function SquareCard({ data }: { data: CardData }) {
  const W = SIZES.square.width;
  const H = SIZES.square.height;
  const mapW = W - 96;
  const mapH = 540;
  const paths = buildMapPaths(mapW, mapH, data.visitedSet);

  return (
    <div
      style={{
        width: W,
        height: H,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        padding: "64px 48px 56px",
        position: "relative",
        fontFamily: FONTS.ui,
      }}
    >
      {/* eyebrow row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Eyebrow fontSize={18}>{data.name}</Eyebrow>
        <Eyebrow fontSize={18} color={COLORS.inkSubtle}>
          {data.year}
        </Eyebrow>
      </div>

      {/* hero stat — its own row, with explicit bottom padding so the
          Playfair Black descender of digits like 3, 4, 7, 9 can't reach
          into the tagline below. Satori's flex-end alignment + tight
          line-height makes this otherwise unpredictable. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          marginTop: 24,
          paddingBottom: 56,
          color: COLORS.ink,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 900,
            fontSize: 220,
            letterSpacing: "-0.05em",
            lineHeight: 0.85,
            display: "flex",
          }}
        >
          {data.totalVisited}
        </div>
        <div
          style={{
            fontFamily: FONTS.ui,
            fontWeight: 600,
            fontSize: 40,
            color: COLORS.inkFaint,
            marginLeft: 14,
            marginBottom: 18,
            display: "flex",
          }}
        >
          / {data.totalCountries}
        </div>
      </div>

      {/* tagline — own row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.inkSubtle,
        }}
      >
        <span style={{ display: "flex" }}>
          {data.totalVisited === 1 ? "country" : "countries"}
        </span>
        <span style={{ display: "flex", color: COLORS.inkFaint }}>·</span>
        <span style={{ display: "flex" }}>
          {data.continentsVisited}/{data.continentsTotal} continents
        </span>
        <span style={{ display: "flex", color: COLORS.inkFaint }}>·</span>
        <span style={{ display: "flex", color: COLORS.visited }}>
          {data.percent}% of the world
        </span>
      </div>

      {/* map block */}
      <div
        style={{
          marginTop: 36,
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
          bottom: 32,
          right: 48,
          display: "flex",
        }}
      >
        <BrandMark fontSize={15} />
      </div>
    </div>
  );
}

function StoryCard({ data }: { data: CardData }) {
  const W = SIZES.story.width;
  const H = SIZES.story.height;
  const mapW = W - 96;
  const mapH = 920;
  const paths = buildMapPaths(mapW, mapH, data.visitedSet);

  return (
    <div
      style={{
        width: W,
        height: H,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        padding: "140px 48px 100px",
        position: "relative",
        fontFamily: FONTS.ui,
      }}
    >
      <Eyebrow fontSize={22}>{data.name}</Eyebrow>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 56,
          color: COLORS.ink,
        }}
      >
        {/* Hero row gets explicit paddingBottom so the Playfair descender
            of the numeral never clips into the lines below, no matter what
            digits show up. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            paddingBottom: 110,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: 900,
              fontSize: 420,
              letterSpacing: "-0.06em",
              lineHeight: 0.82,
              display: "flex",
            }}
          >
            {data.totalVisited}
          </div>
          <div
            style={{
              fontFamily: FONTS.ui,
              fontWeight: 600,
              fontSize: 64,
              color: COLORS.inkFaint,
              marginLeft: 24,
              marginBottom: 36,
              display: "flex",
            }}
          >
            / {data.totalCountries}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 38,
            fontWeight: 600,
            color: COLORS.inkSubtle,
          }}
        >
          {data.totalVisited === 1 ? "country" : "countries"}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.inkSubtle,
            marginTop: 14,
          }}
        >
          <span style={{ display: "flex" }}>
            {data.continentsVisited}/{data.continentsTotal} continents
          </span>
          <span style={{ display: "flex", color: COLORS.inkFaint }}>·</span>
          <span style={{ display: "flex", color: COLORS.visited }}>
            {data.percent}% of the world
          </span>
        </div>
      </div>

      <div
        style={{
          width: 60,
          height: 3,
          background: COLORS.visited,
          marginTop: 52,
          marginBottom: 52,
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
          bottom: 72,
          left: 48,
          right: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BrandMark fontSize={20} />
        <Eyebrow fontSize={20}>{data.year}</Eyebrow>
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

  const [playfairBlack, interRegular, interSemiBold, interBold] =
    await Promise.all([
      playfairBlackPromise,
      interRegularPromise,
      interSemiBoldPromise,
      interBoldPromise,
    ]);

  return new ImageResponse(card, {
    ...size,
    fonts: [
      {
        name: "Playfair Display",
        data: playfairBlack,
        weight: 900,
        style: "normal",
      },
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=31536000",
    },
  });
}
