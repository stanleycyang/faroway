import { ImageResponse } from "next/og";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fonts: Promise<[Buffer, Buffer]> | undefined;
function readFonts() {
  fonts ??= Promise.all([
    readFile(
      join(process.cwd(), "app/api/og/world-map/fonts/inter-semibold.ttf"),
    ),
    readFile(
      join(process.cwd(), "app/api/og/world-map/fonts/inter-regular.ttf"),
    ),
  ]).catch((error) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

export async function createSocialImage(
  headline: string | null = null,
  description: string | null = null,
) {
  const boundedText = (
    value: string | null,
    fallback: string,
    limit: number,
  ) => {
    const normalized = value?.replace(/\s+/g, " ").trim() || fallback;
    const points = Array.from(normalized);
    return points.length <= limit
      ? normalized
      : `${points
          .slice(0, limit - 1)
          .join("")
          .trimEnd()}…`;
  };
  const title = boundedText(headline, "A journey, shaped around you.", 90);
  const desc = boundedText(
    description,
    "Your places. Your pace. A thoughtful itinerary, ready to explore.",
    160,
  );

  const [interSemiBold, interRegular] = await readFonts();

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #F7F4ED 0%, #EEE7DC 100%)",
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
            background: "#DDE5DF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#253A34"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.8 8.2 21 3l-5.2 3.2-4.6-1.4-1.4 1.4 3.3 2.7-4.2 4.2-3.3-.7-1.4 1.4 4.1 2.7 2.7 4.1 1.4-1.4-.7-3.3 4.2-4.2 2.7 3.3 1.4-1.4-1.4-4.6Z" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: "#253A34",
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
          marginBottom: 40,
        }}
      >
        <div
          style={{
            fontSize: 60,
            fontWeight: 600,
            color: "#253A34",
            lineHeight: 1.1,
            letterSpacing: "-2px",
            maxWidth: 980,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: "#53645D",
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
          background: "#253A34",
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
        {
          name: "Inter",
          data: new Uint8Array(interSemiBold).buffer,
          weight: 600,
        },
        {
          name: "Inter",
          data: new Uint8Array(interRegular).buffer,
          weight: 400,
        },
      ],
    },
  );
}
