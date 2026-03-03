import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Faroway - AI-Powered Travel Planning";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle coral glow behind icon */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(249,112,102,0.18) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />

      {/* Dot grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "120px",
          height: "120px",
          borderRadius: "28px",
          background: "linear-gradient(135deg, #FF8A7A 0%, #F97066 100%)",
          marginBottom: "28px",
          boxShadow: "0 16px 48px rgba(249,112,102,0.4)",
        }}
      >
        <svg width="72" height="72" viewBox="0 0 110 110" fill="none">
          <circle cx="18" cy="72" r="4" fill="white" opacity="0.3" />
          <circle cx="28" cy="66" r="3.5" fill="white" opacity="0.4" />
          <circle cx="39" cy="61" r="3" fill="white" opacity="0.5" />
          <circle cx="50" cy="57" r="2.5" fill="white" opacity="0.55" />
          <circle cx="61" cy="54" r="2" fill="white" opacity="0.6" />
          <g transform="translate(58, 52) rotate(-35)">
            <polygon points="42,0 -22,-16 -14,0" fill="white" />
            <polygon points="42,0 -22,16 -14,0" fill="white" opacity="0.82" />
            <polygon points="-14,0 -22,16 -22,4" fill="white" opacity="0.45" />
          </g>
          <path d="M80,22 L82,27 L87,22 L82,17 Z" fill="white" opacity="0.9" />
          <path
            d="M88,30 L89.5,33 L93,30 L89.5,27 Z"
            fill="white"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "80px",
          fontWeight: "700",
          color: "white",
          margin: "0 0 12px 0",
          letterSpacing: "-3px",
        }}
      >
        faroway
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: "26px",
          color: "rgba(148,163,184,1)",
          margin: "0 0 40px 0",
          letterSpacing: "6px",
          textTransform: "uppercase",
        }}
      >
        AI Travel Planner
      </p>

      {/* Features */}
      <div
        style={{
          display: "flex",
          gap: "32px",
          color: "rgba(255,255,255,0.7)",
          fontSize: "20px",
        }}
      >
        <span>✈️ 60-second itineraries</span>
        <span>🗺️ 195+ countries</span>
        <span>✅ 100% Free</span>
      </div>

      {/* Bottom URL */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          color: "rgba(249,112,102,0.8)",
          fontSize: "18px",
          letterSpacing: "1px",
        }}
      >
        faroway.ai
      </div>
    </div>,
    { ...size },
  );
}
