import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';

/** Resolve catalog photography for city-only and "City, Country" trip briefs. */
export function destinationImage(destination: string): string {
  const city = destination
    .split(',')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
  const paths = IMAGE_PATHS.destinations;
  const path = Object.prototype.hasOwnProperty.call(paths, city)
    ? paths[city as keyof typeof paths]
    : IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai'];
  return getImageUrl(path);
}
