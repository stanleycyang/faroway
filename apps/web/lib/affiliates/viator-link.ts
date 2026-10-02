/** Preserve provider attribution; only campaign is Faroway-controlled. */
export function buildViatorHandoffUrl(
  productUrl: string,
  campaign: string,
  partnerId?: string,
): string | null {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(campaign)) return null;
  try {
    const url = new URL(productUrl);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "viator.com" || url.hostname.endsWith(".viator.com")
      ) ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith("/tours/")
    )
      return null;
    const pid = url.searchParams.get("pid");
    if (!pid || !/^P\d+$/.test(pid) || (partnerId && pid !== partnerId))
      return null;
    if (!/^\d+$/.test(url.searchParams.get("mcid") || "")) return null;
    if (!url.searchParams.get("medium")) return null;
    url.searchParams.set("campaign", campaign);
    return url.toString();
  } catch {
    return null;
  }
}
