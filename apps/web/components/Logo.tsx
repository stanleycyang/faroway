import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Text color — use 'light' on dark backgrounds */
  variant?: "dark" | "light";
  /** Whether to wrap in a Link */
  asLink?: boolean;
  /** Destination route when rendered as a link */
  href?: string;
  /** Whether to render the "Faroway" wordmark next to the mark */
  showWordmark?: boolean;
  /** Hide the wordmark below the sm breakpoint */
  hideWordmarkOnMobile?: boolean;
  /** Show the "AI Travel Planner" descriptor under the wordmark */
  showTagline?: boolean;
  /** Extra className on the outer wrapper */
  className?: string;
}

const sizes = {
  sm: { px: 32, box: "w-8 h-8 rounded-lg", text: "text-lg" },
  md: { px: 36, box: "w-9 h-9 rounded-xl", text: "text-xl" },
  lg: { px: 48, box: "w-12 h-12 rounded-xl", text: "text-2xl" },
};

export function Logo({
  size = "md",
  variant = "dark",
  asLink = true,
  href = "/",
  showWordmark = true,
  hideWordmarkOnMobile = false,
  showTagline = false,
  className = "",
}: LogoProps) {
  const s = sizes[size];
  const textColor = variant === "dark" ? "text-[#143D46]" : "text-[#FFF5EE]";
  const taglineColor =
    variant === "dark" ? "text-slate-600" : "text-[#EFF5F3]/85";

  const content = (
    <>
      <Image
        src="/icon.png"
        alt=""
        aria-hidden="true"
        width={s.px}
        height={s.px}
        className={`${s.box} object-cover shadow-md shadow-primary/20`}
      />
      {showWordmark && (
        <span
          className={`flex flex-col leading-none ${hideWordmarkOnMobile ? "hidden sm:flex" : ""}`}
        >
          <span
            className={`font-editorial font-bold tracking-[-0.02em] ${s.text} ${textColor}`}
          >
            Faroway
          </span>
          {showTagline && (
            <span
              className={`mt-1 block text-[10px] font-sans font-semibold uppercase tracking-[0.2em] ${taglineColor}`}
            >
              AI Travel Planner
            </span>
          )}
        </span>
      )}
    </>
  );

  if (asLink) {
    return (
      <Link
        href={href}
        aria-label={href === "/" ? "Faroway home" : "Faroway"}
        className={`inline-flex items-center gap-2.5 group hover:opacity-90 transition-opacity ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {content}
    </div>
  );
}
