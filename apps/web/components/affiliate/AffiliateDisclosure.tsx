export const AFFILIATE_DISCLOSURE =
  "Partner link · Faroway may earn a commission at no extra cost to you.";

export function AffiliateDisclosure({
  className = "text-center text-[11px] leading-4 text-gray-500",
}: {
  className?: string;
}) {
  return <p className={className}>{AFFILIATE_DISCLOSURE}</p>;
}
