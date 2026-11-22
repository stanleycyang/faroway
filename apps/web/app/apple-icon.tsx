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
        background: "linear-gradient(180deg, #F97066 0%, #E04D43 100%)",
      }}
    >
      <svg
        width="180"
        height="180"
        viewBox="0 0 1024 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 237 526 C 236 420 237 338 262 296 C 296 238 380 218 525 204 L 784 184 C 804 182 811 193 806 213 C 795 256 774 303 744 331 C 728 345 706 349 664 352 L 460 364 C 344 371 268 416 244 504 C 241 516 238 524 237 526 Z"
          fill="#FFF5EE"
        />
        <path
          d="M 238 528 C 254 486 308 463 402 454 L 728 434 C 746 433 753 443 748 463 C 737 506 716 547 686 567 C 668 579 642 581 598 584 L 444 592 C 396 595 379 612 379 658 L 379 746 C 379 814 342 846 276 846 L 245 846 C 238 846 235 843 235 836 L 235 612 C 235 568 236 538 238 528 Z"
          fill="#FFF5EE"
        />
      </svg>
    </div>,
    { ...size },
  );
}
