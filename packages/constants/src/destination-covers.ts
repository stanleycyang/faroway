import { IMAGE_PATHS } from "./images";
import { getImageUrl } from "./storage";

// Compact image metadata from Faroway's destination guides, kept separate from
// their long editorial content so trip pages do not ship that content to clients.
export const destinationCoverCatalog = [
  ["tokyo", "Tokyo", "Japan"],
  ["bali", "Bali", "Indonesia"],
  ["bangkok", "Bangkok", "Thailand"],
  ["dubai", "Dubai", "UAE"],
  ["paris", "Paris", "France"],
  ["barcelona", "Barcelona", "Spain"],
  ["santorini", "Santorini", "Greece"],
  ["london", "London", "United Kingdom"],
  ["rome", "Rome", "Italy"],
  ["lisbon", "Lisbon", "Portugal"],
  ["reykjavik", "Reykjavik", "Iceland"],
  ["new-york", "New York", "USA"],
  ["marrakech", "Marrakech", "Morocco"],
  ["cape-town", "Cape Town", "South Africa"],
  ["singapore", "Singapore", "Singapore"],
  ["kyoto", "Kyoto", "Japan"],
  ["hanoi", "Hanoi", "Vietnam"],
  ["phuket", "Phuket", "Thailand"],
  ["seoul", "Seoul", "South Korea"],
  ["jaipur", "Jaipur", "India"],
  ["petra", "Petra", "Jordan"],
  ["amsterdam", "Amsterdam", "Netherlands"],
  ["istanbul", "Istanbul", "Turkey"],
  ["prague", "Prague", "Czech Republic"],
  ["vienna", "Vienna", "Austria"],
  ["dublin", "Dublin", "Ireland"],
  ["copenhagen", "Copenhagen", "Denmark"],
  ["interlaken", "Interlaken", "Switzerland"],
  ["amalfi-coast", "Amalfi Coast", "Italy"],
  ["ibiza", "Ibiza", "Spain"],
  ["chamonix", "Chamonix", "France"],
  ["cancun", "Cancun", "Mexico"],
  ["rio-de-janeiro", "Rio de Janeiro", "Brazil"],
  ["costa-rica", "Costa Rica", "Costa Rica"],
  ["buenos-aires", "Buenos Aires", "Argentina"],
  ["havana", "Havana", "Cuba"],
  ["vancouver", "Vancouver", "Canada"],
  ["cairo", "Cairo", "Egypt"],
  ["zanzibar", "Zanzibar", "Tanzania"],
  ["queenstown", "Queenstown", "New Zealand"],
  ["maldives", "Maldives", "Maldives"],
  ["sydney", "Sydney", "Australia"],
] as const satisfies ReadonlyArray<
  readonly [keyof typeof IMAGE_PATHS.destinations, string, string]
>;

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
function countryName(value: string): string {
  const country = normalize(value);
  const aliases: Record<string, string> = {
    "united states": "usa",
    "united states of america": "usa",
    us: "usa",
    uk: "united kingdom",
    uae: "united arab emirates",
  };
  return aliases[country] ?? country;
}

/** Match a catalog destination, with an optional matching country qualifier. */
export function destinationImage(destination: string): string | undefined {
  const parts = destination.split(",");
  if (parts.length > 2 || parts.some((part) => !part.trim())) return undefined;
  const [name, country] = parts;
  const entry = destinationCoverCatalog.find(
    ([, city, catalogCountry]) =>
      normalize(city) === normalize(name) &&
      (country === undefined ||
        countryName(country) === countryName(catalogCountry)),
  );
  if (entry) return getImageUrl(IMAGE_PATHS.destinations[entry[0]]);
  const supplemental = supplementalDestinationPhotos.find(
    (photo) =>
      normalize(photo.city) === normalize(name) &&
      (country === undefined ||
        countryName(country) === countryName(photo.country)),
  );
  return supplemental?.url;
}

/** Curated city photography, never used as evidence or imagery for a venue. */
export const supplementalDestinationPhotos = [
  {
    city: "Edinburgh",
    country: "United Kingdom",
    url: "https://images.unsplash.com/photo-1762729881707-8ebfe323578a?auto=format&fit=crop&fm=jpg&q=80&w=1600",
    photographer: "Mafalda Moura",
    source:
      "https://unsplash.com/photos/edinburgh-skyline-with-dugald-stewart-monument-in-foreground-JZ7CmknQ1lU",
    license: "https://unsplash.com/license",
    reviewedAt: "2026-11-03",
    description:
      "Edinburgh skyline with the Dugald Stewart Monument in the foreground",
  },
  {
    city: "Melbourne",
    country: "Australia",
    url: "https://images.unsplash.com/photo-1634172770871-28ab3ddb6a56?auto=format&fit=crop&fm=jpg&q=80&w=1600",
    photographer: "Iliya Jokic",
    source:
      "https://unsplash.com/photos/a-view-of-a-city-skyline-from-across-the-water-YwVVptGaZMo",
    license: "https://unsplash.com/license",
    reviewedAt: "2026-11-02",
    description: "Melbourne skyline from Albert Park Lake",
  },
] as const;
