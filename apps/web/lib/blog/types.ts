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
  cluster?: string;
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
  cluster?: string;
}

export const AUTHORS: Record<string, Author> = {
  "faroway-team": {
    name: "Faroway Team",
    avatar: "/icon.png",
    bio: "The Faroway team is passionate about making travel planning effortless with AI. We combine travel expertise with cutting-edge technology to help you explore the world.",
    twitter: "@faroway",
  },
};

export const CATEGORIES = [
  "Travel Planning",
  "Destinations",
  "Budget Travel",
  "Travel Tips",
  "Technology",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
