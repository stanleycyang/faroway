import photos from './venue-photos.json';
import { venuePhotoSource } from './venuePhotoAssets';

// Existing licensed, bundled photographs: first-run value must not wait for a CDN.
export const firstRunDestinations = [
  {
    photoId: 'nyhavn',
    name: 'Copenhagen',
    country: 'Denmark',
    detail: 'Harbor walks, design, and long lunches',
  },
  {
    photoId: 'belem',
    name: 'Lisbon',
    country: 'Portugal',
    detail: 'Riverside afternoons and winding streets',
  },
  {
    photoId: 'met',
    name: 'New York',
    country: 'USA',
    detail: 'Art, neighborhoods, and something new',
  },
].map(({ photoId, ...destination }) => {
  const photo = photos.find((item) => item.id === photoId)!;
  return { ...destination, source: venuePhotoSource(photo.imageUrl), credit: photo };
});
