import { ImageResponse } from "next/og";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";

export const alt = "Faroway Best Time to Visit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }));
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  const climate = getClimateData(slug);

  const name = dest?.name || "Destination";
  const country = dest?.country || "";
  const bestMonths = climate?.bestMonths?.join(", ") || "Year-round";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #FAF8F3 0%, #EFF5F3 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "6px",
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
          justifyContent: "space-between",
          padding: "52px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: "linear-gradient(180deg, #F97066 0%, #E04D43 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="52" height="52" viewBox="0 0 1024 1024" fill="none">
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
                fontSize: "34px",
                fontWeight: 900,
                color: "#143D46",
                letterSpacing: "-0.5px",
              }}
            >
              Faroway
            </span>
          </div>
          <div
            style={{
              padding: "6px 18px",
              borderRadius: "20px",
              background: "#C03A31",
              color: "#FFFFFF",
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
            }}
          >
            Best Time to Visit
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              fontSize: name.length > 15 ? "62px" : "76px",
              fontWeight: 900,
              color: "#0F172A",
              lineHeight: 1.08,
              letterSpacing: "-1.5px",
              display: "flex",
            }}
          >
            {name}
          </div>
          {country ? (
            <div
              style={{
                fontSize: "28px",
                color: "#475569",
                fontWeight: 500,
                display: "flex",
              }}
            >
              {country}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                padding: "6px 18px",
                borderRadius: "20px",
                background: "#FFFFFF",
                border: "1px solid #DCE5E3",
                color: "#0F766E",
                fontSize: "20px",
                fontWeight: 600,
                display: "flex",
              }}
            >
              Best Months
            </div>
            <div
              style={{
                color: "#475569",
                fontSize: "22px",
                display: "flex",
              }}
            >
              {bestMonths}
            </div>
          </div>
        </div>

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
              gap: "10px",
              background: "#143D46",
              borderRadius: "40px",
              padding: "10px 24px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#F97066",
                display: "flex",
              }}
            />
            <span
              style={{ color: "#FFFFFF", fontSize: "20px", fontWeight: 600 }}
            >
              faroway.ai/tools/best-time-to-visit
            </span>
          </div>
          <span style={{ color: "#475569", fontSize: "18px", fontWeight: 500 }}>
            AI Travel Planner
          </span>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
