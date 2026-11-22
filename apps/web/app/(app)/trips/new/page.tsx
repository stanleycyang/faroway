import { permanentRedirect } from "next/navigation";

export const metadata = {
  title: "Create New Trip",
  description: "Plan your next adventure with AI-powered itineraries",
};

interface NewTripPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTripPage({ searchParams }: NewTripPageProps) {
  const resolved = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else if (typeof value === "string") {
      query.append(key, value);
    }
  }
  const qs = query.toString();
  permanentRedirect(qs ? `/create?${qs}` : "/create");
}
