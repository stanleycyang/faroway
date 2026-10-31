import { ViatorContentPolicy } from "@/components/trips/ViatorContentPolicy";
import { SkipToContent } from "@/components/SkipToContent";
import { isViatorContentEnabled } from "@/lib/affiliates/viator-policy";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Bundle fonts so production builds do not depend on Google Fonts URL formats.
const plusJakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: "300 800",
  style: "normal",
  fallback: ["system-ui", "arial"],
});

// Editorial serif for the world-map atlas. Full glyph coverage keeps diacritics in
// country names readable ("Côte d'Ivoire", "São Tomé"). Italic style is
// used by the magazine-cover hero numeral ("Forty-Three") on /tools/world-map.
const playfair = localFont({
  src: [
    {
      path: "./fonts/PlayfairDisplay-Variable.woff2",
      weight: "700 900",
      style: "normal",
    },
    {
      path: "./fonts/PlayfairDisplay-Italic-Variable.woff2",
      weight: "700 900",
      style: "italic",
    },
  ],
  variable: "--font-playfair",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Faroway - AI-Powered Travel Planning",
    template: "%s | Faroway",
  },
  description:
    "Plan trips with AI. Get personalized day-by-day itineraries with places to stay, eat, and explore.",
  keywords: [
    "AI travel planner",
    "trip planning app",
    "travel itinerary generator",
    "vacation planner",
    "AI itinerary",
    "personalized travel",
    "trip itinerary",
    "travel planning",
    "holiday planner",
    "destination guide",
  ],
  authors: [{ name: "Faroway Team" }],
  creator: "Faroway",
  publisher: "Faroway",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Faroway",
    title: "Faroway - AI-Powered Travel Planning",
    description:
      "Create personalized travel itineraries with AI. Review hotels, activities, restaurants, and partner options.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Faroway - Plan a Trip with AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Faroway - AI-Powered Travel Planning",
    description: "Create personalized day-by-day travel itineraries with AI.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: baseUrl,
    types: {
      "application/rss+xml": `${baseUrl}/blog/feed.xml`,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  category: "travel",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// JSON-LD Structured Data
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Faroway",
  url: baseUrl,
  logo: `${baseUrl}/icon.png`,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "support@faroway.ai",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Faroway",
  url: baseUrl,
  description:
    "AI-powered travel planning platform for personalized day-by-day itineraries",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/create?destination={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Faroway",
  applicationCategory: "TravelApplication",
  operatingSystem: [
    "Web",
    ...(process.env.NEXT_PUBLIC_APP_STORE_URL ? ["iOS"] : []),
    ...(process.env.NEXT_PUBLIC_PLAY_STORE_URL ? ["Android"] : []),
  ].join(", "),
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${playfair.variable} font-sans antialiased`}
      >
        <SkipToContent />
        <ViatorContentPolicy enabled={isViatorContentEnabled()}>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </ViatorContentPolicy>
        {process.env.NODE_ENV === "production" &&
          process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
