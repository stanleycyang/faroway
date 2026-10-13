import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import { destinations } from "@/lib/planner-destination-catalog";

/** Use Faroway's independent destination catalog for trip cover photography. */
export function destinationImage(destination: string): string | undefined {
  const entry = destinations.find(
    (item) => item.name.toLowerCase() === destination.trim().toLowerCase(),
  );
  return entry
    ? getImageUrl(
        IMAGE_PATHS.destinations[
          entry.id as keyof typeof IMAGE_PATHS.destinations
        ],
      )
    : undefined;
}
