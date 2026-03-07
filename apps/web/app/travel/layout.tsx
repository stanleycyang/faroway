import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function TravelLayout({
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
