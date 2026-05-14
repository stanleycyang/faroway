/**
 * GET /api/og — Default social share image (1200×630)
 *
 * Optional query params:
 *   title  — override headline (max ~60 chars)
 *   desc   — override sub-copy
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

const interSemiBoldPromise = fetch(
  new URL("./world-map/fonts/inter-semibold.ttf", import.meta.url),
).then((r) => r.arrayBuffer());

const interRegularPromise = fetch(
  new URL("./world-map/fonts/inter-regular.ttf", import.meta.url),
).then((r) => r.arrayBuffer());

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "AI-Powered Travel Planning";
  const desc =
    searchParams.get("desc") ??
    "Plan your perfect trip with personalized day-by-day itineraries.";

  const [interSemiBold, interRegular] = await Promise.all([
    interSemiBoldPromise,
    interRegularPromise,
  ]);

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, #FF8A7A 0%, #F97066 50%, #E85D52 100%)",
        padding: "60px 80px",
        fontFamily: "Inter",
      }}
    >
      {/* Top label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "auto",
        }}
      >
        {/* Logo mark — circle with airplane silhouette */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ✈
        </div>
        <span
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: "-0.5px",
          }}
        >
          Faroway
        </span>
      </div>

      {/* Main headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          marginBottom: 60,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 600,
            color: "#ffffff",
            lineHeight: 1.1,
            letterSpacing: "-2px",
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 400,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
            maxWidth: 760,
          }}
        >
          {desc}
        </div>
      </div>

      {/* Bottom URL pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.18)",
          borderRadius: 40,
          padding: "10px 24px",
          alignSelf: "flex-start",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, color: "#ffffff" }}>
          faroway.ai
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: interSemiBold, weight: 600 },
        { name: "Inter", data: interRegular, weight: 400 },
      ],
    },
  );
}
