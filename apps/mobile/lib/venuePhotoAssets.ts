import type { ImageSourcePropType } from 'react-native';
import photos from './venue-photos.json';

// Metro needs literal asset requires to include these licensed images in the APK.
const assets: Record<string, ImageSourcePropType> = {
  'scotland-museum': require('../assets/venues/scotland-museum.jpg'),
  jeronimos: require('../assets/venues/jeronimos.jpg'),
  belem: require('../assets/venues/belem.jpg'),
  nyhavn: require('../assets/venues/nyhavn.jpg'),
  met: require('../assets/venues/met.jpg'),
  moma: require('../assets/venues/moma.jpg'),
  'fed-square': require('../assets/venues/fed-square.jpg'),
};

/** Curated image URLs remain stable cache identities; bundled copies avoid
 * upstream hotlink restrictions and work offline. Other provider URLs stay remote.
 * Venue/address matching and credits are handled by itinerary normalization.
 */
export function venuePhotoSource(uri: string): ImageSourcePropType {
  const photo = photos.find((item) => item.imageUrl === uri);
  return (photo && assets[photo.id]) || { uri };
}
