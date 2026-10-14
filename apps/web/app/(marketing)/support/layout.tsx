import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export const metadata: Metadata = {
  title: "Support & FAQ — Help Center",
  description:
    "Get help with Faroway. Browse support topics, read FAQs about AI trip planning, offline access, bookings, privacy, and more. Contact our support team.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Support & FAQ — Help Center",
    description:
      "Get help with Faroway. Browse support topics, read FAQs about AI trip planning, offline access, bookings, and more.",
    type: "website",
    url: `${baseUrl}/support`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Support & FAQ — Help Center",
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
        text: "Faroway is free to start. We earn revenue through affiliate commissions when you book a hotel or activity through a partner link in your itinerary. Partner prices, availability, and terms are shown by the provider before you book.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI trip planning work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Simply enter your destination, travel dates, and preferences (like travel style and interests). Our AI creates a personalized day-by-day itinerary with activities, restaurants, and local tips tailored to your interests.",
      },
    },
    {
      "@type": "Question",
      name: "Can I adjust my itinerary after it's generated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can review the generated plan, save it, share it, and use it as a starting point for your trip. Individual activity editing and rearranging are not part of the current release.",
      },
    },
    {
      "@type": "Question",
      name: "How do I delete my account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can delete your account from the mobile app Profile tab by tapping Delete Account. Your personal data will be removed within 30 days of deletion. If you need help, contact us at support@faroway.ai.",
      },
    },
    {
      "@type": "Question",
      name: "Does the app work offline?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Saved trip itineraries are stored locally on your device so you can revisit them without an internet connection. Changes sync when you're signed in and back online.",
      },
    },
    {
      "@type": "Question",
      name: "What data do you collect?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We collect your account information (email, name via OAuth), travel preferences, trip data, and affiliate click/conversion data when you interact with booking links. We never sell your personal data. Affiliate partners only receive a referral ID — not your name or email. For full details, see our Privacy Policy at faroway.ai/privacy.",
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
        text: "Faroway can help with many destinations worldwide, including popular cities, regions, and route-based trips. Results depend on available partner inventory and destination data.",
      },
    },
    {
      "@type": "Question",
      name: "Can I plan trips for groups?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can create itineraries and share them with your travel companions via a link. Collaborative editing, voting, and shared decision tools are not part of the current product.",
      },
    },
    {
      "@type": "Question",
      name: "How do I share my itinerary?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can share your itinerary by tapping the share button on any saved trip. This generates a shareable link that anyone with the link can view, and you can send it through your device's share sheet.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if AI generates a bad recommendation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI-generated travel suggestions can be incomplete or occasionally wrong, so verify important details such as hours, prices, safety, and cancellation terms with the venue or booking partner before you rely on them.",
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
