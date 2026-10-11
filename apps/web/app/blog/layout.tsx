import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Blog content is managed in Supabase rather than committed with the app.
// Public editorial content can refresh on access every six hours.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: {
    template: "%s | Faroway Blog",
    default: "Faroway Blog",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
