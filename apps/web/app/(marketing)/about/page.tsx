import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Globe,
  Shield,
  Sparkles,
  Heart,
  Clock,
  Zap,
  WifiOff,
  MapPin,
  ChevronDown,
  Download,
  Check,
  Users,
  Compass,
  Target,
  Lightbulb,
} from 'lucide-react';
import { FadeInOnScroll } from '@/components/landing/FadeInOnScroll';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { IMAGE_PATHS, getImageUrl } from '@tripgenie/constants';

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

const painPoints = [
  {
    icon: Clock,
    color: 'bg-red-100 text-red-600',
    title: 'Hours of research',
    description: 'Spending days scouring blogs, reviews, and forums just to build a basic itinerary.',
  },
  {
    icon: Compass,
    color: 'bg-orange-100 text-orange-600',
    title: 'Tab overload',
    description: 'Juggling 20+ browser tabs comparing hotels, flights, restaurants, and attractions.',
  },
  {
    icon: Target,
    color: 'bg-amber-100 text-amber-600',
    title: 'Generic recommendations',
    description: 'Getting the same tourist traps everyone else visits instead of hidden local gems.',
  },
  {
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-600',
    title: 'Outdated info',
    description: 'Arriving at a "must-visit" restaurant only to find it closed months ago.',
  },
];

const approachCards = [
  {
    title: 'Personal, Not Generic',
    description: 'AI learns your travel vibes — whether you crave street food or Michelin stars, sunrise hikes or sunset cocktails.',
    image: getImageUrl(IMAGE_PATHS.marketing.travelDiscovery),
    imageAlt: 'Traveler overlooking a tropical valley at sunrise',
    icon: Heart,
  },
  {
    title: 'Seconds, Not Hours',
    description: 'Complete day-by-day itineraries with restaurants, activities, and local tips — generated in under 60 seconds.',
    image: getImageUrl(IMAGE_PATHS.marketing.aerialTravel),
    imageAlt: 'Aerial view of turquoise waters and lush green islands',
    icon: Zap,
  },
  {
    title: 'Local, Not Tourist',
    description: 'Hidden gems and local favorites that most visitors never find. Eat, explore, and experience like a local.',
    image: getImageUrl(IMAGE_PATHS.marketing.galleryVenice),
    imageAlt: 'Venice canal at sunset with gondolas',
    icon: MapPin,
  },
  {
    title: 'Offline, Always',
    description: 'Your full itinerary saved on your device. No Wi-Fi at the temple? No problem — everything works offline.',
    image: getImageUrl(IMAGE_PATHS.marketing.travelPlanning),
    imageAlt: 'Traveler with backpack on a scenic mountain path',
    icon: WifiOff,
  },
];

const values = [
  {
    icon: Globe,
    gradient: 'from-teal-500 to-emerald-500',
    title: 'Accessibility',
    description: 'Great travel experiences shouldn\'t be reserved for the privileged few. TripGenie is free forever — because everyone deserves to explore the world.',
  },
  {
    icon: Shield,
    gradient: 'from-blue-500 to-indigo-500',
    title: 'Privacy First',
    description: 'Your travel data stays yours. We never sell personal information, and our offline-first architecture means your trips live on your device.',
  },
  {
    icon: Sparkles,
    gradient: 'from-primary to-amber-500',
    title: 'Craftsmanship',
    description: 'Every itinerary is crafted with care. We obsess over the details — the perfect restaurant order, the best time to visit, the hidden shortcut — so you don\'t have to.',
  },
];

const timeline = [
  {
    label: 'The Spark',
    description: 'Founded with a simple idea: what if AI could plan trips better than humans? What if the best travel advice wasn\'t locked behind expensive agencies?',
    icon: Lightbulb,
  },
  {
    label: 'First Launch',
    description: 'Mobile app launched on iOS and Android with full offline support. Travelers started generating personalized itineraries in under 60 seconds.',
    icon: Zap,
  },
  {
    label: 'Growing & Improving',
    description: 'Three specialized AI agents for hotels, activities, and dining. Real affiliate integrations with Booking.com, Viator, and more. A growing blog with 200+ destination guides.',
    icon: Users,
  },
  {
    label: 'What\'s Next',
    description: 'Expanding into real-time booking, group trip planning, and AI travel companion features. The best is yet to come.',
    icon: Compass,
  },
];

