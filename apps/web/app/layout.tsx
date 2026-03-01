import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  fallback: ["system-ui", "arial"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default:
      "Faroway - AI-Powered Travel Planning | Create Itineraries in 60 Seconds",
    template: "%s | Faroway",
  },
  description:
    "Plan your dream trip with AI. Get personalized day-by-day itineraries, find hotels, activities, and restaurants. 100% free, no account needed, works offline.",
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
      "Create personalized travel itineraries in 60 seconds with AI. Hotels, flights, activities—all planned for you.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Faroway - Plan Your Perfect Trip with AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Faroway - AI-Powered Travel Planning",
    description:
      "Create personalized travel itineraries in 60 seconds with AI.",
    images: ["/og-image.png"],
    creator: "@faroway",
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
  sameAs: [
    "https://twitter.com/faroway",
    "https://instagram.com/faroway",
    "https://facebook.com/faroway",
  ],
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
    "AI-powered travel planning platform that creates personalized itineraries in seconds",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${baseUrl}/?destination={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Faroway",
  applicationCategory: "TravelApplication",
  operatingSystem: "Web, iOS, Android",
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
    <html lang="en">
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
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-primary focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
