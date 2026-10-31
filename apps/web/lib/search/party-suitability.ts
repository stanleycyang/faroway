/**
 * Conservative title screening for shared itineraries that include children.
 * These are reasons to seek suitability evidence, not legal age restrictions.
 * No match means unknown suitability, never "family-safe".
 */
export function familyActivityReviewReason(
  title: string,
): "adult_only_label" | "alcohol_focused_title" | null {
  const text = title.normalize("NFKC").toLowerCase();
  if (/\badults?[ -]only\b|\b(?:18|21)\s*\+/.test(text))
    return "adult_only_label";
  // An explicitly non-alcoholic activity title is not an alcohol-focused offer.
  // This does not certify that children can attend it.
  if (/^(?:non[ -]?alcoholic|alcohol[ -]?free|zero[ -]?proof)\b/.test(text))
    return null;
  if (
    /\b(?:wine|beer|whisky|whiskey|spirits?|gin|rum|vodka|tequila|cocktails?)\s+(?:tastings?|pairings?|experience|tour|workshop|class)\b/.test(
      text,
    ) ||
    /\b(?:pub|bar)\s+(?:crawl|hopping)\b/.test(text) ||
    /\b(?:brewery|distillery)\s+(?:tour|tasting)\b/.test(text) ||
    /\bmixology\s+(?:class|workshop|experience)\b/.test(text)
  )
    return "alcohol_focused_title";
  return null;
}
