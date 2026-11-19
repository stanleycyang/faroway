/** Model-generated allergy/dietary-handling prose is not venue evidence.
 * This bounded English lexical screen is not a semantic or suitability verifier.
 * Apply only to generated copy, never to independently reviewed source warnings.
 */
const handlingTopic =
  /\b(?:allerg\w*|anaphyla\w*|c(?:o)?eliac\w*|cross[ -]?(?:contact|contaminat\w*)|dietary\s+(?:needs|restrictions|requirements)|(?:gluten|nuts?|peanuts?|shellfish)[ -]?free)\b/i;
const sentenceSegments = new Intl.Segmenter("en", { granularity: "sentence" });
export const GENERATED_DINING_REVIEW_NOTE =
  "This restaurant's allergy handling has not been verified. Contact the venue directly about your requirements and cross-contact precautions.";
const concernNote =
  "The generated description raised a dietary or allergy concern. Do not rely on this suggestion without checking your requirements directly with the venue.";
const restrictiveWarning =
  /\b(?:not|never)\s+(?:safe|suitable|recommended|able|equipped)\b|\b(?:cannot|can't|unable to|does not)\s+accommodate\b|\b(?:may contain|contains?)\b[^.!?]{0,60}\b(?:allergen\w*|gluten|peanuts?|shellfish)\b/i;

const mentionsHandling = (text: string) =>
  handlingTopic.test(
    text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, ""),
  );

export function screenGeneratedDiningCopy<
  T extends {
    description: string;
    vibeMatch: string[];
    cuisineTypes: string[];
  },
>(candidate: T): T {
  const descriptionFlagged = mentionsHandling(candidate.description);
  const vibeMatch = candidate.vibeMatch.filter(
    (label) => !mentionsHandling(label),
  );
  const cuisineTypes = candidate.cuisineTypes.filter(
    (label) => !mentionsHandling(label),
  );
  const flagged =
    descriptionFlagged ||
    vibeMatch.length !== candidate.vibeMatch.length ||
    cuisineTypes.length !== candidate.cuisineTypes.length;
  if (!flagged) return { ...candidate };
  // Omit the full sentence rather than leaving a partial safety assertion.
  const priorConcern = candidate.description.endsWith(concernNote);
  const existingNote = priorConcern
    ? concernNote
    : candidate.description.endsWith(GENERATED_DINING_REVIEW_NOTE)
      ? GENERATED_DINING_REVIEW_NOTE
      : "";
  const content = existingNote
    ? candidate.description.slice(0, -existingNote.length).trim()
    : candidate.description;
  const sentences = [...sentenceSegments.segment(content)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
  // Do not turn a generated warning into neutral reassurance. Keep the concern
  // visible without presenting either the warning or an adjacent assurance as fact.
  const concern =
    priorConcern ||
    [...sentences, ...candidate.vibeMatch, ...candidate.cuisineTypes].some(
      (sentence) =>
        mentionsHandling(sentence) && restrictiveWarning.test(sentence),
    );
  const retained = sentences
    .filter((sentence) => sentence && !mentionsHandling(sentence))
    .join(" ");
  return {
    ...candidate,
    description: [
      retained,
      concern ? concernNote : GENERATED_DINING_REVIEW_NOTE,
    ]
      .filter(Boolean)
      .join(" "),
    vibeMatch,
    cuisineTypes,
  };
}
