import React from "react";
import { ResilientImage as Image } from "@/components/ResilientImage";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Check,
  Sparkles,
  MapPin,
  WifiOff,
  Zap,
  Globe,
  Compass,
  Heart,
  Download,
  Shield,
  Clock,
  ChevronDown,
  Play,
  Plane,
  Landmark,
  Mountain,
  Palmtree,
  Utensils,
  Music,
  Trees,
  ShoppingBag,
  Camera,
  Layers,
} from "lucide-react";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { AppStoreButtons } from "@/components/AppStoreButtons";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { HAS_MOBILE_STORE_LINKS } from "@/lib/store-links";

// ─── Data ───────────────────────────────────────────────────────────────────

const destinations = [
  {
    name: "Tokyo",
    country: "Japan",
    vibe: "Culture & Tech",
    image: getImageUrl(IMAGE_PATHS.destinations.tokyo),
  },
  {
    name: "Paris",
    country: "France",
    vibe: "Romance & Art",
    image: getImageUrl(IMAGE_PATHS.destinations.paris),
  },
  {
    name: "Bali",
    country: "Indonesia",
    vibe: "Beach & Wellness",
    image: getImageUrl(IMAGE_PATHS.destinations.bali),
  },
  {
    name: "Barcelona",
    country: "Spain",
    vibe: "Beach & Culture",
    image: getImageUrl(IMAGE_PATHS.destinations.barcelona),
  },
  {
    name: "New York",
    country: "USA",
    vibe: "Urban & Nightlife",
    image: getImageUrl(IMAGE_PATHS.destinations["new-york"]),
  },
  {
    name: "Santorini",
    country: "Greece",
    vibe: "Scenic & Romantic",
    image: getImageUrl(IMAGE_PATHS.destinations.santorini),
  },
];

const scenicImages = [
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryMaldives),
    alt: "Crystal-clear tropical beach with turquoise water",
    label: "Maldives",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.gallerySwissAlps),
    alt: "Majestic mountain peaks at golden hour",
    label: "Swiss Alps",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryVenice),
    alt: "Venice canal at sunset with gondolas",
    label: "Venice",
  },
  {
    src: getImageUrl(IMAGE_PATHS.marketing.galleryLakeBled),
    alt: "Scenic lake surrounded by mountains at sunrise",
    label: "Lake Bled",
  },
];

const whyReasons = [
  {
    title: "No more tab overload",
    desc: "Stop juggling 20 browser tabs. Get places to stay, restaurants, and activities in one organized itinerary.",
    Icon: Layers,
  },
  {
    title: "Local secrets, not tourist traps",
    desc: "Our AI recommends hidden gems and authentic experiences that guidebooks miss.",
    Icon: Compass,
  },
  {
    title: "Plans that actually fit you",
    desc: "Tell us your vibes — adventure, foodie, relaxation — and get an itinerary tailored to how you actually travel.",
    Icon: Sparkles,
  },
];

const travelVibes = [
  { label: "Adventure", Icon: Mountain },
  { label: "Relaxation", Icon: Palmtree },
  { label: "Culture", Icon: Landmark },
  { label: "Foodie", Icon: Utensils },
  { label: "Nightlife", Icon: Music },
  { label: "Romantic", Icon: Heart },
  { label: "Nature", Icon: Trees },
  { label: "Shopping", Icon: ShoppingBag },
  { label: "Wellness", Icon: Sparkles },
  { label: "Photography", Icon: Camera },
];

