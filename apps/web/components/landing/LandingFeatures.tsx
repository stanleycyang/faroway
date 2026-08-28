import Image from "next/image";
import { Sparkles, Zap, Heart, WifiOff, MapPin } from "lucide-react";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { travelVibes } from "@/components/landing/landing-data";

export function LandingFeatures() {
  return (
    <>
      {/* ─── Feature Showcase (Bento Grid) ────────────────────────────────── */}
      <section id="features" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-1.5 mb-4 text-primary-600 text-sm font-medium">
                <Zap className="w-4 h-4" /> Features
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Everything you need for the{" "}
                <span className="text-gradient">next trip</span>
              </h2>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                AI plans it, you enjoy it. From inspiration to booking — one
                seamless experience.
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-2 gap-4 lg:gap-5">
            {/* Hero feature — AI Itinerary with travel image */}
            <FadeInOnScroll className="md:col-span-2">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[320px] lg:min-h-[360px]">
                {/* Background travel image */}
                <Image
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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center mb-5 shadow-lg shadow-primary/25">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                      AI Itinerary Generation
                    </h3>
                    <p className="text-white/70 text-lg leading-relaxed mb-6">
                      Tell us your destination, dates, and travel style. Our AI
                      creates a complete day-by-day itinerary with activities,
                      restaurants, and local tips as your plan builds.
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
                          className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full text-sm font-medium text-white/80"
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
                  src={getImageUrl(IMAGE_PATHS.marketing.travelDiscovery)}
                  alt="Adventurous traveler overlooking a tropical valley at sunrise"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/70 to-surface-950/30" />
                <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-rose-500/30 border border-primary/30 flex items-center justify-center mb-4 backdrop-blur-sm">
                    <Heart className="w-6 h-6 text-primary-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    12 Travel Vibes
                  </h3>
                  <p className="text-white/60 leading-relaxed mb-4 text-sm">
                    Choose from Adventure, Foodie, Romantic, Culture, and more.
                    Your itinerary is tailored to your personality.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {travelVibes.slice(0, 5).map((v) => (
                      <span
                        key={v.label}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-xs text-white/80"
                      >
                        <span>{v.emoji}</span> {v.label}
                      </span>
                    ))}
                    <span className="px-2.5 py-1 text-xs text-primary-400 font-medium">
                      +7 more
                    </span>
                  </div>
                </div>
              </div>
            </FadeInOnScroll>

            {/* Partner booking links with image */}
            <FadeInOnScroll delay={200}>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all h-full group min-h-[360px]">
                <Image
                  src={getImageUrl(IMAGE_PATHS.marketing.hotelFeature)}
                  alt="Luxury hotel room overlooking the ocean"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950/95 via-surface-950/70 to-surface-950/30" />
                <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 border border-amber-500/30 flex items-center justify-center mb-4 backdrop-blur-sm">
                    <Zap className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Partner Booking Links
                  </h3>
                  <p className="text-white/60 leading-relaxed text-sm">
                    Open Booking.com hotel options and Viator activities from
                    your itinerary, then confirm pricing and checkout with the
                    provider.
                  </p>
                </div>
              </div>
            </FadeInOnScroll>

            {/* Offline + Search — wide row */}
            <FadeInOnScroll delay={100} className="md:col-span-2">
              <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[220px]">
                  <Image
                    src={getImageUrl(IMAGE_PATHS.marketing.travelPlanning)}
                    alt="Traveler with backpack walking through a scenic mountain path"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/80 to-surface-950/50" />
                  <div className="relative z-10 p-8 flex items-center gap-5 h-full">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/30 to-emerald-500/30 border border-accent/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <WifiOff className="w-7 h-7 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        Offline Access
                      </h3>
                      <p className="text-white/60 leading-relaxed text-sm">
                        Saved itineraries are stored locally for limited
                        connectivity. Changes sync when you&apos;re back online.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/[0.12] transition-all group min-h-[220px]">
                  <Image
                    src={getImageUrl(IMAGE_PATHS.marketing.roadTrip)}
                    alt="Map laid out on a table with travel planning accessories"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/80 to-surface-950/50" />
                  <div className="relative z-10 p-8 flex items-center gap-5 h-full">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-sky-500/30 border border-blue-500/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <MapPin className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        Smart Destination Search
                      </h3>
                      <p className="text-white/60 leading-relaxed text-sm">
                        Powered by Google Places — instant autocomplete for any
                        city or destination worldwide.
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
              <p className="text-3xl lg:text-5xl font-bold text-white max-w-3xl mx-auto leading-tight drop-shadow-2xl">
                &ldquo;The world is a book, and those who do not travel read
                only one page.&rdquo;
              </p>
              <p className="text-white/60 mt-4 text-lg italic">
                — Saint Augustine
              </p>
            </div>
          </FadeInOnScroll>
        </div>
      </section>
    </>
  );
}
