import { TripViewLoading } from "@/components/trips/TripViewLoading";

// Keep this boundary inside the token layout so it validates public access
// before streaming. A parent /s/loading.tsx would commit HTTP 200 too early.
export default function Loading() {
  return <TripViewLoading />;
}
