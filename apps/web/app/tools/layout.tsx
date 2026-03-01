import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ToolsNav } from "@/components/tools/ToolsNav";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <Header />
      <ToolsNav />
      {children}
      <Footer />
    </div>
  );
}
