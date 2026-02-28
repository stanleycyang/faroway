import {
  Heart,
  Luggage,
  PiggyBank,
  Plane,
  CreditCard,
  TrendingDown,
  Wallet,
  Receipt,
  MapPin,
  Sun,
  Calendar,
  Globe,
  Mountain,
  Palmtree,
  Sparkles,
  Music,
  Sunset,
  Coffee,
  Utensils,
  CheckSquare,
  Shield,
  Wifi,
  Smartphone,
  Stethoscope,
  UserPlus,
  MessageCircle,
  Split,
  Vote,
  CalendarCheck,
  Share2,
  Zap,
  Search,
  Bell,
  Tag,
  Clock,
  Star,
  type LucideIcon,
} from "lucide-react";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";

export interface ClusterTopic {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ClusterStartHereItem {
  title: string;
  description: string;
  slug?: string; // link to a blog post if exists
}

export interface ClusterDefinition {
  slug: string;
  title: string;
  gradientWord: string;
  tagline: string;
  description: string;
  heroImage: string;
  heroImageAlt: string;
  accent: "coral" | "amber" | "teal";
  topics: ClusterTopic[];
  startHere: ClusterStartHereItem[];
  cta: {
    title: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
  seo: {
    title: string;
    description: string;
  };
  matchTags: string[];
  matchCategories: string[];
}

export const ACCENT_COLORS = {
  coral: {
    bg: "bg-primary/10",
    bgSolid: "bg-primary",
    text: "text-primary",
    border: "border-primary/20",
    gradient: "from-primary to-rose-400",
    iconBg: "bg-primary/10",
    hoverShadow: "hover:shadow-primary/10",
    overlay: "bg-primary/10",
    pill: "bg-primary/10 text-primary",
    buttonGradient: "from-primary to-rose-500",
  },
  amber: {
    bg: "bg-amber-500/10",
    bgSolid: "bg-amber-500",
    text: "text-amber-600",
    border: "border-amber-500/20",
    gradient: "from-amber-500 to-orange-400",
    iconBg: "bg-amber-500/10",
    hoverShadow: "hover:shadow-amber-500/10",
    overlay: "bg-amber-500/10",
    pill: "bg-amber-500/10 text-amber-600",
    buttonGradient: "from-amber-500 to-orange-500",
  },
  teal: {
    bg: "bg-teal-500/10",
    bgSolid: "bg-teal-500",
    text: "text-teal-600",
    border: "border-teal-500/20",
    gradient: "from-teal-500 to-cyan-400",
    iconBg: "bg-teal-500/10",
    hoverShadow: "hover:shadow-teal-500/10",
    overlay: "bg-teal-500/10",
    pill: "bg-teal-500/10 text-teal-600",
    buttonGradient: "from-teal-500 to-cyan-500",
  },
} as const;

export const CLUSTERS: ClusterDefinition[] = [
  {
    slug: "budget-travel",
    title: "Budget & Money-Saving Travel",
    gradientWord: "Money-Saving",
    tagline: "Travel more, spend less — without sacrificing the experience.",
    description:
      "Master the art of affordable travel. From finding cheap flights to stretching your budget in expensive cities, these guides help you see the world without breaking the bank.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterTravelPlanning),
    heroImageAlt:
      "Colorful market stalls in Southeast Asia representing budget travel",
    accent: "amber",
    topics: [
      {
        title: "Cheap Flight Hacks",
        description:
          "Find the best airfare deals with proven booking strategies",
        icon: Plane,
      },
      {
        title: "Budget Accommodation",
        description:
          "Hostels, house-sitting, and creative ways to save on stays",
        icon: PiggyBank,
      },
      {
        title: "Travel Rewards & Points",
        description: "Maximize credit card points and loyalty programs",
        icon: CreditCard,
      },
      {
        title: "Cost-Cutting Tips",
        description:
          "Save on food, transport, and activities at your destination",
        icon: TrendingDown,
      },
      {
        title: "Budget Planning Tools",
        description: "Estimate costs and plan spending before you go",
        icon: Wallet,
      },
      {
        title: "Free & Cheap Activities",
        description: "Walking tours, free museums, and budget-friendly fun",
        icon: Receipt,
      },
    ],
    startHere: [
      {
        title: "How to Save Money on Flights",
        description:
          "The ultimate guide to finding cheap airfare, from timing your booking to using flight comparison tools.",
        slug: "how-to-save-money-on-flights",
      },
      {
        title: "Trip Cost Estimator Guide",
        description:
          "Learn how to estimate your total trip cost so you can set a realistic budget before you book.",
      },
      {
        title: "Budget Travel Destinations 2026",
        description:
          "The best affordable destinations this year where your money goes furthest.",
      },
    ],
    cta: {
      title: "Estimate Your Trip Cost",
      description:
        "Use our free Trip Cost Estimator to plan your budget and find out exactly how much your dream trip will cost.",
      buttonText: "Try Cost Estimator",
      buttonHref: "/tools/trip-cost",
    },
    seo: {
      title: "Budget Travel Guides — Save Money on Your Next Trip",
      description:
        "Expert guides on budget travel, cheap flights, travel hacking, and money-saving tips. Plan affordable trips without sacrificing the experience.",
    },
    matchTags: [
      "budget",
      "cheap flights",
      "money saving",
      "backpacking",
      "travel hacking",
      "affordable",
      "cost",
      "deals",
    ],
    matchCategories: ["Budget Travel"],
  },
  {
    slug: "destination-guides",
    title: "Destination Guides & Best Time to Visit",
    gradientWord: "Destination",
    tagline: "Know exactly where to go and when to go there.",
    description:
      "Comprehensive destination guides with insider knowledge on the best times to visit, what to expect each season, and how to make the most of every destination.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterDestinations),
    heroImageAlt:
      "Stunning tropical beach destination with crystal clear water",
    accent: "teal",
    topics: [
      {
        title: "Best Time to Visit",
        description:
          "Season-by-season breakdowns for top destinations worldwide",
        icon: Calendar,
      },
      {
        title: "Hidden Gems",
        description: "Off-the-beaten-path spots the guidebooks miss",
        icon: MapPin,
      },
      {
        title: "Weather & Climate",
        description: "Know what to expect before you pack your bags",
        icon: Sun,
      },
      {
        title: "Regional Guides",
        description: "In-depth guides to Asia, Europe, Americas, and beyond",
        icon: Globe,
      },
      {
        title: "Adventure Destinations",
        description: "Best spots for hiking, diving, and outdoor thrills",
        icon: Mountain,
      },
      {
        title: "Beach & Island Escapes",
        description: "Top tropical paradises and coastal getaways",
        icon: Palmtree,
      },
    ],
    startHere: [
      {
        title: "Hidden Gems of Southeast Asia",
        description:
          "Discover incredible off-the-beaten-path destinations across Southeast Asia that most travelers never find.",
        slug: "hidden-gems-southeast-asia-2026",
      },
      {
        title: "Best Time to Visit Japan",
        description:
          "A month-by-month guide to visiting Japan — cherry blossoms, fall foliage, ski season, and everything in between.",
        slug: "best-time-to-visit-japan",
      },
      {
        title: "Best Time to Visit Tool",
        description:
          "Use our interactive tool to find the perfect month to visit any destination based on weather, crowds, and prices.",
      },
    ],
    cta: {
      title: "Find Your Perfect Travel Window",
      description:
        "Our Best Time to Visit tool analyzes weather, crowds, and prices to tell you the ideal month for your destination.",
      buttonText: "Check Best Time to Visit",
      buttonHref: "/tools/best-time-to-visit",
    },
    seo: {
      title: "Destination Guides & Best Time to Visit — Expert Travel Advice",
      description:
        "In-depth destination guides with best time to visit, hidden gems, seasonal tips, and insider knowledge for travelers worldwide.",
    },
    matchTags: [
      "destinations",
      "best time to visit",
      "hidden gems",
      "travel guide",
      "where to go",
      "season",
      "weather",
    ],
    matchCategories: ["Destinations"],
  },
  {
    slug: "vibe-based-travel",
    title: "Vibe-Based Travel Guides",
    gradientWord: "Vibe-Based",
    tagline: "Travel by feeling, not just by destination.",
    description:
      "Find your perfect trip based on the experience you crave — whether it's a romantic getaway, a foodie adventure, a digital nomad escape, or a solo soul-searching journey.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterBudgetTravel),
    heroImageAlt: "Serene sunset beach scene representing vibe-based travel",
    accent: "coral",
    topics: [
      {
        title: "Romantic Getaways",
        description: "Dreamy destinations perfect for couples and honeymoons",
        icon: Heart,
      },
      {
        title: "Foodie Adventures",
        description: "Destinations where the cuisine is the main attraction",
        icon: Utensils,
      },
      {
        title: "Solo Travel",
        description: "Best destinations and tips for traveling on your own",
        icon: Sparkles,
      },
      {
        title: "Nightlife & Culture",
        description: "Cities with the best music, art, and after-dark scenes",
        icon: Music,
      },
      {
        title: "Relaxation & Wellness",
        description: "Spa retreats, yoga escapes, and stress-free vacations",
        icon: Sunset,
      },
      {
        title: "Digital Nomad Spots",
        description: "Work-friendly destinations with great wifi and community",
        icon: Coffee,
      },
    ],
    startHere: [
      {
        title: "Take the Travel Quiz",
        description:
          "Answer a few fun questions and we'll match you with your perfect destination based on your travel personality.",
      },
      {
        title: "Best Solo Travel Destinations",
        description:
          "Safe, exciting, and social — the best places in the world for solo travelers to explore.",
      },
      {
        title: "Top Foodie Destinations 2026",
        description:
          "From street food capitals to Michelin star cities — where to go when food is the journey.",
      },
    ],
    cta: {
      title: "Discover Your Travel Personality",
      description:
        "Take our free Travel Quiz and get personalized destination recommendations based on your unique travel style.",
      buttonText: "Take the Travel Quiz",
      buttonHref: "/tools/travel-quiz",
    },
    seo: {
      title: "Vibe-Based Travel Guides — Find Trips That Match Your Mood",
      description:
        "Discover destinations based on vibes: romantic, adventure, foodie, solo, relaxation, and digital nomad travel guides.",
    },
    matchTags: [
      "solo travel",
      "romantic",
      "foodie",
      "adventure",
      "relaxation",
      "digital nomad",
      "wellness",
      "nightlife",
      "vibe",
    ],
    matchCategories: [],
  },
  {
    slug: "trip-planning-packing",
    title: "Practical Trip Planning & Packing",
    gradientWord: "Planning",
    tagline: "Plan smarter. Pack lighter. Travel better.",
    description:
      "Everything you need to prepare for your trip — from building the perfect itinerary to packing the right gear. Practical, no-fluff guides for organized travelers.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterAdventure),
    heroImageAlt:
      "Organized travel planning setup with map and packing essentials",
    accent: "teal",
    topics: [
      {
        title: "Packing Guides",
        description:
          "What to pack for every destination, climate, and trip type",
        icon: Luggage,
      },
      {
        title: "Travel Checklists",
        description: "Pre-trip checklists so you never forget the essentials",
        icon: CheckSquare,
      },
      {
        title: "Travel Safety",
        description: "Stay safe with tips on insurance, scams, and health prep",
        icon: Shield,
      },
      {
        title: "Tech & Connectivity",
        description:
          "Best travel tech, SIM cards, and staying connected abroad",
        icon: Wifi,
      },
      {
        title: "Travel Apps & Tools",
        description: "The best apps and tools to simplify your trip planning",
        icon: Smartphone,
      },
      {
        title: "Travel Health",
        description:
          "Vaccinations, travel insurance, and staying healthy on the road",
        icon: Stethoscope,
      },
    ],
    startHere: [
      {
        title: "Planning Your Trip with AI",
        description:
          "How AI travel planners like Faroway are revolutionizing the way we plan trips — and how to get the most out of them.",
        slug: "ultimate-guide-planning-trip-with-ai",
      },
      {
        title: "Ultimate Packing List Generator",
        description:
          "Generate a personalized packing list based on your destination, dates, and activities. Never overpack again.",
      },
      {
        title: "Pre-Trip Checklist",
        description:
          "The complete pre-departure checklist: documents, bookings, health, tech, and everything in between.",
      },
    ],
    cta: {
      title: "Generate Your Packing List",
      description:
        "Our smart Packing List Generator creates a personalized list based on your destination, dates, and planned activities.",
      buttonText: "Build My Packing List",
      buttonHref: "/tools/packing-list",
    },
    seo: {
      title: "Trip Planning & Packing Guides — Practical Travel Preparation",
      description:
        "Practical guides for trip planning, packing lists, travel checklists, safety tips, and essential travel preparation advice.",
    },
    matchTags: [
      "packing",
      "planning",
      "checklist",
      "travel tips",
      "organization",
      "travel gear",
      "safety",
      "health",
      "AI travel",
    ],
    matchCategories: ["Travel Planning", "Travel Tips"],
  },
  {
    slug: "group-travel",
    title: "Group & Collaborative Travel",
    gradientWord: "Collaborative",
    tagline: "Plan together. Travel together. Remember together.",
    description:
      "Make group travel easy with guides on planning trips with friends, family, or coworkers. From splitting costs to coordinating schedules, we've got you covered.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterGroupTravel),
    heroImageAlt: "Group of friends enjoying a travel adventure together",
    accent: "coral",
    topics: [
      {
        title: "Group Trip Planning",
        description: "How to organize trips when multiple people are involved",
        icon: UserPlus,
      },
      {
        title: "Communication Tips",
        description: "Keep everyone aligned without endless group chats",
        icon: MessageCircle,
      },
      {
        title: "Splitting Costs",
        description: "Fair ways to divide expenses and manage group budgets",
        icon: Split,
      },
      {
        title: "Decision Making",
        description:
          "Tools and strategies for making group decisions painlessly",
        icon: Vote,
      },
      {
        title: "Itinerary Coordination",
        description: "Build itineraries that work for everyone in the group",
        icon: CalendarCheck,
      },
      {
        title: "Sharing & Memories",
        description: "Share trips, photos, and memories with your travel crew",
        icon: Share2,
      },
    ],
    startHere: [
      {
        title: "Group Trip Planning 101",
        description:
          "The complete guide to planning a group trip that actually works — from choosing a destination to managing expectations.",
      },
      {
        title: "How to Split Travel Costs",
        description:
          "Fair, stress-free methods for splitting expenses on group trips so nobody ends up resentful.",
      },
      {
        title: "Shared Itinerary Features",
        description:
          "How Faroway's shared trip features make collaborative travel planning effortless.",
      },
    ],
    cta: {
      title: "Plan Your Group Trip",
      description:
        "Faroway makes group travel easy with shared itineraries, collaborative planning, and smart coordination tools.",
      buttonText: "Start Planning Together",
      buttonHref: "/create",
    },
    seo: {
      title: "Group Travel Guides — Plan Trips Together Effortlessly",
      description:
        "Expert guides on group trip planning, splitting costs, coordinating schedules, and making collaborative travel stress-free.",
    },
    matchTags: [
      "group travel",
      "friends",
      "family travel",
      "collaborative",
      "shared",
      "group planning",
      "splitting costs",
    ],
    matchCategories: [],
  },
  {
    slug: "insider-tips",
    title: "Insider Tips, Tricks & Deals",
    gradientWord: "Insider",
    tagline: "The secrets seasoned travelers swear by.",
    description:
      "Go beyond the basics with insider knowledge, travel hacks, and exclusive deals. These are the tips that turn a good trip into an unforgettable one.",
    heroImage: getImageUrl(IMAGE_PATHS.blog.clusterSoloTravel),
    heroImageAlt: "Traveler with map exploring a charming European street",
    accent: "amber",
    topics: [
      {
        title: "Travel Hacks",
        description: "Clever tricks that save time, money, and stress",
        icon: Zap,
      },
      {
        title: "Deal Finding",
        description: "How to find and snag the best travel deals online",
        icon: Search,
      },
      {
        title: "Alert Strategies",
        description: "Set up fare alerts and deal notifications that work",
        icon: Bell,
      },
      {
        title: "Loyalty Programs",
        description: "Get the most out of airline and hotel loyalty programs",
        icon: Tag,
      },
      {
        title: "Timing Secrets",
        description:
          "When to book, when to fly, and when to visit for the best value",
        icon: Clock,
      },
      {
        title: "VIP on a Budget",
        description:
          "Upgrades, lounge access, and premium experiences for less",
        icon: Star,
      },
    ],
    startHere: [
      {
        title: "Top Travel Hacks for 2026",
        description:
          "The best travel hacks this year — from booking tricks to airport shortcuts to getting free upgrades.",
      },
      {
        title: "Flight Deal Alert Guide",
        description:
          "How to set up fare alerts and never miss a cheap flight deal again. Includes the best tools and strategies.",
      },
      {
        title: "Hotel Loyalty Programs Ranked",
        description:
          "An honest ranking of hotel loyalty programs — which ones are actually worth your time and money.",
      },
    ],
    cta: {
      title: "Let AI Find Your Best Trip",
      description:
        "Faroway uses AI to find optimal routes, timing, and deals — so you get insider-level planning without the research.",
      buttonText: "Plan My Trip",
      buttonHref: "/create",
    },
    seo: {
      title: "Insider Travel Tips, Tricks & Deals — Expert Secrets",
      description:
        "Insider travel tips, hacks, and deals from seasoned travelers. Learn the secrets to booking cheap flights, getting upgrades, and traveling smarter.",
    },
    matchTags: [
      "tips",
      "tricks",
      "hacks",
      "deals",
      "secrets",
      "insider",
      "loyalty",
      "upgrades",
      "alerts",
    ],
    matchCategories: ["Travel Tips"],
  },
];

export function getClusterBySlug(slug: string): ClusterDefinition | undefined {
  return CLUSTERS.find((c) => c.slug === slug);
}

export function getAllClusterSlugs(): string[] {
  return CLUSTERS.map((c) => c.slug);
}

export function getRelatedClusters(currentSlug: string): ClusterDefinition[] {
  return CLUSTERS.filter((c) => c.slug !== currentSlug);
}
