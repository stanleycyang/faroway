import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  MapPin,
  Compass,
  Heart,
  Download,
  Clock,
  Check,
} from "lucide-react";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { AppStoreButtons } from "@/components/AppStoreButtons";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { HAS_MOBILE_STORE_LINKS } from "@/lib/store-links";
import { destinations, whyReasons } from "@/components/landing/landing-data";

export function LandingBottom() {
  return (
    <>
      {/* ─── How It Works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 rounded-full px-4 py-1.5 mb-4 text-accent-600 text-sm font-medium">
                <Clock className="w-4 h-4" /> 3 Simple Steps
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Build your trip plan in{" "}
                <span className="text-gradient">3 simple steps</span>
              </h2>
              <p className="text-xl text-slate-500">
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
                icon: <Compass className="w-7 h-7 text-white" />,
                gradient: "from-primary to-primary-600 shadow-primary/20",
                image: getImageUrl(IMAGE_PATHS.marketing.travelDesk),
                imageAlt:
                  "Flat lay of travel planning essentials including map, camera, and passport",
              },
              {
                step: 2,
                title: "Select your vibes",
                desc: "Choose from 12 travel vibes and pick your traveler type: solo, couple, family, or friends.",
                icon: <Heart className="w-7 h-7 text-white" />,
                gradient: "from-amber-500 to-amber-600",
                image: getImageUrl(IMAGE_PATHS.marketing.passportJourney),
                imageAlt: "Friends enjoying a sunset on a tropical beach",
              },
              {
                step: 3,
                title: "Sign in to generate",
                desc: "Create a free account, then watch AI build a personalized day-by-day itinerary saved to your trips.",
                icon: <Sparkles className="w-7 h-7 text-white" />,
                gradient: "from-teal-500 to-teal-600",
                image: getImageUrl(IMAGE_PATHS.marketing.trainJourney),
                imageAlt:
                  "Hiker overlooking a stunning scenic vista at sunrise",
              },
            ].map((item, i) => (
              <FadeInOnScroll key={item.step} delay={i * 150}>
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 hover:border-primary/30 transition-all group h-full shadow-sm hover:shadow-lg">
                  {/* Background image */}
                  <div className="relative h-44 overflow-hidden">
                    <Image
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
                    <div className="text-sm font-bold text-primary mb-1">
                      Step {item.step}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
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
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 text-amber-600 text-sm font-medium">
                <MapPin className="w-4 h-4" /> Popular Destinations
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-3">
                Where will you go next?
              </h2>
              <p className="text-slate-500 text-lg">
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
                      <p className="text-white/60 text-sm mb-3">
                        {dest.country}
                      </p>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                        <span className="text-primary-300 text-sm font-medium">
                          Explore guide
                        </span>
                        <span className="text-primary-300">→</span>
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

      {/* ─── Why Faroway ───────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
                Why <span className="text-gradient">Faroway</span>?
              </h2>
              <p className="text-xl text-slate-500">
                Planning a trip shouldn&apos;t feel like a second job
              </p>
            </div>
          </FadeInOnScroll>

          <div className="grid md:grid-cols-3 gap-5">
            {whyReasons.map((reason, i) => (
              <FadeInOnScroll key={reason.title} delay={i * 150}>
                <div className="bg-white rounded-2xl p-8 transition-all h-full flex flex-col border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/20">
                  <div className="text-4xl mb-4">{reason.emoji}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {reason.title}
                  </h3>
                  <p className="text-slate-500 leading-relaxed flex-1">
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
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-sm font-medium text-white/80">
                <Download className="w-4 h-4 text-primary-300" />
                {HAS_MOBILE_STORE_LINKS
                  ? "Available on mobile"
                  : "Mobile apps in private preview"}
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-white">
                Your itinerary,{" "}
                <span className="text-gradient-hero">in your pocket</span>
              </h2>
              <p className="text-xl text-white/70 mb-4 leading-relaxed">
                No Wi-Fi at the station? Saved Faroway trips keep your
                day-by-day plan on your phone so you can revisit key details
                with limited connectivity.
              </p>
              <p className="text-sm text-white/50 mb-8">
                Plan on the web, carry it on your phone. Signed-in trips sync
                when you&apos;re online.
              </p>

              <AppStoreButtons
                className="mb-8 justify-center lg:justify-start"
                variant="solid"
              />

              <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3">
                {[
                  "Saved trips offline",
                  "Itinerary-ready alerts",
                  "Partner options",
                  "Signed-in sync",
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
            </div>

            {/* Phone mockup */}
            <div className="hidden lg:flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 to-amber-500/15 rounded-3xl blur-3xl" />
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl shadow-primary/10">
                  <div className="bg-surface-900/90 backdrop-blur-sm rounded-2xl p-6 border border-white/[0.08]">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.08]">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-amber-500/30 border border-white/10 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-primary-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">Tokyo</h4>
                        <p className="text-sm text-white/50">7-day adventure</p>
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
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-amber-500 text-white flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm text-white/70">{day}</span>
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
    </>
  );
}
