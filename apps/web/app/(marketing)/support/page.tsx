import React from "react";
import Image from "next/image";
import {
  Rocket,
  Map,
  User,
  CreditCard,
  WifiOff,
  Shield,
  ChevronDown,
  Sparkles,
  Mail,
  MessageCircle,
  Check,
  ArrowRight,
} from "lucide-react";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { FAQAccordion } from "@/components/support/FAQAccordion";
import { AppStoreButtons } from "@/components/AppStoreButtons";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// ─── Data ────────────────────────────────────────────────────────────────────

const helpCategories = [
  {
    icon: Rocket,
    gradient: "from-blue-500 to-indigo-500",
    title: "Getting Started",
    description: "Start your first AI-powered trip with guided preferences.",
    bullets: [
      "Creating your first trip",
      "Choosing travel vibes & preferences",
      "How AI generates your itinerary",
      "Saving and organizing trips",
    ],
  },
  {
    icon: Map,
    gradient: "from-emerald-500 to-teal-500",
    title: "Trip Planning",
    description: "Review, save, and share generated itineraries.",
    bullets: [
      "Reviewing your day-by-day plan",
      "Saving generated itineraries",
      "Sharing trips with friends",
      "Understanding itinerary limits",
    ],
  },
  {
    icon: User,
    gradient: "from-violet-500 to-purple-500",
    title: "Account & Login",
    description: "Manage your account, profile, and preferences.",
    bullets: [
      "Signing up with Google or Apple",
      "Updating your profile settings",
      "Resetting your password",
      "Deleting your account",
    ],
  },
  {
    icon: CreditCard,
    gradient: "from-primary to-amber-500",
    title: "Bookings & Payments",
    description: "How affiliate bookings and pricing work.",
    bullets: [
      "Third-party hotel reservations",
      "Viator tours and activities",
      "Faroway is free to start",
      "Refunds handled by providers",
    ],
  },
  {
    icon: WifiOff,
    gradient: "from-sky-500 to-blue-500",
    title: "Offline & Sync",
    description: "Revisit saved trips when connectivity is limited.",
    bullets: [
      "Using saved trips offline",
      "How signed-in sync works",
      "Managing device storage",
      "Signed-in device access",
    ],
  },
  {
    icon: Shield,
    gradient: "from-rose-500 to-pink-500",
    title: "Privacy & Security",
    description: "How we protect your data and respect your privacy.",
    bullets: [
      "What data we collect",
      "Encryption and secure storage",
      "GDPR compliance",
      "Data deletion requests",
    ],
  },
];

const quickStartSteps = [
  {
    step: 1,
    title: "Choose your destination",
    description:
      "Pick a destination, then set your travel dates and group size.",
    image: getImageUrl(IMAGE_PATHS.marketing.travelPlanning),
    imageAlt: "Traveler with backpack on scenic mountain path",
  },
  {
    step: 2,
    title: "Pick your travel vibes",
    description:
      "Select what matters to you — foodie, adventure, culture, relaxation, nightlife, and more.",
    image: getImageUrl(IMAGE_PATHS.marketing.travelDiscovery),
    imageAlt: "Traveler overlooking tropical valley at sunrise",
  },
  {
    step: 3,
    title: "AI builds your itinerary",
    description:
      "Watch your day-by-day plan build with restaurants, activities, and local tips.",
    image: getImageUrl(IMAGE_PATHS.marketing.aerialTravel),
    imageAlt: "Aerial view of turquoise waters and lush green islands",
  },
];

