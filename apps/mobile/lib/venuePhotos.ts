import photos from './venue-photos.json';

export interface VenuePhotoCredit {
  artist: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
}
const normalize = (text: string) =>
  text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
/** Curated photographs, never evidence of opening, access or availability.
 * No fuzzy name search or generated URL; both venue and address must match. */
export function venuePhoto(name: string, address: string) {
  if (!name.trim() || !address.trim()) return undefined;
  const matches = photos.filter(
    (photo) =>
      photo.names.some((alias) => normalize(alias) === normalize(name)) &&
      photo.addresses.some((alias) => normalize(alias) === normalize(address))
  );
  return matches.length === 1 ? matches[0] : undefined;
}
