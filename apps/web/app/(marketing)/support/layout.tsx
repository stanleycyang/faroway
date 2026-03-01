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

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Faroway really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Faroway is completely free to use. We earn revenue through affiliate commissions — when you book a hotel or activity through a link in your itinerary, the provider (like Booking.com or Viator) pays us a small referral fee. You pay the same price as if you booked directly. This affiliate model is how we keep the service free for everyone.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI trip planning work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Simply enter your destination, travel dates, and preferences (like travel style and interests). Our AI analyzes thousands of data points to create a personalized day-by-day itinerary with activities, restaurants, and local tips tailored to your interests.",
      },
    },
    {
      "@type": "Question",
      name: "Can I edit my itinerary after it's generated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely! Every generated itinerary is fully editable. You can add, remove, or rearrange activities, change restaurants, adjust timing, and customize every detail to make it perfect for your trip.",
      },
    },
    {
      "@type": "Question",
      name: "How do I delete my account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can delete your account by going to Settings → Account → Delete Account in the mobile app. Your personal data will be removed within 30 days of deletion. If you need help, contact us at support@faroway.ai.",
      },
    },
    {
      "@type": "Question",
      name: "Does the app work offline?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Faroway uses an offline-first architecture. Your trip itineraries are stored locally on your device so you can access them without an internet connection. Changes sync automatically when you're back online.",
      },
    },
    {
      "@type": "Question",
      name: "What data do you collect?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We collect your account information (email, name via OAuth), travel preferences, trip data, basic usage analytics, and affiliate click/conversion data when you interact with booking links. We never sell your personal data. Affiliate partners only receive a referral ID — not your name or email. For full details, see our Privacy Policy at faroway.ai/privacy.",
      },
    },
    {
      "@type": "Question",
      name: "How are bookings handled?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Faroway is not a travel agency or booking platform. We provide affiliate links to third-party providers like Booking.com (hotels) and Viator (tours and activities). When you click a link and complete a booking, your contract is directly with that provider — not with us. All pricing, availability, cancellations, refunds, and customer service are handled entirely by the booking provider under their own terms.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data secure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We use Supabase for secure cloud storage with encryption in transit (TLS) and at rest. On mobile, sensitive tokens are stored using Expo SecureStore. We conduct regular security reviews to protect your data.",
      },
    },
    {
      "@type": "Question",
      name: "Which countries does Faroway support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Faroway supports 195+ countries worldwide. Whether you're planning a trip to Paris, Tokyo, Cape Town, or a hidden gem off the beaten path, our AI can generate a personalized itinerary for virtually any destination on earth.",
      },
    },
    {
      "@type": "Question",
      name: "Can I plan trips for groups?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Group trip planning features are coming soon! Currently, you can create itineraries and share them with your travel companions via a link. Full collaborative group planning with voting and shared editing is on our roadmap.",
      },
    },
    {
      "@type": "Question",
      name: "How do I share my itinerary?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can share your itinerary by tapping the share button on any trip. This generates a shareable link that anyone can view. You can also export your itinerary for offline use or share it directly via messaging apps.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if AI generates a bad recommendation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every AI-generated itinerary is fully editable. If a recommendation doesn't fit your style, you can remove it, swap it for something else, or regenerate that part of the itinerary. You can also provide feedback to help our AI learn and improve.",
      },
    },
  ],
};

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
