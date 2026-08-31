import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SharedItineraryReportForm } from "@/components/reports/SharedItineraryReportForm";

export const metadata: Metadata = {
  title: "Report Shared Content",
  description: "Report a shared Faroway itinerary for review.",
  robots: {
    index: false,
    follow: true,
  },
};

interface ReportPageProps {
  searchParams: Promise<{
    token?: string;
    type?: string;
  }>;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const token = params.type === "shared_trip" ? params.token || "" : "";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-24">
        <section className="mx-auto max-w-2xl px-6 py-12">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
              Content Review
            </p>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
              Report a shared itinerary
            </h1>
            <p className="mt-4 text-gray-600">
              Reports go to Faroway support for moderation review. Include only
              information needed to identify the issue.
            </p>
          </div>
          <SharedItineraryReportForm token={token} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
