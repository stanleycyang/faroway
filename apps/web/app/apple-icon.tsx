import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #FF8A7A 0%, #F97066 100%)",
        borderRadius: "40px",
      }}
    >
      {/* Paper airplane SVG as inline */}
      <svg
        width="110"
        height="110"
        viewBox="0 0 110 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dotted trail */}
        <circle cx="18" cy="72" r="4" fill="white" opacity="0.3" />
        <circle cx="28" cy="66" r="3.5" fill="white" opacity="0.4" />
        <circle cx="39" cy="61" r="3" fill="white" opacity="0.5" />
        <circle cx="50" cy="57" r="2.5" fill="white" opacity="0.55" />
        <circle cx="61" cy="54" r="2" fill="white" opacity="0.6" />
        <circle cx="72" cy="52" r="1.5" fill="white" opacity="0.65" />
        {/* Paper airplane pointing upper-right */}
        <g transform="translate(58, 52) rotate(-35)">
          <polygon points="42,0 -22,-16 -14,0" fill="white" />
          <polygon points="42,0 -22,16 -14,0" fill="white" opacity="0.82" />
          <polygon points="-14,0 -22,16 -22,4" fill="white" opacity="0.45" />
        </g>
        {/* Sparkles */}
        <path d="M80,22 L82,27 L87,22 L82,17 Z" fill="white" opacity="0.9" />
        <path
          d="M88,30 L89.5,33 L93,30 L89.5,27 Z"
          fill="white"
          opacity="0.8"
        />
        <path
          d="M76,32 L77,34.5 L80,32 L77,29.5 Z"
          fill="white"
          opacity="0.7"
        />
      </svg>
    </div>,
    { ...size },
  );
}
