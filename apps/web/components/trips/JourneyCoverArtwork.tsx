/** Decorative atlas artwork, deliberately not a map of the destination. */
export function JourneyCoverArtwork() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect width="1200" height="600" fill="#173b52" />
      <path
        d="M590-60C820 80 680 170 840 290s360 70 430 220V-60Z"
        fill="#236578"
      />
      <path
        d="M800-60C1010 100 850 180 1010 300s200 100 260 210V-60Z"
        fill="#347f87"
      />
      <g fill="none" stroke="#b5d9d5" strokeWidth="1" opacity=".28">
        <path d="M550-60C780 80 640 170 800 290s360 70 430 220" />
        <path d="M510-60C740 80 600 170 760 290s360 70 430 220" />
        <path d="M470-60C700 80 560 170 720 290s360 70 430 220" />
        <path d="M430-60C660 80 520 170 680 290s360 70 430 220" />
        <path d="M840-60C1050 100 890 180 1050 300s200 100 260 210" />
        <path d="M880-60C1090 100 930 180 1090 300s200 100 260 210" />
      </g>
      <path
        d="M660 465C680 350 960 420 1010 155"
        fill="none"
        stroke="#f3dfb6"
        strokeWidth="2"
        strokeDasharray="5 9"
        opacity=".65"
      />
      <g fill="#f3dfb6">
        <circle cx="660" cy="465" r="5" />
        <circle cx="1010" cy="155" r="5" />
      </g>
      <circle
        cx="1010"
        cy="155"
        r="14"
        fill="none"
        stroke="#f3dfb6"
        opacity=".5"
      />
    </svg>
  );
}
