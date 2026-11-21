import type { ClusterDefinition } from "@/lib/blog/clusters";

export const GUIDE_ACCENTS: Record<
  ClusterDefinition["accent"],
  {
    pill: string;
    text: string;
    iconBg: string;
    stepBg: string;
    lineBg: string;
    hoverShadow: string;
    overlay: string;
    ctaSection: string;
  }
> = {
  coral: {
    pill: "bg-primary-50 text-primary-800 border border-primary-200",
    text: "text-primary-700",
    iconBg: "bg-primary-50",
    stepBg: "bg-[#C03A31]",
    lineBg: "bg-primary-200",
    hoverShadow: "hover:shadow-primary-700/10",
    overlay: "bg-[#143D46]/30",
    ctaSection: "bg-[#143D46]",
  },
  amber: {
    pill: "bg-amber-50 text-amber-900 border border-amber-200",
    text: "text-amber-800",
    iconBg: "bg-amber-50",
    stepBg: "bg-amber-800",
    lineBg: "bg-amber-200",
    hoverShadow: "hover:shadow-amber-900/10",
    overlay: "bg-[#143D46]/30",
    ctaSection: "bg-[#143D46]",
  },
  teal: {
    pill: "bg-[#EFF5F3] text-[#143D46] border border-[#DCE5E3]",
    text: "text-[#0F766E]",
    iconBg: "bg-[#EFF5F3]",
    stepBg: "bg-[#143D46]",
    lineBg: "bg-[#DCE5E3]",
    hoverShadow: "hover:shadow-[#143D46]/10",
    overlay: "bg-[#143D46]/30",
    ctaSection: "bg-[#143D46]",
  },
};