// ─── Landing Page ────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F3] antialiased text-slate-900 overflow-x-hidden">
      <Header />
      <main id="home-main-content" tabIndex={-1}>
        {/* ─── Hero Section — Warm, editorial, conversion-optimized ──────────── */}
        <section className="relative min-h-screen flex items-start overflow-hidden lg:items-center">
          {/* Warm paper gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FAF8F3] via-white to-[#EFF5F3]/70" />
          {/* Subtle decorative blobs */}
          <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-200/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-accent/5 rounded-full blur-3xl" />

          <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-28 lg:pt-36 lg:pb-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — text */}
              <div>
                <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-2 mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-700 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-700" />
                  </span>
                  <span className="text-primary-800 text-sm font-medium">
                    Personalized day-by-day travel planning
                  </span>
                </div>

                <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.08] mb-6 tracking-tight text-slate-900">
                  Your dream trip,
                  <br />
                  planned around{" "}
                  <span className="text-[#C03A31]">your style</span>
                </h1>

                <p className="text-lg lg:text-xl text-slate-600 mb-8 max-w-xl leading-relaxed">
                  Tell us where you&apos;re going and pick your travel vibes.
                  Our AI builds a complete day-by-day itinerary &mdash;
                  restaurants, activities, and local secrets included.
                </p>

                <div className="flex flex-wrap gap-3 mb-8">
                  <Link
                    href="/create"
                    className="group inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg shadow-primary-900/20 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-900/25"
                  >
                    <Sparkles
                      className="w-5 h-5 transition-transform group-hover:rotate-12"
                      aria-hidden="true"
                    />
                    Plan My Trip &mdash; Free
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-8 py-4 rounded-full font-semibold text-lg transition-all hover:-translate-y-0.5 border border-slate-200"
                  >
                    <Play className="w-5 h-5" aria-hidden="true" />
                    See How It Works
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 bg-teal-50 text-accent-700 border border-teal-200 px-3 py-1.5 rounded-full font-medium">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Free to start
                  </div>
                  <div className="flex items-center gap-2 bg-primary-50 text-primary-800 border border-primary-200 px-3 py-1.5 rounded-full font-medium">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Day-by-day itineraries
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full font-medium">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Ready in minutes
                  </div>
                </div>
              </div>

              {/* Right — travel photo with floating itinerary card */}
              <div className="hidden lg:block">
                <div className="relative">
                  {/* Contained travel photo */}
                  <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10">
                    <Image
                      fallbackAlt="Illustrated travel route"
                      src={getImageUrl(IMAGE_PATHS.marketing.beachHero)}
                      alt="Stunning tropical beach with crystal-clear turquoise water"
                      fill
                      sizes="(min-width: 1024px) 50vw, 0px"
                      className="object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 text-white">
                      <p className="text-sm font-medium opacity-80">
                        Featured destination
                      </p>
                      <p className="text-xl font-bold">Bali, Indonesia</p>
                    </div>
                  </div>

                  {/* Floating itinerary card */}
                  <div className="absolute -bottom-6 -left-8 animate-float">
                    <div className="bg-white rounded-2xl p-5 max-w-[280px] shadow-xl shadow-slate-900/10 border border-slate-100">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-[#143D46] flex items-center justify-center shadow-md shadow-slate-900/15">
                          <Sparkles
                            className="w-5 h-5 text-[#FFF5EE]"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">
                            Tokyo Adventure
                          </h3>
                          <p className="text-xs text-slate-600">
                            7 days · 2 travelers
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { day: 1, title: "Arrival & Shibuya", Icon: Plane },
                          {
                            day: 2,
                            title: "Temples of Asakusa",
                            Icon: Landmark,
                          },
                          {
                            day: 3,
                            title: "Mount Fuji Day Trip",
                            Icon: Mountain,
                          },
                        ].map((item) => (
                          <div
                            key={item.day}
                            className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl"
                          >
                            <div className="w-7 h-7 rounded-lg bg-primary-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {item.day}
                            </div>
                            <span className="text-sm font-medium text-slate-700 flex-1">
                              {item.title}
                            </span>
                            <item.Icon
                              className="w-4 h-4 text-[#C03A31] flex-shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-slate-600">
                        <MapPin
                          className="w-3.5 h-3.5 text-[#0F766E] flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-medium">
                          Day-by-day · Tailored to your vibes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Floating speed badge */}
                  <div className="absolute -top-3 -right-3 bg-white rounded-full px-4 py-2 shadow-lg shadow-slate-900/10 border border-slate-100 flex items-center gap-2">
                    <Zap
                      className="w-4 h-4 text-[#C03A31]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      Step-by-step itinerary
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <span className="text-slate-600 text-xs font-medium tracking-widest uppercase">
              Discover
            </span>
            <ChevronDown
              className="w-5 h-5 text-slate-600 animate-bounce"
              aria-hidden="true"
            />
          </div>
        </section>

        {/* ─── Scenic Travel Showcase — Masonry Gallery ────────────────────── */}
        <section className="py-4 bg-[#FAF8F3]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {scenicImages.map((img, i) => (
                <Link
                  key={img.label}
                  href={`/create?destination=${encodeURIComponent(img.label)}`}
                  className="relative overflow-hidden rounded-2xl group cursor-pointer block aspect-[4/3]"
                >
                  <Image
                    fallbackAlt="Illustrated travel route"
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                    priority={i === 0}
                    sizes="(max-width: 1024px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-500" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-bold text-lg drop-shadow-lg">
                      {img.label}
                    </p>
                    <p className="text-white/85 text-sm">Plan with AI →</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Trust Bar ───────────────────────────────────────────────────── */}
        <section className="bg-slate-100 border-y border-slate-200 py-5">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm">
            {[
              {
                icon: (
                  <Check
                    className="w-4 h-4 text-[#0F766E]"
                    aria-hidden="true"
                  />
                ),
                label: "Free to start",
              },
              {
                icon: (
                  <Shield
                    className="w-4 h-4 text-[#0F766E]"
                    aria-hidden="true"
                  />
                ),
                label: "Tailored to your pace",
              },
              {
                icon: (
                  <Sparkles
                    className="w-4 h-4 text-[#C03A31]"
                    aria-hidden="true"
                  />
                ),
                label: "AI-powered planning",
              },
              {
                icon: (
                  <WifiOff
                    className="w-4 h-4 text-[#9B2D25]"
                    aria-hidden="true"
                  />
                ),
                label: "Saved trips offline on mobile",
              },
              {
                icon: (
                  <Globe
                    className="w-4 h-4 text-[#475569]"
                    aria-hidden="true"
                  />
                ),
                label: "Worldwide destinations",
              },
            ].map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-2 font-medium text-slate-700"
              >
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </section>

        {/* ─── Feature Showcase (Bento Grid) ────────────────────────────────── */}
        <section id="features" className="py-20 lg:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInOnScroll>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-4 text-primary-800 text-sm font-medium">
                  <Zap className="w-4 h-4" aria-hidden="true" /> Features
                </div>
                <h2 className="font-editorial text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                  Everything you need for the{" "}
                  <span className="text-[#C03A31]">next trip</span>
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  AI plans it, you enjoy it. From destination inspiration to a
                  structured day-by-day plan — all in one place.
                </p>
              </div>
            </FadeInOnScroll>

            <div className="grid md:grid-cols-2 gap-4 lg:gap-5">
              {/* Hero feature — AI Itinerary with travel image */}
              <FadeInOnScroll className="md:col-span-2">
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[320px] lg:min-h-[360px]">
                  {/* Background travel image */}
                  <Image
                    fallbackAlt="Illustrated travel route"
                    src={getImageUrl(IMAGE_PATHS.marketing.aerialTravel)}
                    alt="Stunning aerial view of turquoise waters and lush green islands"
                    fill
                    sizes="(max-width: 1280px) 100vw, 1280px"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/80 to-surface-950/40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/60 to-transparent" />
                  <div className="relative z-10 p-8 lg:p-10 flex flex-col justify-center h-full">
                    <div className="max-w-lg">
                      <div className="w-14 h-14 rounded-2xl bg-primary-700 flex items-center justify-center mb-5 shadow-lg shadow-primary-900/25">
                        <Sparkles
                          className="w-7 h-7 text-white"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                        AI Itinerary Generation
                      </h3>
                      <p className="text-white/80 text-lg leading-relaxed mb-6">
                        Tell us your destination, dates, and travel style. Our
                        AI creates a complete day-by-day itinerary with
                        activities, restaurants, and local tips as your plan
                        builds.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "Day-by-day plans",
                          "Local restaurants",
                          "Hidden gems",
                          "Personalized",
                        ].map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full text-sm font-medium text-white/85"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>

              {/* Vibe-Based Personalization with image */}
              <FadeInOnScroll delay={100}>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all h-full group min-h-[360px]">
                  <Image
                    fallbackAlt="Illustrated travel route"
                    src={getImageUrl(IMAGE_PATHS.marketing.travelDiscovery)}
                    alt="Adventurous traveler overlooking a tropical valley at sunrise"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/70 to-surface-950/30" />
                  <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-rose-500/30 border border-primary/30 flex items-center justify-center mb-4 backdrop-blur-sm">
                      <Heart
                        className="w-6 h-6 text-primary-200"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      14 Travel Vibes
                    </h3>
                    <p className="text-white/75 leading-relaxed mb-4 text-sm">
                      Choose from Adventure, Foodie, Romantic, Culture,
                      Wellness, and more. Your itinerary is tailored to your
                      personality.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {travelVibes.slice(0, 5).map((v) => (
                        <span
                          key={v.label}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-xs text-white/85"
                        >
                          <v.Icon
                            className="w-3.5 h-3.5 text-primary-200"
                            aria-hidden="true"
                          />
                          {v.label}
                        </span>
                      ))}
                      <span className="px-2.5 py-1 text-xs text-primary-200 font-medium">
                        +9 more
                      </span>
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>

              {/* Partner booking links with image */}
              <FadeInOnScroll delay={200}>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all h-full group min-h-[360px]">
                  <Image
                    fallbackAlt="Illustrated travel route"
                    src={getImageUrl(IMAGE_PATHS.marketing.hotelFeature)}
                    alt="Luxury hotel room overlooking the ocean"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/70 to-surface-950/30" />
                  <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 border border-amber-500/30 flex items-center justify-center mb-4 backdrop-blur-sm">
                      <Zap
                        className="w-6 h-6 text-amber-300"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Travel Suggestions
                    </h3>
                    <p className="text-white/75 leading-relaxed text-sm">
                      Explore hotel suggestions and activities in your
                      itinerary. Confirm current prices and availability
                      directly with the provider.
                    </p>
                  </div>
                </div>
              </FadeInOnScroll>

              {/* Offline + Search — wide row */}
              <FadeInOnScroll delay={100} className="md:col-span-2">
                <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[220px]">
                    <Image
                      fallbackAlt="Illustrated travel route"
                      src={getImageUrl(IMAGE_PATHS.marketing.travelPlanning)}
                      alt="Traveler with backpack walking through a scenic mountain path"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/80 to-surface-950/50" />
                    <div className="relative z-10 p-8 flex items-center gap-5 h-full">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/30 to-emerald-500/30 border border-accent/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <WifiOff
                          className="w-7 h-7 text-accent-300"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          Offline Access on Mobile
                        </h3>
                        <p className="text-white/75 leading-relaxed text-sm">
                          On the Faroway mobile app, saved itineraries are
                          cached locally for limited connectivity. Signed-in
                          trips sync automatically when you&apos;re back online.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[220px]">
                    <Image
                      fallbackAlt="Illustrated travel route"
                      src={getImageUrl(IMAGE_PATHS.marketing.roadTrip)}
                      alt="Map laid out on a table with travel planning accessories"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/80 to-surface-950/50" />
                    <div className="relative z-10 p-8 flex items-center gap-5 h-full">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-sky-500/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <MapPin
                          className="w-7 h-7 text-blue-300"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          Smart Destination Search
                        </h3>
                        <p className="text-white/75 leading-relaxed text-sm">
                          Powered by Google Places — instant autocomplete for
                          any city or destination worldwide.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>
            </div>
          </div>
        </section>

        {/* ─── Full-width scenic divider ────────────────────────────────────── */}
        <section className="relative h-[50vh] lg:h-[60vh]">
          <Image
            fallbackAlt="Illustrated travel route"
            src={getImageUrl(IMAGE_PATHS.marketing.campingAdventure)}
            alt="Campfire on a cliff overlooking a breathtaking mountain valley at golden hour"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-transparent to-surface-950" />
          <div className="absolute inset-0 bg-primary/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FadeInOnScroll>
              <div className="text-center px-4">
                <p className="font-editorial text-3xl lg:text-5xl font-bold text-white max-w-3xl mx-auto leading-tight drop-shadow-2xl">
                  &ldquo;The world is a book, and those who do not travel read
                  only one page.&rdquo;
                </p>
                <p className="text-white/75 mt-4 text-lg italic">
                  — Saint Augustine
                </p>
              </div>
            </FadeInOnScroll>
          </div>
        </section>

        {/* ─── How It Works ─────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 lg:py-28 bg-[#FAF8F3]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInOnScroll>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-4 text-accent-700 text-sm font-medium">
                  <Clock className="w-4 h-4" aria-hidden="true" /> 3 Simple
                  Steps
                </div>
                <h2 className="font-editorial text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                  Build your trip plan in{" "}
                  <span className="text-[#C03A31]">3 simple steps</span>
                </h2>
                <p className="text-xl text-slate-600">
                  From destination idea to a day-by-day itinerary draft
                </p>
              </div>
            </FadeInOnScroll>

            <div className="grid lg:grid-cols-3 gap-5 relative">
              <div className="hidden lg:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 pointer-events-none" />

              {[
                {
                  step: 1,
                  title: "Choose where & when",
                  desc: "Pick your destination with Google Places autocomplete. Set your travel dates and number of travelers.",
                  icon: (
                    <Compass
                      className="w-7 h-7 text-white"
                      aria-hidden="true"
                    />
                  ),
                  gradient: "from-primary-700 to-primary-800",
                  image: getImageUrl(IMAGE_PATHS.marketing.travelDesk),
                  imageAlt:
                    "Flat lay of travel planning essentials including map, camera, and passport",
                },
                {
                  step: 2,
                  title: "Select your vibes",
                  desc: "Choose from 14 travel vibes and pick your traveler type: solo, couple, family, friends, or business.",
                  icon: (
                    <Heart className="w-7 h-7 text-white" aria-hidden="true" />
                  ),
                  gradient: "from-amber-700 to-amber-800",
                  image: getImageUrl(IMAGE_PATHS.marketing.passportJourney),
                  imageAlt: "Friends enjoying a sunset on a tropical beach",
                },
                {
                  step: 3,
                  title: "Generate & save your plan",
                  desc: "Create your day-by-day itinerary, save it to your free account, and explore partner booking options.",
                  icon: (
                    <Sparkles
                      className="w-7 h-7 text-white"
                      aria-hidden="true"
                    />
                  ),
                  gradient: "from-teal-700 to-teal-800",
                  image: getImageUrl(IMAGE_PATHS.marketing.trainJourney),
                  imageAlt:
                    "Hiker overlooking a stunning scenic vista at sunrise",
                },
              ].map((item, i) => (
                <FadeInOnScroll key={item.step} delay={i * 150}>
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 hover:border-primary-700/30 transition-all group h-full shadow-sm hover:shadow-lg bg-white">
                    {/* Background image */}
                    <div className="relative h-44 overflow-hidden">
                      <Image
                        fallbackAlt="Illustrated travel route"
                        src={item.image}
                        alt={item.imageAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 to-transparent" />
                      {/* Step number badge */}
                      <div
                        className={`absolute top-4 left-4 w-10 h-10 rounded-full bg-gradient-to-br ${item.gradient} flex items-center justify-center text-sm font-bold text-white shadow-lg z-10`}
                      >
                        {item.step}
                      </div>
                    </div>
                    <div className="p-6 bg-white">
                      <div className="text-sm font-bold text-primary-700 mb-1">
                        Step {item.step}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </FadeInOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Destinations ─────────────────────────────────────────────────── */}
        <section id="destinations" className="py-20 lg:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInOnScroll>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 text-amber-800 text-sm font-medium">
                  <MapPin className="w-4 h-4" aria-hidden="true" /> Popular
                  Destinations
                </div>
                <h2 className="font-editorial text-3xl lg:text-5xl font-bold text-slate-900 mb-3">
                  Where will you go next?
                </h2>
                <p className="text-slate-600 text-lg">
                  Discover places that match your travel vibes
                </p>
              </div>
            </FadeInOnScroll>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {destinations.map((dest, i) => (
                <FadeInOnScroll key={dest.name} delay={i * 100}>
                  <Link
                    href={`/destinations/${dest.name.toLowerCase().replace(/ /g, "-")}`}
                    className="group cursor-pointer block"
                  >
                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-primary/30 transition-all duration-500">
                      <Image
                        fallbackAlt="Illustrated travel route"
                        src={dest.image}
                        alt={`${dest.name}, ${dest.country} - ${dest.vibe}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-500" />
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/15 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-full text-xs font-medium">
                          {dest.vibe}
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h3 className="text-2xl font-bold text-white mb-0.5">
                          {dest.name}
                        </h3>
                        <p className="text-white/80 text-sm mb-3">
                          {dest.country}
                        </p>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                          <span className="text-primary-200 text-sm font-medium">
                            Explore guide
                          </span>
                          <span className="text-primary-200">→</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </FadeInOnScroll>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href="/destinations"
                className="inline-flex items-center gap-2 text-primary-700 font-semibold hover:text-primary-800 transition-colors"
              >
                View All Destination Guides
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Why Faroway ─────────────────────────────────────────────────── */}
        <section className="py-20 lg:py-28 bg-[#FAF8F3]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeInOnScroll>
              <div className="text-center mb-16">
                <h2 className="font-editorial text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                  Why <span className="text-[#C03A31]">Faroway</span>?
                </h2>
                <p className="text-xl text-slate-600">
                  Planning a trip shouldn&apos;t feel like a second job
                </p>
              </div>
            </FadeInOnScroll>

            <div className="grid md:grid-cols-3 gap-5">
              {whyReasons.map((reason, i) => (
                <FadeInOnScroll key={reason.title} delay={i * 150}>
                  <div className="bg-white rounded-2xl p-8 transition-all h-full flex flex-col border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-700/20">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-4">
                      <reason.Icon
                        className="w-6 h-6 text-[#C03A31]"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {reason.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed flex-1">
                      {reason.desc}
                    </p>
                  </div>
                </FadeInOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Download CTA — with stunning background ──────────────────────── */}
        <section
          id="download"
          className="relative py-24 lg:py-32 overflow-hidden"
        >
          <Image
            fallbackAlt="Illustrated travel route"
            src={getImageUrl(IMAGE_PATHS.marketing.ctaBackground)}
            alt="Silhouette of a traveler looking at a stunning colorful sunset over the ocean"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/85 to-surface-950/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950/60 to-transparent" />
          <div className="absolute inset-0 bg-primary/10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center lg:text-left">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-white/90">
                  <Download
                    className="w-4 h-4 text-primary-200"
                    aria-hidden="true"
                  />
                  {HAS_MOBILE_STORE_LINKS
                    ? "Available on mobile"
                    : "Live on Web · Mobile Preview"}
                </div>
                <h2 className="font-editorial text-3xl lg:text-5xl font-bold mb-6 text-white">
                  {HAS_MOBILE_STORE_LINKS ? (
                    <>
                      Your itinerary,{" "}
                      <span className="text-gradient-hero">in your pocket</span>
                    </>
                  ) : (
                    <>
                      Plan on the web,{" "}
                      <span className="text-gradient-hero">
                        travel with your itinerary
                      </span>
                    </>
                  )}
                </h2>
                <p className="text-xl text-white/80 mb-4 leading-relaxed">
                  {HAS_MOBILE_STORE_LINKS
                    ? "No Wi-Fi at the station? Saved Faroway trips keep your day-by-day plan on your phone so you can revisit key details with limited connectivity."
                    : "Start building your day-by-day itinerary right in your browser today, with partner links and saved trips ready when you travel."}
                </p>
                <p className="text-sm text-white/70 mb-8">
                  Plan on the web, carry it on your phone. Signed-in trips sync
                  when you&apos;re online.
                </p>

                <AppStoreButtons
                  className="mb-8 justify-center lg:justify-start"
                  variant="solid"
                />

                <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3">
                  {[
                    "Free to start",
                    "Day-by-day itineraries",
                    "Partner booking links",
                    "Mobile offline preview",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-white/85 text-sm"
                    >
                      <Check
                        className="w-4 h-4 text-accent-300 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phone mockup */}
              <div className="hidden lg:flex justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 to-amber-500/15 rounded-3xl blur-3xl" />
                  <div className="relative bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl shadow-primary/10">
                    <div className="bg-surface-900/90 backdrop-blur-sm rounded-2xl p-6 border border-white/[0.08]">
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.08]">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-amber-500/30 border border-white/10 flex items-center justify-center">
                          <MapPin
                            className="w-6 h-6 text-primary-300"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">Tokyo</h4>
                          <p className="text-sm text-white/70">
                            7-day adventure
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {[
                          "Day 1: Arrival & Shibuya",
                          "Day 2: Traditional Tokyo",
                          "Day 3: Mount Fuji Day Trip",
                        ].map((day, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.04] rounded-lg"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary-700 text-white flex items-center justify-center text-sm font-bold">
                              {i + 1}
                            </div>
                            <span className="text-sm text-white/80">{day}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
