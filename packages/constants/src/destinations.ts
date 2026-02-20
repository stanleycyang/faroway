import { IMAGE_PATHS } from './images';
import { getImageUrl } from './storage';

export interface Destination {
  id: string;
  name: string;
  country: string;
  image: string;
  description: string;
  tags: string[];
  averageTemp: string;
  currency: string;
  language: string;
  bestTime: string;
}

export const popularDestinations: Destination[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    image: getImageUrl(IMAGE_PATHS.destinations.tokyo),
    description: 'A dazzling blend of ultramodern and traditional',
    tags: ['culture', 'food', 'technology', 'shopping'],
    averageTemp: '16°C',
    currency: 'JPY',
    language: 'Japanese',
    bestTime: 'Mar-May, Sep-Nov',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    image: getImageUrl(IMAGE_PATHS.destinations.paris),
    description: 'The city of lights, love, and timeless elegance',
    tags: ['romantic', 'culture', 'food', 'art'],
    averageTemp: '12°C',
    currency: 'EUR',
    language: 'French',
    bestTime: 'Apr-Jun, Sep-Oct',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    image: getImageUrl(IMAGE_PATHS.destinations.bali),
    description: 'Island of gods with beaches, temples, and rice terraces',
    tags: ['beach', 'spiritual', 'nature', 'wellness'],
    averageTemp: '27°C',
    currency: 'IDR',
    language: 'Indonesian',
    bestTime: 'Apr-Oct',
  },
  {
    id: 'new-york',
    name: 'New York',
    country: 'USA',
    image: getImageUrl(IMAGE_PATHS.destinations['new-york']),
    description: 'The city that never sleeps',
    tags: ['urban', 'culture', 'food', 'shopping', 'nightlife'],
    averageTemp: '13°C',
    currency: 'USD',
    language: 'English',
    bestTime: 'Apr-Jun, Sep-Nov',
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    image: getImageUrl(IMAGE_PATHS.destinations.barcelona),
    description: 'Art, architecture, and Mediterranean vibes',
    tags: ['beach', 'culture', 'architecture', 'nightlife'],
    averageTemp: '18°C',
    currency: 'EUR',
    language: 'Spanish, Catalan',
    bestTime: 'May-Jun, Sep-Oct',
  },
  {
    id: 'iceland',
    name: 'Reykjavik',
    country: 'Iceland',
    image: getImageUrl(IMAGE_PATHS.destinations.reykjavik),
    description: 'Land of fire, ice, and northern lights',
    tags: ['nature', 'adventure', 'unique'],
    averageTemp: '5°C',
    currency: 'ISK',
    language: 'Icelandic',
    bestTime: 'Jun-Aug, Sep-Mar (aurora)',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    image: getImageUrl(IMAGE_PATHS.destinations.dubai),
    description: 'Futuristic skyline meets Arabian luxury',
    tags: ['luxury', 'shopping', 'architecture', 'beach'],
    averageTemp: '28°C',
    currency: 'AED',
    language: 'Arabic, English',
    bestTime: 'Nov-Mar',
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    image: getImageUrl(IMAGE_PATHS.destinations.santorini),
    description: 'Iconic white buildings and stunning sunsets',
    tags: ['romantic', 'beach', 'views', 'relaxation'],
    averageTemp: '20°C',
    currency: 'EUR',
    language: 'Greek',
    bestTime: 'Apr-Oct',
  },
  {
    id: 'interlaken',
    name: 'Interlaken',
    country: 'Switzerland',
    image: getImageUrl(IMAGE_PATHS.destinations.interlaken),
    description: 'Adventure capital nestled between two alpine lakes',
    tags: ['mountain', 'adventure', 'nature', 'hiking'],
    averageTemp: '9°C',
    currency: 'CHF',
    language: 'German, French',
    bestTime: 'Jun-Sep, Dec-Mar',
  },
  {
    id: 'cancun',
    name: 'Cancun',
    country: 'Mexico',
    image: getImageUrl(IMAGE_PATHS.destinations.cancun),
    description: 'Turquoise waters, white sand, and vibrant nightlife',
    tags: ['beach', 'party', 'nightlife', 'relaxation'],
    averageTemp: '27°C',
    currency: 'MXN',
    language: 'Spanish',
    bestTime: 'Dec-Apr',
  },
  {
    id: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    image: getImageUrl(IMAGE_PATHS.destinations.bangkok),
    description: 'Temples, street food, and electric energy',
    tags: ['food', 'culture', 'nightlife', 'budget'],
    averageTemp: '29°C',
    currency: 'THB',
    language: 'Thai',
    bestTime: 'Nov-Feb',
  },
  {
    id: 'chamonix',
    name: 'Chamonix',
    country: 'France',
    image: getImageUrl(IMAGE_PATHS.destinations.chamonix),
    description: 'World-class alpine adventures beneath Mont Blanc',
    tags: ['mountain', 'adventure', 'nature', 'hiking'],
    averageTemp: '7°C',
    currency: 'EUR',
    language: 'French',
    bestTime: 'Jun-Sep, Dec-Mar',
  },
  {
    id: 'ibiza',
    name: 'Ibiza',
    country: 'Spain',
    image: getImageUrl(IMAGE_PATHS.destinations.ibiza),
    description: 'Legendary parties and hidden Mediterranean coves',
    tags: ['party', 'nightlife', 'beach', 'entertainment'],
    averageTemp: '20°C',
    currency: 'EUR',
    language: 'Spanish, Catalan',
    bestTime: 'May-Oct',
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    image: getImageUrl(IMAGE_PATHS.destinations.kyoto),
    description: 'Ancient temples, zen gardens, and living traditions',
    tags: ['culture', 'art', 'heritage', 'spiritual', 'food'],
    averageTemp: '16°C',
    currency: 'JPY',
    language: 'Japanese',
    bestTime: 'Mar-May, Oct-Nov',
  },
  {
    id: 'amalfi-coast',
    name: 'Amalfi Coast',
    country: 'Italy',
    image: getImageUrl(IMAGE_PATHS.destinations['amalfi-coast']),
    description: 'Cliffside villages, azure waters, and Italian charm',
    tags: ['romantic', 'views', 'food', 'beach', 'luxury'],
    averageTemp: '18°C',
    currency: 'EUR',
    language: 'Italian',
    bestTime: 'May-Sep',
  },
];

export interface TravelVibe {
  id: string;
  label: string;
  emoji: string;
}

export const travelVibes: TravelVibe[] = [
  { id: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { id: 'relaxation', label: 'Relaxation', emoji: '🌴' },
  { id: 'culture', label: 'Culture', emoji: '🏛️' },
  { id: 'foodie', label: 'Foodie', emoji: '🍜' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🎉' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 'budget', label: 'Budget', emoji: '💰' },
  { id: 'luxury', label: 'Luxury', emoji: '✨' },
  { id: 'solo', label: 'Solo', emoji: '🎒' },
  { id: 'wellness', label: 'Wellness', emoji: '🧘' },
];

export interface TravelerTypeOption {
  id: string;
  label: string;
  icon: string;
}

export const travelerTypes: TravelerTypeOption[] = [
  { id: 'solo', label: 'Solo', icon: 'person' },
  { id: 'couple', label: 'Couple', icon: 'people' },
  { id: 'family', label: 'Family', icon: 'people-circle' },
  { id: 'friends', label: 'Friends', icon: 'people-sharp' },
  { id: 'business', label: 'Business', icon: 'briefcase' },
];
