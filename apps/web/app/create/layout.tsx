import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan Your Trip — AI Trip Planner",
  description:
    "Create a personalized day-by-day travel itinerary tailored to your destination, dates, pace, and travel style.",
  alternates: { canonical: "/create" },
  openGraph: {
    title: "Plan Your Trip | Faroway",
    description:
      "AI-powered trip planner that builds a personalized day-by-day itinerary around your destination, dates, and travel style.",
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
