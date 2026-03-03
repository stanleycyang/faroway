import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Text color — use 'light' on dark backgrounds */
  variant?: "dark" | "light";
  /** Whether to wrap in a Link to "/" */
  asLink?: boolean;
  /** Extra className on the outer wrapper */
  className?: string;
}

const sizes = {
  sm: { px: 32, box: "w-8 h-8 rounded-lg", icon: "w-4 h-4", text: "text-base" },
  md: { px: 36, box: "w-9 h-9 rounded-xl", icon: "w-5 h-5", text: "text-lg" },
  lg: { px: 48, box: "w-12 h-12 rounded-xl", icon: "w-6 h-6", text: "text-2xl" },
};

export function Logo({
  size = "md",
  variant = "dark",
  asLink = true,
  className = "",
}: LogoProps) {
  const s = sizes[size];
  const textColor = variant === "dark" ? "text-slate-900" : "text-white";

  const content = (
    <>
      <Image
        src="/icon.png"
        alt="Faroway logo"
        width={s.px}
        height={s.px}
        className={`${s.box} object-cover shadow-lg shadow-primary/25`}
      />
      <span className={`${s.text} font-bold ${textColor}`}>Faroway</span>
    </>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className={`flex items-center gap-2.5 group hover:opacity-90 transition-opacity ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>{content}</div>
  );
}
