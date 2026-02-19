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
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1522199710521-72d69614c702?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
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
    image: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=800&q=80',
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
