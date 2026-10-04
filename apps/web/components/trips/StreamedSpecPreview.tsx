import {
  Calendar,
  Clock,
  DollarSign,
  Hotel,
  MapPin,
  Star,
  Ticket,
  Utensils,
} from "lucide-react";
import type { ReactNode } from "react";
import type { StreamingSpecBlock } from "@/hooks/useTripGeneration";

interface StreamedSpecPreviewProps {
  blocks: StreamingSpecBlock[];
  isGenerating?: boolean;
}

type SpecProps = Record<string, unknown>;

export function StreamedSpecPreview({
  blocks,
  isGenerating = false,
}: StreamedSpecPreviewProps) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {isGenerating && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm font-medium text-primary-800">
          Building your itinerary live. New sections will appear here as they
          are ready.
        </div>
      )}
      {blocks.map((block, index) => (
        <SpecBlock block={block} key={`${block.type}-${index}`} />
      ))}
    </div>
  );
}

function SpecBlock({ block }: { block: StreamingSpecBlock }) {
  const props = block.props || {};

  switch (block.type) {
    case "TripSummary":
      return <TripSummary props={props} />;
    case "Section":
      return <SectionTitle props={props} />;
    case "HotelCard":
      return <HotelCard props={props} />;
    case "BookingButton":
      return <BookingButton props={props} />;
    case "ItineraryDay":
      return <ItineraryDayCard props={props} />;
    case "DayTimeline":
      return <DayTimeline props={props} />;
    case "ActivityCard":
      return <ActivityCard props={props} />;
    case "RestaurantCard":
      return <RestaurantCard props={props} />;
    case "PriceTag":
      return <PriceTag props={props} />;
    case "Text":
      return <TextBlock props={props} />;
    default:
      return null;
  }
}

function TripSummary({ props }: { props: SpecProps }) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-amber-50 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-xs font-bold uppercase tracking-wide text-primary-700">
        Trip preview
      </p>
      <h2 className="mt-1 text-2xl font-bold text-gray-900">
        {textProp(props, "destination", "Your trip")}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-700">
        {textProp(props, "dates") && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-medium shadow-sm">
            <Calendar className="h-4 w-4 text-primary-600" />
            {textProp(props, "dates")}
          </span>
        )}
        {numberProp(props, "travelers") != null && (
          <span className="rounded-full bg-white px-3 py-1.5 font-medium shadow-sm">
            {numberProp(props, "travelers")} traveler
            {numberProp(props, "travelers") === 1 ? "" : "s"}
          </span>
        )}
        {textProp(props, "budget") && (
          <span className="rounded-full bg-white px-3 py-1.5 font-medium capitalize shadow-sm">
            {textProp(props, "budget")}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ props }: { props: SpecProps }) {
  return (
    <h2 className="pt-2 text-xl font-bold text-gray-900">
      {textProp(props, "title", "Section")}
    </h2>
  );
}

