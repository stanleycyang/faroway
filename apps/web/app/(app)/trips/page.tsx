import { redirect } from "next/navigation";

interface TripsIndexPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TripsIndexPage({
  searchParams,
}: TripsIndexPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.append(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    }
  }
  const qs = query.toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}
