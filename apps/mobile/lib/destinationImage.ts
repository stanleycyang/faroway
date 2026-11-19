import { destinationImage as catalogImage, IMAGE_PATHS, getImageUrl } from '@faroway/constants';

/** Same city/country matching as web; unknown places keep general travel art. */
export function destinationImage(destination: string): string {
  return (
    catalogImage(destination) ||
    getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai'])
  );
}
