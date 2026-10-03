import { notFound, redirect } from "next/navigation";
import { TripDetailClient } from "./TripDetailClient";
import { createClient } from "@/lib/supabase/server";
import { loadTripForUser } from "@/lib/trips/load-trip";

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const [{ id }, supabase] = await Promise.all([params, createClient()]);
  if (!/^[a-zA-Z0-9-]+$/.test(id)) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=/trips/${encodeURIComponent(id)}`);
  }

  const initialData = await loadTripForUser(id, user.id);
  if (!initialData) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
  const initialShareUrl =
    initialData.trip.is_shared && initialData.trip.share_token
      ? `${baseUrl}/s/${initialData.trip.share_token}`
      : null;

  return (
    <TripDetailClient
      tripId={id}
      initialData={initialData}
      initialShareUrl={initialShareUrl}
      planEditingEnabled={process.env.FAROWAY_PLAN_EDITING_ENABLED === "true"}
    />
  );
}
