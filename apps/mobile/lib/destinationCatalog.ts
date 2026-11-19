interface CatalogImage {
  name: string;
  country: string;
  image: string;
}
const identity = (value: string) => value.normalize('NFKC').trim().toLowerCase();
const validImage = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Image-led discovery needs usable sources. Reuse art only for the exact city
 * and country; never attach another destination's image to an unknown record. */
export function usableDestinationImages<T extends CatalogImage>(
  items: T[],
  collection: readonly CatalogImage[]
): T[] {
  return items.flatMap((item) => {
    if (validImage(item.image)) return [{ ...item, image: item.image.trim() }];
    const match = collection.find(
      (candidate) =>
        identity(candidate.name) === identity(item.name) &&
        identity(candidate.country) === identity(item.country) &&
        validImage(candidate.image)
    );
    return match ? [{ ...item, image: match.image.trim() }] : [];
  });
}