function HotelCard({ props }: { props: SpecProps }) {
  const amenities = stringArrayProp(props, "amenities");
  const bookingUrl = textProp(props, "bookingUrl");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <Hotel className="h-5 w-5 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">
              {textProp(props, "name", "Hotel")}
            </h3>
            {booleanProp(props, "featured") && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                Recommended
              </span>
            )}
          </div>
          <MetaLine
            items={[
              ratingLabel(props),
              moneyLabel(numberProp(props, "pricePerNight"), "night"),
            ]}
          />
          {textProp(props, "description") && (
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {textProp(props, "description")}
            </p>
          )}
          {amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {amenities.slice(0, 5).map((amenity) => (
                <span
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                  key={amenity}
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}
          {bookingUrl && (
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-600">
              <Ticket className="h-4 w-4" />
              Booking preview — review your saved plan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingButton({ props }: { props: SpecProps }) {
  const url = textProp(props, "url");
  if (!url) return null;

  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50">
      <Ticket className="h-4 w-4" />
      Booking preview — review your saved plan
    </span>
  );
}

function ItineraryDayCard({ props }: { props: SpecProps }) {
  return (
    <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="text-sm font-bold text-primary-700">
        Day {numberProp(props, "dayNumber") ?? ""}
      </p>
      <h3 className="mt-1 text-lg font-bold text-gray-900">
        {textProp(props, "title", "Itinerary day")}
      </h3>
      {textProp(props, "date") && (
        <p className="mt-1 text-sm text-gray-500">{textProp(props, "date")}</p>
      )}
    </div>
  );
}

function DayTimeline({ props }: { props: SpecProps }) {
  const items = objectArrayProp(props, "items");
  if (items.length === 0) return null;

  return (
    <ol className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {items.map((item, index) => (
        <li className="flex gap-3" key={`${textProp(item, "time")}-${index}`}>
          <span className="w-16 shrink-0 text-sm font-bold text-gray-500">
            {textProp(item, "time", "--")}
          </span>
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
            {textProp(item, "title", "Stop")}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ActivityCard({ props }: { props: SpecProps }) {
  return (
    <SmallCard
      accent="primary"
      description={textProp(props, "description")}
      icon={<MapPin className="h-5 w-5 text-primary-600" />}
      meta={[
        textProp(props, "time"),
        textProp(props, "duration"),
        moneyLabel(numberProp(props, "price")),
      ]}
      title={textProp(props, "name", "Activity")}
      url={textProp(props, "bookingUrl")}
    />
  );
}

function RestaurantCard({ props }: { props: SpecProps }) {
  return (
    <SmallCard
      accent="orange"
      description={textProp(props, "description")}
      icon={<Utensils className="h-5 w-5 text-orange-600" />}
      meta={[
        textProp(props, "time"),
        textProp(props, "cuisine"),
        ratingLabel(props),
      ]}
      title={textProp(props, "name", "Restaurant")}
      url={textProp(props, "reservationUrl")}
    />
  );
}

function PriceTag({ props }: { props: SpecProps }) {
  const amount = numberProp(props, "amount");
  const currency = textProp(props, "currency", "USD");

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-gray-600">
        {textProp(props, "period", "Cost")}
      </span>
      <span className="font-bold text-gray-900">
        {amount == null ? "" : `${currency} ${amount.toLocaleString()}`}
      </span>
    </div>
  );
}

function TextBlock({ props }: { props: SpecProps }) {
  return (
    <p className="text-sm leading-6 text-gray-600">
      {textProp(props, "content", "")}
    </p>
  );
}

function SmallCard({
  accent,
  description,
  icon,
  meta,
  title,
  url,
}: {
  accent: "primary" | "orange";
  description?: string;
  icon: ReactNode;
  meta: Array<string | undefined>;
  title: string;
  url?: string;
}) {
  const iconBg = accent === "primary" ? "bg-primary-50" : "bg-orange-50";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <MetaLine items={meta} />
          {description && (
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {description}
            </p>
          )}
          {url && (
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-primary-700 hover:text-primary-800">
              <Ticket className="h-4 w-4" />
              Booking preview — review your saved plan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaLine({ items }: { items: Array<string | undefined> }) {
  const filteredItems = items.filter(Boolean);
  if (filteredItems.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
      {filteredItems.map((item) => (
        <span className="inline-flex items-center gap-1.5" key={item}>
          {item?.includes("$") ? (
            <DollarSign className="h-4 w-4" />
          ) : item?.includes("star") || item?.includes("/5") ? (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {item}
        </span>
      ))}
    </div>
  );
}

function textProp(props: SpecProps, key: string, fallback = ""): string {
  const value = props[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function numberProp(props: SpecProps, key: string): number | undefined {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanProp(props: SpecProps, key: string): boolean {
  return props[key] === true;
}

function stringArrayProp(props: SpecProps, key: string): string[] {
  const value = props[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function objectArrayProp(props: SpecProps, key: string): SpecProps[] {
  const value = props[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SpecProps => {
    return item !== null && typeof item === "object" && !Array.isArray(item);
  });
}

function ratingLabel(props: SpecProps): string | undefined {
  const rating = numberProp(props, "rating");
  if (rating == null) return undefined;
  return `${rating}/5`;
}

function moneyLabel(amount?: number, period?: string): string | undefined {
  if (amount == null) return undefined;
  return period ? `$${amount}/${period}` : `$${amount}`;
}
