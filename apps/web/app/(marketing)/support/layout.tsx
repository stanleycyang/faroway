import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export const metadata: Metadata = {
  title: "Support & FAQ — Faroway Help Center",
  description:
    "Get help with Faroway. Browse support topics, read FAQs about AI trip planning, offline access, bookings, privacy, and more. Contact our support team.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support & FAQ — Faroway Help Center",
    description:
      "Get help with Faroway. Browse support topics, read FAQs about AI trip planning, offline access, bookings, and more.",
    type: "website",
    url: `${baseUrl}/support`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Support & FAQ — Faroway Help Center",
    description:
      "Get help with Faroway. Browse support topics, read FAQs about AI trip planning, offline access, bookings, and more.",
  },
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
