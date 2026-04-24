import { ImageResponse } from "next/og";
import { decodeProfileFromUrl } from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get("d");

  let name = "Your World Map";
  let totalVisited = 0;
  let continentsVisited = 0;

  if (d) {
    const decoded = decodeProfileFromUrl(d);
    if (decoded) {
      name = `${decoded.name}'s World Map`;
      const stats = computeStats(decoded.visits);
      totalVisited = stats.totalVisited;
      continentsVisited = stats.continentsVisited;
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, #fef3c7 0%, #fde68a 35%, #fbbf24 100%)",
        padding: "72px",
        position: "relative",
      }}
    >
      {/* Top brand strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          color: "#78350f",
          fontSize: "22px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <span>Faroway</span>
        <span style={{ color: "#b45309" }}>·</span>
        <span>World Map</span>
      </div>

      {/* Hero */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          marginTop: "40px",
        }}
      >
        <div
          style={{
            fontSize: name.length > 28 ? "76px" : "96px",
            fontWeight: 800,
            color: "#1f2937",
            lineHeight: 1.05,
            maxWidth: "1000px",
            display: "flex",
          }}
        >
          {name}
        </div>

        {totalVisited > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "64px",
              marginTop: "48px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "120px",
                  fontWeight: 800,
                  color: "#b91c1c",
                  lineHeight: 0.95,
                  display: "flex",
                }}
              >
                {totalVisited}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#92400e",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginTop: "12px",
                  display: "flex",
                }}
              >
                {totalVisited === 1 ? "Country" : "Countries"}
              </div>
            </div>

            <div
              style={{
                width: "2px",
                height: "100px",
                background: "#d97706",
                opacity: 0.4,
              }}
            />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "120px",
                  fontWeight: 800,
                  color: "#b91c1c",
                  lineHeight: 0.95,
                  display: "flex",
                }}
              >
                {continentsVisited}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#92400e",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginTop: "12px",
                  display: "flex",
                }}
              >
                {continentsVisited === 1 ? "Continent" : "Continents"}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: "32px",
              color: "#78350f",
              marginTop: "32px",
              maxWidth: "900px",
              display: "flex",
              lineHeight: 1.3,
            }}
          >
            Pin every country you&apos;ve visited — beautiful, private, and
            shareable.
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#78350f",
          fontSize: "24px",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex" }}>faroway.ai/tools/world-map</div>
        <div style={{ display: "flex", color: "#b45309" }}>
          Make yours — no sign-up
        </div>
      </div>
    </div>,
    { ...SIZE },
  );
}
