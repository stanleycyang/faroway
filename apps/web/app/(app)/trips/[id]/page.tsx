import { notFound, redirect } from "next/navigation";
import { TripDetailClient } from "./TripDetailClient";
import { createClient } from "@/lib/supabase/server";
import { loadTripForUser } from "@/lib/trips/load-trip";

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=/trips/${encodeURIComponent(id)}`);
  }

  const initialData = await loadTripForUser(id, user.id);
  if (!initialData) notFound();

  return <TripDetailClient tripId={id} initialData={initialData} />;
}
