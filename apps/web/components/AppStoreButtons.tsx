import Link from "next/link";
import {
  APP_STORE_URL,
  HAS_MOBILE_STORE_LINKS,
  PLAY_STORE_URL,
} from "@/lib/store-links";

interface AppStoreButtonsProps {
  className?: string;
  variant?: "glass" | "solid";
}

export function AppStoreButtons({
  className = "",
  variant = "glass",
}: AppStoreButtonsProps) {
  const base =
    variant === "solid"
      ? "bg-white/15 hover:bg-white/25 border border-white/20"
      : "bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08]";
  const buttonClass = `inline-flex items-center gap-3 ${base} px-5 py-3 rounded-2xl font-semibold text-white transition-all backdrop-blur-sm hover:-translate-y-0.5`;

  if (!HAS_MOBILE_STORE_LINKS) {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        <Link href="/support" className={buttonClass}>
          <span aria-hidden="true" className="text-2xl">
            📱
          </span>
          <span className="text-left">
            <span className="block text-[10px] opacity-70">
              MOBILE APPS IN PRIVATE PREVIEW
            </span>
            <span className="block text-base leading-tight">
              Join launch updates
            </span>
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {APP_STORE_URL ? (
        <a href={APP_STORE_URL} className={buttonClass}>
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          <span className="text-left">
            <span className="block text-[10px] opacity-70">
              Download on the
            </span>
            <span className="block text-base leading-tight">App Store</span>
          </span>
        </a>
      ) : null}
      {PLAY_STORE_URL ? (
        <a href={PLAY_STORE_URL} className={buttonClass}>
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
          </svg>
          <span className="text-left">
            <span className="block text-[10px] opacity-70">GET IT ON</span>
            <span className="block text-base leading-tight">Google Play</span>
          </span>
        </a>
      ) : null}
    </div>
  );
}
