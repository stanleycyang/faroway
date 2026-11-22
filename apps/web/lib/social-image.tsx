import { ImageResponse } from "next/og";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fonts: Promise<[Buffer, Buffer, Buffer]> | undefined;
function readFonts() {
  fonts ??= Promise.all([
    readFile(
      join(process.cwd(), "app/api/og/world-map/fonts/playfair-display.woff"),
    ),
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

  const [playfairDisplay, interSemiBold, interRegular] = await readFonts();

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #FAF8F3 0%, #EFF5F3 100%)",
        fontFamily: "Inter",
      }}
    >
      {/* Top brand accent bar */}
      <div
        style={{
          width: "100%",
          height: 6,
          display: "flex",
          background:
            "linear-gradient(90deg, #F97066 0%, #E04D43 50%, #143D46 100%)",
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "56px 80px 58px",
        }}
      >
        {/* Top brand lockup */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: "auto",
          }}
        >
          {/* Route-F rounded-square badge */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(180deg, #F97066 0%, #E04D43 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 1024 1024" fill="none">
              <path
                d="M 237 526 C 236 420 237 338 262 296 C 296 238 380 218 525 204 L 784 184 C 804 182 811 193 806 213 C 795 256 774 303 744 331 C 728 345 706 349 664 352 L 460 364 C 344 371 268 416 244 504 C 241 516 238 524 237 526 Z"
                fill="#FFF5EE"
              />
              <path
                d="M 238 528 C 254 486 308 463 402 454 L 728 434 C 746 433 753 443 748 463 C 737 506 716 547 686 567 C 668 579 642 581 598 584 L 444 592 C 396 595 379 612 379 658 L 379 746 C 379 814 342 846 276 846 L 245 846 C 238 846 235 843 235 836 L 235 612 C 235 568 236 538 238 528 Z"
                fill="#FFF5EE"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "Playfair Display",
              fontSize: 36,
              fontWeight: 900,
              color: "#143D46",
              letterSpacing: "-0.5px",
            }}
          >
            Faroway
          </span>
        </div>

        {/* Main editorial headline */}
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
              fontFamily: "Playfair Display",
              fontSize: title.length > 48 ? 54 : 64,
              fontWeight: 900,
              color: "#0F172A",
              lineHeight: 1.08,
              letterSpacing: "-1.5px",
              maxWidth: 980,
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 26,
              fontWeight: 400,
              color: "#475569",
              lineHeight: 1.4,
              maxWidth: 780,
            }}
          >
            {desc}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#143D46",
              borderRadius: 40,
              padding: "12px 26px",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#F97066",
                display: "flex",
              }}
            />
            <span style={{ fontSize: 22, fontWeight: 600, color: "#FFFFFF" }}>
              faroway.ai
            </span>
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#0F766E",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            AI Travel Planner
          </span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Playfair Display",
          data: new Uint8Array(playfairDisplay).buffer,
          weight: 900,
          style: "normal",
        },
        {
          name: "Inter",
          data: new Uint8Array(interSemiBold).buffer,
          weight: 600,
          style: "normal",
        },
        {
          name: "Inter",
          data: new Uint8Array(interRegular).buffer,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
}
