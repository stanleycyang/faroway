import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan Your Trip — AI Trip Planner",
  description:
    "Create a personalized day-by-day travel itinerary. Choose your destination, dates, and vibes, then sign in with a free account to generate and save your plan.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "Plan Your Trip | Faroway",
    description:
      "AI-powered trip planner that creates personalized itineraries. A free account keeps your trip secure and synced.",
    type: "website",
    url: "/create",
  },
  twitter: {
    card: "summary_large_image",
    title: "Plan Your Trip | Faroway",
    description:
      "AI-powered trip planner that creates personalized itineraries.",
  },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
