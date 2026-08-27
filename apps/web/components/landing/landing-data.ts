import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";

export const destinations = [
  {
    name: "Tokyo",
    country: "Japan",
    vibe: "Culture & Tech",
    image: getImageUrl(IMAGE_PATHS.destinations.tokyo),
  },
  {
    name: "Paris",
    country: "France",
    vibe: "Romance & Art",
    image: getImageUrl(IMAGE_PATHS.destinations.paris),
  },
  {
    name: "Bali",
    country: "Indonesia",
    vibe: "Beach & Wellness",
    image: getImageUrl(IMAGE_PATHS.destinations.bali),
  },
  {
    name: "Barcelona",
    country: "Spain",
    vibe: "Beach & Culture",
    image: getImageUrl(IMAGE_PATHS.destinations.barcelona),
  },
  {
    name: "New York",
    country: "USA",
    vibe: "Urban & Nightlife",
    image: getImageUrl(IMAGE_PATHS.destinations["new-york"]),
  },
  {
    name: "Santorini",
    country: "Greece",
    vibe: "Scenic & Romantic",
    image: getImageUrl(IMAGE_PATHS.destinations.santorini),
  },
];

export const scenicImages = [
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryMaldives),
    alt: "Crystal-clear tropical beach with turquoise water",
    label: "Maldives",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.gallerySwissAlps),
    alt: "Majestic mountain peaks at golden hour",
    label: "Swiss Alps",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryVenice),
    alt: "Venice canal at sunset with gondolas",
    label: "Venice",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryLakeBled),
    alt: "Scenic lake surrounded by mountains at sunrise",
    label: "Lake Bled",
  },
];

export const whyReasons = [
  {
    title: "No more tab overload",
    desc: "Stop juggling 20 browser tabs. Get places to stay, restaurants, and activities in one organized itinerary.",
    emoji: "\ud83e\udde0",
  },
  {
    title: "Local secrets, not tourist traps",
    desc: "Our AI recommends hidden gems and authentic experiences that guidebooks miss.",
    emoji: "\ud83d\uddfa\ufe0f",
  },
  {
    title: "Plans that actually fit you",
    desc: "Tell us your vibes \u2014 adventure, foodie, relaxation \u2014 and get an itinerary tailored to how you actually travel.",
    emoji: "\u2728",
  },
];

export const travelVibes = [
  { label: "Adventure", emoji: "\ud83c\udfd4\ufe0f" },
  { label: "Relaxation", emoji: "\ud83c\udf34" },
  { label: "Culture", emoji: "\ud83c\udfdb\ufe0f" },
  { label: "Foodie", emoji: "\ud83c\udf5c" },
  { label: "Nightlife", emoji: "\ud83c\udf89" },
  { label: "Nature", emoji: "\ud83c\udf3f" },
  { label: "Romantic", emoji: "\ud83d\udc95" },
  { label: "Family", emoji: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66" },
  { label: "Budget", emoji: "\ud83d\udcb0" },
  { label: "Luxury", emoji: "\u2728" },
  { label: "Solo", emoji: "\ud83c\udf92" },
  { label: "Wellness", emoji: "\ud83e\uddd8" },
];