const faqItems = [
  {
    question: "Is Faroway really free?",
    answer:
      "Faroway is free to start. We earn revenue through affiliate commissions when you book a hotel or activity through a partner link in your itinerary. Partner prices, availability, and terms are shown by the provider before you book.",
  },
  {
    question: "How does AI trip planning work?",
    answer:
      "Simply enter your destination, travel dates, and preferences (like travel style and interests). Our AI creates a personalized day-by-day itinerary with activities, restaurants, and local tips tailored to your interests.",
  },
  {
    question: "Can I adjust my itinerary after it's generated?",
    answer:
      "You can review the generated plan, save it, share it, and use it as a starting point for your trip. Individual activity editing and rearranging are not part of the current release.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "You can delete your account from the mobile app Profile tab by tapping Delete Account. Your personal data will be removed within 30 days of deletion. If you need help, contact us at support@faroway.ai.",
  },
  {
    question: "Does the app work offline?",
    answer:
      "Saved trip itineraries are stored locally on your device so you can revisit them without an internet connection. Changes sync when you're signed in and back online.",
  },
  {
    question: "What data do you collect?",
    answer:
      "We collect your account information (email, name via OAuth), travel preferences, trip data, and affiliate click/conversion data when you interact with booking links. We never sell your personal data. Affiliate partners only receive a referral ID \u2014 not your name or email. For full details, see our Privacy Policy at faroway.ai/privacy.",
  },
  {
    question: "How are bookings handled?",
    answer:
      "Faroway is not a travel agency or booking platform. We provide affiliate links to third-party providers like Viator (tours and activities). When you click a link and complete a booking, your contract is directly with that provider \u2014 not with us. All pricing, availability, cancellations, refunds, and customer service are handled entirely by the booking provider under their own terms.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We use Supabase for secure cloud storage with encryption in transit (TLS) and at rest. On mobile, sensitive tokens are stored using Expo SecureStore. We conduct regular security reviews to protect your data.",
  },
  {
    question: "Which countries does Faroway support?",
    answer:
      "Faroway can help with many destinations worldwide, including popular cities, regions, and route-based trips. Results depend on available partner inventory and destination data.",
  },
  {
    question: "Can I plan trips for groups?",
    answer:
      "You can create itineraries and share them with your travel companions via a link. Collaborative editing, voting, and shared decision tools are not part of the current product.",
  },
  {
    question: "How do I share my itinerary?",
    answer:
      "You can share your itinerary by tapping the share button on any saved trip. This generates a shareable link that anyone with the link can view, and you can send it through your device's share sheet.",
  },
  {
    question: "What happens if AI generates a bad recommendation?",
    answer:
      "AI-generated travel suggestions can be incomplete or occasionally wrong, so verify important details such as hours, prices, safety, and cancellation terms with the venue or booking partner before you rely on them.",
  },
];

// ─── Support Page ────────────────────────────────────────────────────────────