// ─── About Page ──────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white antialiased text-slate-900 overflow-x-hidden">
      <Header />

      {/* ─── 1. Hero — "Where Every Journey Begins" ───────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.oceanHero)}
          alt="Aerial view of stunning turquoise ocean waters and tropical islands"
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
              We believe the world&apos;s best trips{' '}
              <span className="text-gradient-hero">shouldn&apos;t take weeks to plan</span>
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
              TripGenie is an AI-powered travel planner that turns your dream
              destination into a complete, personalized itinerary — in seconds,
              not weeks. Because life&apos;s too short to spend it planning instead
              of exploring.
            </p>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-white/60 text-xs font-medium tracking-widest uppercase">Our Story</span>
          <ChevronDown className="w-5 h-5 text-white/40 animate-bounce" />
        </div>
      </section>

      {/* ─── 2. Mission Statement ─────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-8 text-primary-600 text-sm font-medium">
                <Target className="w-4 h-4" /> Our Mission
              </div>

              <blockquote className="text-3xl lg:text-4xl xl:text-5xl font-bold text-slate-900 leading-tight mb-8">
                &ldquo;To make world-class travel planning{' '}
                <span className="text-gradient">instant, personal, and accessible</span>{' '}
                to everyone.&rdquo;
              </blockquote>

              <div className="max-w-2xl mx-auto space-y-4 text-lg text-slate-600 leading-relaxed">
                <p>
                  We started TripGenie because we were tired of the same problem
                  every traveler faces: spending more time planning the trip than
                  enjoying it. The best travel advice was locked behind expensive
                  agencies or buried in endless blog posts.
                </p>
                <p>
                  So we built an AI that combines the knowledge of thousands of
                  travelers with the personalization of a private concierge —
                  and made it free for everyone.
                </p>
              </div>
            </div>
          </FadeInOnScroll>
        </div>
      </section>

      {/* ─── 3. The Problem We Solve ──────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-1.5 mb-4 text-red-600 text-sm font-medium">
                <Lightbulb className="w-4 h-4" /> Why We Exist
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Travel planning is{' '}
                <span className="text-gradient">broken</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                We love traveling. We just hated everything that came before the actual trip.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-4">
              {painPoints.map((point, i) => (
                <FadeInOnScroll key={point.title} delay={i * 100}>
                  <div className="flex items-start gap-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                    <div className={`w-12 h-12 rounded-xl ${point.color} flex items-center justify-center flex-shrink-0`}>
                      <point.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">{point.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{point.description}</p>
                    </div>
                  </div>
                </FadeInOnScroll>
              ))}
            </div>

            <FadeInOnScroll delay={200}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10">
                <Image
                  src={getImageUrl(IMAGE_PATHS.marketing.galleryLakeBled)}
                  alt="Scenic lake surrounded by mountains at sunrise"
                  width={600}
                  height={500}
                  className="object-cover w-full h-[400px] lg:h-[500px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5">
                  <p className="text-white font-bold text-lg drop-shadow-lg">This is why you travel.</p>
                  <p className="text-white/70 text-sm">Let AI handle the planning.</p>
                </div>
              </div>
            </FadeInOnScroll>
          </div>
        </div>
      </section>

      {/* ─── 4. Our Approach — Bento Grid ─────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-full px-4 py-1.5 mb-4 text-accent-600 text-sm font-medium">
                <Sparkles className="w-4 h-4" /> Our Approach
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                AI that understands{' '}
                <span className="text-gradient">how you travel</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Not another generic recommendation engine. TripGenie learns your style.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-2 gap-4 lg:gap-5">
            {approachCards.map((card, i) => (
              <FadeInOnScroll key={card.title} delay={i * 100}>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[320px]">
                  <Image
                    src={card.image}
                    alt={card.imageAlt}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/70 to-surface-950/30" />
                  <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-amber-500/30 border border-white/15 flex items-center justify-center mb-4 backdrop-blur-sm">
                      <card.icon className="w-6 h-6 text-primary-300" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                    <p className="text-white/60 leading-relaxed text-sm">{card.description}</p>
                  </div>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. What You Get — Capabilities ──────────────────────────── */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <Image
          src={getImageUrl(IMAGE_PATHS.marketing.campingAdventure)}
          alt="Campfire on a cliff overlooking a breathtaking mountain valley at golden hour"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-950/80 via-surface-950/60 to-surface-950/80" />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeInOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                Built for real travelers
              </h2>
              <p className="text-white/60 text-lg">Here&apos;s what TripGenie delivers</p>
            </div>
          </FadeInOnScroll>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { value: '< 60s', label: 'Full Itinerary Generation', icon: Zap },
              { value: '3 AI Agents', label: 'Hotels, Activities & Dining', icon: Sparkles },
              { value: '100% Free', label: 'No Account Required', icon: Globe },
              { value: 'Offline', label: 'Works Without Wi-Fi', icon: WifiOff },
            ].map((stat, i) => (
              <FadeInOnScroll key={stat.label} delay={i * 100}>
                <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-6 lg:p-8 text-center">
                  <stat.icon className="w-6 h-6 text-primary-300 mx-auto mb-3" />
                  <div className="text-2xl lg:text-3xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <p className="text-white/60 text-sm font-medium">{stat.label}</p>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. Our Values ────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-4 text-primary-600 text-sm font-medium">
                <Heart className="w-4 h-4" /> Our Values
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                What drives us{' '}
                <span className="text-gradient">every day</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                The principles behind every feature we build and every decision we make.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-3 gap-5">
            {values.map((value, i) => (
              <FadeInOnScroll key={value.title} delay={i * 150}>
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all h-full">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${value.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                    <value.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{value.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{value.description}</p>
                </div>
              </FadeInOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. The Journey — Timeline ────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 text-amber-600 text-sm font-medium">
                <Clock className="w-4 h-4" /> Our Journey
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                From idea to{' '}
                <span className="text-gradient">your pocket</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                The milestones that brought TripGenie to life.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 lg:-translate-x-px" />

            <div className="space-y-12">
              {timeline.map((item, i) => (
                <FadeInOnScroll key={item.label} delay={i * 150}>
                  <div className={`relative flex items-start gap-6 lg:gap-12 ${
                    i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
                  }`}>
                    {/* Dot */}
                    <div className="absolute left-6 lg:left-1/2 w-3 h-3 bg-gradient-to-br from-primary to-amber-500 rounded-full -translate-x-1.5 mt-2 shadow-lg shadow-primary/25 z-10" />

                    {/* Content */}
                    <div className={`ml-14 lg:ml-0 lg:w-[calc(50%-2rem)] ${
                      i % 2 === 0 ? 'lg:text-right lg:pr-8' : 'lg:text-left lg:pl-8'
                    }`}>
                      <div className={`inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-3 py-1 mb-3 ${
                        i % 2 === 0 ? '' : ''
                      }`}>
                        <item.icon className="w-3.5 h-3.5 text-primary-600" />
                        <span className="text-primary-600 text-xs font-semibold">{item.label}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{item.description}</p>
                    </div>

                    {/* Spacer for the other side */}
                    <div className="hidden lg:block lg:w-[calc(50%-2rem)]" />
                  </div>
                </FadeInOnScroll>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. CTA — Download / Start Planning ──────────────────────── */}
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
              Ready to plan your{' '}
              <span className="text-gradient-hero">dream trip</span>?
            </h2>
            <p className="text-xl text-white/70 mb-8 leading-relaxed max-w-2xl mx-auto">
              A complete, personalized itinerary with hotels, activities, and
              restaurants — generated in under 60 seconds. No sign-up required.
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Link
                href="/create"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg shadow-primary/25 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/35"
              >
                <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
                Plan My Trip &mdash; Free
              </Link>
              <a
                href="#download-app"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                Download the App
              </a>
            </div>

            <div id="download-app">
              <AppStoreButtons className="justify-center mb-8" />
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {[
                '100% free',
                'No account needed',
                'Works offline',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-white/80 text-sm">
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
