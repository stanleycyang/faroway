/** Lexical preference matching only; this never verifies venue identity. */
export function matchesSuggestedHighlight(
  name: string,
  highlight: string,
): boolean {
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
      .trim();
  const requested = normalized(highlight);
  // Do not allow intervening words: Edo-Tokyo Museum and Edo-Tokyo Open Air
  // Architectural Museum are distinct locations despite sharing ordered words.
  return (
    requested.length > 0 && ` ${normalized(name)} `.includes(` ${requested} `)
  );
}
