import type { ActivityResult } from "./index";

type VisitType = NonNullable<ActivityResult["proposedVisitType"]>;
const notes: Record<VisitType, string> = {
  ordinary_entry: "Suggested entry visit · hours and admission unconfirmed.",
  exterior_walk: "Suggested exterior walk · access unconfirmed.",
  guided_tour: "Suggested guided tour · dates and tickets unconfirmed.",
  event: "Suggested event · date and tickets unconfirmed.",
  unknown: "Visit type unconfirmed.",
};

/** Intent is descriptive only; it never establishes access or a reservation. */
export function readProposedVisitType(value: unknown): VisitType | undefined {
  return typeof value === "string" && Object.hasOwn(notes, value)
    ? (value as VisitType)
    : undefined;
}

export function proposedVisitNote(value: unknown): string | undefined {
  const intent = readProposedVisitType(value);
  return intent === undefined ? undefined : notes[intent];
}
