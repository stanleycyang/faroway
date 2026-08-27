import Image from "next/image";
import Link from "next/link";
import {
  Star,
  Check,
  Sparkles,
  WifiOff,
  Globe,
  Shield,
  ChevronDown,
  Play,
} from "lucide-react";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { scenicImages } from "@/components/landing/landing-data";

export function LandingHero() {
  return (
    <>
      {/* ─── Hero Section — Bright, clean, conversion-optimized ──────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Light gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50/50" />
        {/* Subtle decorative blobs */}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-accent/5 rounded-full blur-3xl" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500" />
                </span>
                <span className="text-slate-700 text-sm font-medium">
                  Transparent itinerary generation with live progress
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.08] mb-6 tracking-tight text-slate-900">
                Your dream trip,
                <br />
                planned around{" "}
                <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                  your style
                </span>
              </h1>

              <p className="text-lg lg:text-xl text-slate-600 mb-4 max-w-xl leading-relaxed">
                Tell us where you&apos;re going and pick your travel vibes. Our
                AI builds a complete day-by-day itinerary &mdash; restaurants,
                activities, and local secrets included.
              </p>

              <p className="text-sm text-slate-400 mb-8 max-w-xl">
                Plan the trip, then sign in to generate and keep it.
              </p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  href="/create"
                  className="group inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg shadow-primary/25 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/35"
                >
                  <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
                  Plan My Trip &mdash; Free
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-4 rounded-full font-semibold text-lg transition-all hover:-translate-y-0.5 border border-slate-200"
                >
                  <Play className="w-5 h-5" />
                  See How It Works
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-accent/10 text-accent-700 px-3 py-1.5 rounded-full font-medium">
                  <Check className="w-4 h-4" />
                  Free to start
                </div>
                <div className="flex items-center gap-2 bg-primary/10 text-primary-700 px-3 py-1.5 rounded-full font-medium">
                  <Check className="w-4 h-4" />
                  Free account
                </div>
                <div className="flex items-center gap-2 bg-amber-500/10 text-amber-700 px-3 py-1.5 rounded-full font-medium">
                  <Check className="w-4 h-4" />
                  Sign in to generate
                </div>
              </div>
            </div>

            {/* Right — travel photo with floating itinerary card */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Contained travel photo */}
                <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl shadow-slate-900/10">
                  <Image
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-md shadow-primary/25">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          Tokyo Adventure
                        </h3>
                        <p className="text-xs text-slate-400">
                          7 days · 2 travelers
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { day: 1, title: "Arrival & Shibuya", emoji: "🛬" },
                        { day: 2, title: "Temples of Asakusa", emoji: "⛩️" },
                        { day: 3, title: "Mount Fuji Day Trip", emoji: "🗻" },
                      ].map((item) => (
                        <div
                          key={item.day}
                          className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl"
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {item.day}
                          </div>
                          <span className="text-sm font-medium text-slate-700 flex-1">
                            {item.title}
                          </span>
                          <span className="text-sm">{item.emoji}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className="w-3 h-3 fill-amber-400 text-amber-400"
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        AI-generated
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating speed badge */}
                <div className="absolute -top-3 -right-3 bg-white rounded-full px-4 py-2 shadow-lg shadow-slate-900/10 border border-slate-100 flex items-center gap-2">
                  <span className="text-sm">⚡</span>
                  <span className="text-sm font-semibold text-slate-700">
                    Built in 47s
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-slate-400 text-xs font-medium tracking-widest uppercase">
            Discover
          </span>
          <ChevronDown className="w-5 h-5 text-slate-300 animate-bounce" />
        </div>
      </section>

      {/* ─── Scenic Travel Showcase — Masonry Gallery ────────────────────── */}
      <section className="py-4 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {scenicImages.map((img, i) => (
              <Link
                key={img.label}
                href="/create"
                className={`relative overflow-hidden rounded-2xl group cursor-pointer block ${"aspect-[4/3]"}`}
              >
                <Image
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
                  <p className="text-white/70 text-sm">Plan with AI →</p>
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
              icon: <Check className="w-4 h-4 text-accent" />,
              label: "Free to start",
            },
            {
              icon: <Shield className="w-4 h-4 text-accent" />,
              label: "Sign in to generate",
            },
            {
              icon: <Sparkles className="w-4 h-4 text-primary-400" />,
              label: "AI-powered",
            },
            {
              icon: <WifiOff className="w-4 h-4 text-primary-300" />,
              label: "Saved trips offline",
            },
            {
              icon: <Globe className="w-4 h-4 text-amber-400" />,
              label: "Worldwide planning",
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

    </>
  );
}
