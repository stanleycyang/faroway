import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingBottom } from "@/components/landing/LandingBottom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white antialiased text-slate-900 overflow-x-hidden">
      <Header />
      <LandingHero />
      <LandingFeatures />
      <LandingBottom />
      <Footer />
    </div>
  );
}
