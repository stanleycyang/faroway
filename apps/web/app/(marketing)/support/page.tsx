'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  Download,
  Check,
  ArrowRight,
} from 'lucide-react';
import { IMAGE_PATHS, getImageUrl } from '@tripgenie/constants';
import { FadeInOnScroll } from '@/components/landing/FadeInOnScroll';
import { FAQAccordion } from '@/components/support/FAQAccordion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

// ─── App Store Buttons ───────────────────────────────────────────────────────

function AppStoreButtons({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a
        href="https://apps.apple.com/app/tripgenie"
        className="inline-flex items-center gap-3 bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-3 rounded-2xl font-semibold text-white transition-all backdrop-blur-sm hover:-translate-y-0.5"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        <div className="text-left">
          <div className="text-[10px] opacity-70">Download on the</div>
          <div className="text-base leading-tight">App Store</div>
        </div>
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=com.tripgenie"
        className="inline-flex items-center gap-3 bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-3 rounded-2xl font-semibold text-white transition-all backdrop-blur-sm hover:-translate-y-0.5"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
        </svg>
        <div className="text-left">
          <div className="text-[10px] opacity-70">GET IT ON</div>
          <div className="text-base leading-tight">Google Play</div>
        </div>
      </a>
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const helpCategories = [
  {
    icon: Rocket,
    gradient: 'from-blue-500 to-indigo-500',
    title: 'Getting Started',
    description: 'Create your first AI-powered trip in seconds.',
    bullets: [
      'Creating your first trip',
      'Choosing travel vibes & preferences',
      'How AI generates your itinerary',
      'Saving and organizing trips',
    ],
  },
  {
    icon: Map,
    gradient: 'from-emerald-500 to-teal-500',
    title: 'Trip Planning',
    description: 'Edit, customize, and share your itineraries.',
    bullets: [
      'Editing your day-by-day itinerary',
      'Adding or removing activities',
      'Sharing trips with friends',
      'Exporting your itinerary',
    ],
  },
  {
    icon: User,
    gradient: 'from-violet-500 to-purple-500',
    title: 'Account & Login',
    description: 'Manage your account, profile, and preferences.',
    bullets: [
      'Signing up with Google or Apple',
      'Updating your profile settings',
      'Resetting your password',
      'Deleting your account',
    ],
  },
  {
    icon: CreditCard,
    gradient: 'from-primary to-amber-500',
    title: 'Bookings & Payments',
    description: 'How affiliate bookings and pricing work.',
    bullets: [
      'Booking.com hotel reservations',
      'Viator tours and activities',
      'TripGenie is 100% free to use',
      'Refunds handled by providers',
    ],
  },
  {
    icon: WifiOff,
    gradient: 'from-sky-500 to-blue-500',
    title: 'Offline & Sync',
    description: 'Access your trips anywhere, even without Wi-Fi.',
    bullets: [
      'Using trips offline',
      'How automatic sync works',
      'Managing device storage',
      'Multi-device access',
    ],
  },
  {
    icon: Shield,
    gradient: 'from-rose-500 to-pink-500',
    title: 'Privacy & Security',
    description: 'How we protect your data and respect your privacy.',
    bullets: [
      'What data we collect',
      'Encryption and secure storage',
      'GDPR compliance',
      'Data deletion requests',
    ],
  },
];

const quickStartSteps = [
  {
    step: 1,
    title: 'Choose your destination',
    description: 'Pick from 195+ countries worldwide. Set your travel dates and group size.',
    image: getImageUrl(IMAGE_PATHS.marketing.travelPlanning),
    imageAlt: 'Traveler with backpack on scenic mountain path',
  },
  {
    step: 2,
    title: 'Pick your travel vibes',
    description: 'Select what matters to you — foodie, adventure, culture, relaxation, nightlife, and more.',
    image: getImageUrl(IMAGE_PATHS.marketing.travelDiscovery),
    imageAlt: 'Traveler overlooking tropical valley at sunrise',
  },
  {
    step: 3,
    title: 'AI builds your itinerary',
    description: 'In under 60 seconds, get a complete day-by-day plan with restaurants, activities, and local tips.',
    image: getImageUrl(IMAGE_PATHS.marketing.aerialTravel),
    imageAlt: 'Aerial view of turquoise waters and lush green islands',
  },
];

const faqItems = [
  {
    question: 'Is TripGenie really free?',
    answer:
      'Yes! TripGenie is completely free to use. We earn revenue through affiliate commissions \u2014 when you book a hotel or activity through a link in your itinerary, the provider (like Booking.com or Viator) pays us a small referral fee. You pay the same price as if you booked directly. This affiliate model is how we keep the service free for everyone.',
  },
  {
    question: 'How does AI trip planning work?',
    answer:
      'Simply enter your destination, travel dates, and preferences (like travel style and interests). Our AI analyzes thousands of data points to create a personalized day-by-day itinerary with activities, restaurants, and local tips tailored to your interests.',
  },
  {
    question: "Can I edit my itinerary after it's generated?",
    answer:
      'Absolutely! Every generated itinerary is fully editable. You can add, remove, or rearrange activities, change restaurants, adjust timing, and customize every detail to make it perfect for your trip.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'You can delete your account by going to Settings \u2192 Account \u2192 Delete Account in the mobile app. Your personal data will be removed within 30 days of deletion. If you need help, contact us at support@tripgenie.ai.',
  },
  {
    question: 'Does the app work offline?',
    answer:
      "Yes! TripGenie uses an offline-first architecture. Your trip itineraries are stored locally on your device so you can access them without an internet connection. Changes sync automatically when you're back online.",
  },
  {
    question: 'What data do you collect?',
    answer:
      'We collect your account information (email, name via OAuth), travel preferences, trip data, basic usage analytics, and affiliate click/conversion data when you interact with booking links. We never sell your personal data. Affiliate partners only receive a referral ID \u2014 not your name or email. For full details, see our Privacy Policy at tripgenie.ai/privacy.',
  },
  {
    question: 'How are bookings handled?',
    answer:
      'TripGenie is not a travel agency or booking platform. We provide affiliate links to third-party providers like Booking.com (hotels) and Viator (tours and activities). When you click a link and complete a booking, your contract is directly with that provider \u2014 not with us. All pricing, availability, cancellations, refunds, and customer service are handled entirely by the booking provider under their own terms.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. We use Supabase for secure cloud storage with encryption in transit (TLS) and at rest. On mobile, sensitive tokens are stored using Expo SecureStore. We conduct regular security reviews to protect your data.',
  },
  {
    question: 'Which countries does TripGenie support?',
    answer:
      'TripGenie supports 195+ countries worldwide. Whether you\'re planning a trip to Paris, Tokyo, Cape Town, or a hidden gem off the beaten path, our AI can generate a personalized itinerary for virtually any destination on earth.',
  },
  {
    question: 'Can I plan trips for groups?',
    answer:
      'Group trip planning features are coming soon! Currently, you can create itineraries and share them with your travel companions via a link. Full collaborative group planning with voting and shared editing is on our roadmap.',
  },
  {
    question: 'How do I share my itinerary?',
    answer:
      'You can share your itinerary by tapping the share button on any trip. This generates a shareable link that anyone can view. You can also export your itinerary for offline use or share it directly via messaging apps.',
  },
  {
    question: 'What happens if AI generates a bad recommendation?',
    answer:
      'Every AI-generated itinerary is fully editable. If a recommendation doesn\'t fit your style, you can remove it, swap it for something else, or regenerate that part of the itinerary. You can also provide feedback to help our AI learn and improve.',
  },
];

// ─── Support Page ────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white antialiased text-slate-900 overflow-x-hidden">
      <Header />

      {/* ─── 1. Hero — "How Can We Help?" ───────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.roadTrip)}
          alt="Traveler with a map on an open road surrounded by scenic mountains"
          fill
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
              We&apos;re here to help you{' '}
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
                Find answers{' '}
                <span className="text-gradient">fast</span>
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
                Plan your first trip in{' '}
                <span className="text-gradient">3 easy steps</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                From destination to complete itinerary in under 60 seconds.
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
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-950/80 via-surface-950/60 to-surface-950/80" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeInOnScroll>
            <blockquote className="text-2xl lg:text-4xl font-bold text-white leading-tight mb-6">
              &ldquo;The best journeys answer questions that in the beginning you
              didn&apos;t even think to ask.&rdquo;
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
                Frequently asked{' '}
                <span className="text-gradient">questions</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Quick answers to the most common questions about TripGenie.
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
                Still need{' '}
                <span className="text-gradient">help</span>?
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
                  href="mailto:support@tripgenie.ai"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-all hover:-translate-y-0.5 shadow-md"
                >
                  <Mail className="w-4 h-4" />
                  support@tripgenie.ai
                </a>
              </div>
            </FadeInOnScroll>

            <FadeInOnScroll delay={200}>
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all text-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Social & Community
                </h3>
                <p className="text-slate-500 mb-5 text-sm leading-relaxed">
                  Follow us for travel tips, updates, and to connect with other
                  TripGenie travelers.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <a
                    href="https://twitter.com/tripgenie"
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Twitter
                  </a>
                  <a
                    href="https://instagram.com/tripgenie"
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    Instagram
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
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/85 to-surface-950/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950/60 to-transparent" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeInOnScroll>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-white">
              Better experience on{' '}
              <span className="text-gradient-hero">mobile</span>
            </h2>
            <p className="text-xl text-white/70 mb-8 leading-relaxed max-w-2xl mx-auto">
              Download TripGenie for offline access, GPS navigation, and
              real-time trip updates. Your trips, always in your pocket.
            </p>

            <AppStoreButtons className="justify-center mb-8" />

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {['100% free', 'Works offline', 'No account needed'].map(
                (feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-white/80 text-sm"
                  >
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ),
              )}
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      <Footer />
    </div>
  );
}
