import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppDownloadBanner } from "@/components/AppDownloadBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tripgenie.ai';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "TripGenie - AI-Powered Travel Planning | Create Itineraries in 60 Seconds",
    template: "%s | TripGenie",
  },
  description: "Plan your dream trip with AI. Get personalized day-by-day itineraries, find hotels, flights, and activities. Free to use, instant results. Join 50,000+ happy travelers.",
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
  authors: [{ name: "TripGenie Team" }],
  creator: "TripGenie",
  publisher: "TripGenie",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "TripGenie",
    title: "TripGenie - AI-Powered Travel Planning",
    description: "Create personalized travel itineraries in 60 seconds with AI. Hotels, flights, activities—all planned for you.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TripGenie - Plan Your Perfect Trip with AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TripGenie - AI-Powered Travel Planning",
    description: "Create personalized travel itineraries in 60 seconds with AI.",
    images: ["/og-image.png"],
    creator: "@tripgenie",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: baseUrl,
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
  name: "TripGenie",
  url: baseUrl,
  logo: `${baseUrl}/icon.png`,
  sameAs: [
    "https://twitter.com/tripgenie",
    "https://instagram.com/tripgenie",
    "https://facebook.com/tripgenie",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "support@tripgenie.ai",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TripGenie",
  url: baseUrl,
  description: "AI-powered travel planning platform that creates personalized itineraries in seconds",
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
  name: "TripGenie",
  applicationCategory: "TravelApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "12000",
    bestRating: "5",
    worstRating: "1",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-primary focus:rounded-lg focus:shadow-lg">
          Skip to main content
        </a>
        <AppDownloadBanner />
        <div id="main-content">
          {children}
        </div>
      </body>
    </html>
  );
}
