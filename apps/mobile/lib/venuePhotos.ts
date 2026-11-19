import photos from './venue-photos.json';

export interface VenuePhotoCredit {
  artist: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}
const normalize = (text: string) =>
  text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
function addressKey(value: string, countries: readonly string[]) {
  let key = normalize(value);
  for (const country of countries) {
    const suffix = `, ${normalize(country)}`;
    if (key.endsWith(suffix)) key = key.slice(0, -suffix.length);
  }
  // Bounded street formatting only: keep building numbers, units and postcodes.
  return key
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\b(st|ave)\./g, '$1');
}
/** Curated photographs, never evidence of opening, access or availability.
 * No fuzzy name search or generated URL; both venue and address must match. */
export function venuePhoto(name: string, address: string) {
  if (!name.trim() || !address.trim()) return undefined;
  const matches = photos.filter(
    (photo) =>
      photo.names.some((alias) => normalize(alias) === normalize(name)) &&
      photo.addresses.some(
        (alias) =>
          addressKey(alias, photo.countrySuffixes) === addressKey(address, photo.countrySuffixes)
      )
  );
  return matches.length === 1 ? matches[0] : undefined;
}
