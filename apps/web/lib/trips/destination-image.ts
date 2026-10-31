import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";

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
  return entry ? getImageUrl(IMAGE_PATHS.destinations[entry[0]]) : undefined;
}
