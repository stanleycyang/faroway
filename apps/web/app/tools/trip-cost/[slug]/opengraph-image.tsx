import { ImageResponse } from "next/og";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getCostProfile, getCostLevel } from "@/lib/tools/cost-data";
import { BUDGET_RANGES } from "@faroway/constants";

export const alt = "Faroway Trip Cost Calculator";
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
  const costProfile = getCostProfile(slug);

  const name = dest?.name || "Destination";
  const country = dest?.country || "";
  const costLevel = costProfile
    ? getCostLevel(costProfile.costMultiplier)
    : "Moderate";
  const dailyRate = costProfile
    ? Math.round(BUDGET_RANGES.moderate.daily * costProfile.costMultiplier)
    : BUDGET_RANGES.moderate.daily;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "60px",
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      <div style={{ display: "flex", marginBottom: "20px" }}>
        <div
          style={{
            padding: "6px 16px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #f97316, #f59e0b)",
            color: "white",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          Trip Cost
        </div>
      </div>

      <div
        style={{
          fontSize: name.length > 15 ? "64px" : "80px",
          fontWeight: 800,
          color: "#f3f4f6",
          lineHeight: 1.1,
          marginBottom: "8px",
          display: "flex",
        }}
      >
        {name}
      </div>

      <div
        style={{
          fontSize: "28px",
          color: "#9ca3af",
          marginBottom: "16px",
          display: "flex",
        }}
      >
        {country}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            padding: "6px 16px",
            borderRadius: "20px",
            background: "rgba(249,115,22,0.2)",
            border: "1px solid rgba(249,115,22,0.3)",
            color: "#fb923c",
            fontSize: "20px",
            fontWeight: 600,
            display: "flex",
          }}
        >
          {costLevel}
        </div>
        <div style={{ color: "#6b7280", fontSize: "22px", display: "flex" }}>
          {`~$${dailyRate}/day`}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #f97316, #f59e0b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          TG
        </div>
        <div
          style={{
            color: "#6b7280",
            fontSize: "20px",
            fontWeight: 500,
            display: "flex",
          }}
        >
          faroway.ai/tools/trip-cost
        </div>
      </div>
    </div>,
    { ...size },
  );
}
