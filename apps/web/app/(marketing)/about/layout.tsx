import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
const description =
  "Discover Faroway’s approach to personal travel planning: day-by-day itineraries, local discoveries, and room to make a trip your own.";

export const metadata: Metadata = {
  title: "About Faroway — Our Mission & Story",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Faroway — Our Mission & Story",
    description,
    type: "website",
    url: `${baseUrl}/about`,
  },
  twitter: {
    card: "summary_large_image",
    title: "About Faroway — Our Mission & Story",
    description,
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
