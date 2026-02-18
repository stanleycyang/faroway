export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  lastUpdated?: string;
  author: Author;
  category: string;
  tags: string[];
  coverImage: string;
  coverImageAlt?: string;
  readingTime: number;
  featured?: boolean;
  content: string;
}

export interface Author {
  name: string;
  avatar: string;
  bio: string;
  twitter?: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  lastUpdated?: string;
  author: Author;
  category: string;
  tags: string[];
  coverImage: string;
  coverImageAlt?: string;
  readingTime: number;
  featured?: boolean;
}

export const AUTHORS: Record<string, Author> = {
  'tripgenie-team': {
    name: 'TripGenie Team',
    avatar: '/icon.png',
    bio: 'The TripGenie team is passionate about making travel planning effortless with AI. We combine travel expertise with cutting-edge technology to help you explore the world.',
    twitter: '@tripgenie',
  },
  'sarah-chen': {
    name: 'Sarah Chen',
    avatar: '/icon.png',
    bio: 'Sarah is a seasoned travel writer and digital nomad who has visited 60+ countries. She specializes in budget travel and off-the-beaten-path destinations.',
    twitter: '@sarahchentravels',
  },
  'james-miller': {
    name: 'James Miller',
    avatar: '/icon.png',
    bio: 'James is TripGenie\'s Head of Product and a travel tech enthusiast. He writes about the intersection of AI and travel planning.',
    twitter: '@jmillertravels',
  },
};

export const CATEGORIES = [
  'Travel Planning',
  'Destinations',
  'Budget Travel',
  'Travel Tips',
  'Technology',
] as const;

export type Category = (typeof CATEGORIES)[number];