export default function SupportPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white antialiased text-slate-900 overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      {/* ─── 1. Hero — "How Can We Help?" ───────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.roadTrip)}
          alt="Traveler with a map on an open road surrounded by scenic mountains"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.08] mb-6 tracking-tight text-white">
              We&apos;re here to help you{" "}
              <span className="text-gradient-hero">travel smarter</span>
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
              Browse our help topics, check the FAQ, or reach out to our support
              team. Whatever you need, we&apos;ve got you covered — so you can
              focus on the adventure.
            </p>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-white/60 text-xs font-medium tracking-widest uppercase">
            Browse Topics
          </span>
          <ChevronDown className="w-5 h-5 text-white/40 animate-bounce" />
        </div>
      </section>

      {/* ─── 2. Help Categories — Interactive Cards Grid ────────────────── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-4 text-primary-600 text-sm font-medium">
                <Sparkles className="w-4 h-4" /> Help Topics
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Find answers <span className="text-gradient">fast</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Browse by topic to find the help you need.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {helpCategories.map((category, i) => (
              <FadeInOnScroll key={category.title} delay={i * 80}>
                <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all h-full group">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-105 transition-transform`}
                  >
                    <category.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {category.title}
                  </h3>
                  <p className="text-slate-500 mb-4 text-sm">
                    {category.description}
                  </p>
                  <ul className="space-y-2">
                    {category.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-slate-600"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. Quick Start Guide — Visual Steps ───────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-full px-4 py-1.5 mb-4 text-accent-600 text-sm font-medium">
                <Rocket className="w-4 h-4" /> Quick Start
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Plan your first trip in{" "}
                <span className="text-gradient">3 easy steps</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                From destination to a structured itinerary draft.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-3 gap-5">
            {quickStartSteps.map((step, i) => (
              <FadeInOnScroll key={step.step} delay={i * 150}>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[360px]">
                  <Image
                    src={step.image}
                    alt={step.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/60 to-surface-950/20" />
                  <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center mb-4 text-white font-bold text-lg shadow-lg">
                      {step.step}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-white/70 leading-relaxed text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. Full-Bleed Scenic Divider ──────────────────────────────── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.campingAdventure)}
          alt="Campfire on a cliff overlooking a breathtaking mountain valley at golden hour"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-950/80 via-surface-950/60 to-surface-950/80" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeInOnScroll>
            <blockquote className="text-2xl lg:text-4xl font-bold text-white leading-tight mb-6">
              &ldquo;The best journeys answer questions that in the beginning
              you didn&apos;t even think to ask.&rdquo;
            </blockquote>
            <cite className="text-white/60 text-lg font-medium not-italic">
              &mdash; Jeff Johnson
            </cite>
          </FadeInOnScroll>
        </div>
      </section>

      {/* ─── 5. FAQ — Expanded Accordion ───────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 text-amber-600 text-sm font-medium">
                <MessageCircle className="w-4 h-4" /> FAQ
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Frequently asked{" "}
                <span className="text-gradient">questions</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Quick answers to the most common questions about Faroway.
              </p>
            </div>
          </FadeInOnScroll>

          <FadeInOnScroll delay={100}>
            <FAQAccordion items={faqItems} />
          </FadeInOnScroll>
        </div>
      </section>

      {/* ─── 6. Contact CTA ────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-4 text-primary-600 text-sm font-medium">
                <Mail className="w-4 h-4" /> Contact Us
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Still need <span className="text-gradient">help</span>?
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Our team is here for you. Reach out and we&apos;ll get back to
                you as soon as possible.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-2 gap-5">
            <FadeInOnScroll delay={100}>
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all text-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Email Support
                </h3>
                <p className="text-slate-500 mb-5 text-sm leading-relaxed">
                  Send us an email and we&apos;ll get back to you within 24
                  hours. We read every message.
                </p>
                <a
                  href="mailto:support@faroway.ai"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-all hover:-translate-y-0.5 shadow-md"
                >
                  <Mail className="w-4 h-4" />
                  support@faroway.ai
                </a>
              </div>
            </FadeInOnScroll>

            <FadeInOnScroll delay={200}>
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all text-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Privacy Requests
                </h3>
                <p className="text-slate-500 mb-5 text-sm leading-relaxed">
                  Ask for a copy of your data, request corrections, or get help
                  with account deletion and privacy rights.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <a
                    href="mailto:privacy@faroway.ai"
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    privacy@faroway.ai
                  </a>
                  <a
                    href="/privacy"
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Privacy Policy
                  </a>
                </div>
              </div>
            </FadeInOnScroll>
          </div>
        </div>
      </section>

      {/* ─── 7. Download App CTA ───────────────────────────────────────── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.ctaBackground)}
          alt="Silhouette of a traveler looking at a stunning colorful sunset over the ocean"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/85 to-surface-950/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950/60 to-transparent" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeInOnScroll>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-white">
              Better experience on{" "}
              <span className="text-gradient-hero">mobile</span>
            </h2>
            <p className="text-xl text-white/70 mb-8 leading-relaxed max-w-2xl mx-auto">
              Download Faroway for saved-trip offline access, partner options,
              and itinerary-ready alerts. Your trips, available when you need
              them.
            </p>

            <AppStoreButtons className="justify-center mb-8" />

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {[
                "Free to start",
                "Saved trips offline",
                "No account needed",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-white/80 text-sm"
                >
                  <Check className="w-4 h-4 text-accent flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      <Footer />
    </div>
  );
}
