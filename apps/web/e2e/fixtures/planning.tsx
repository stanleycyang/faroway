import { TripCard } from "../../components/dashboard/TripCard";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TripDayNavigation } from "../../components/trips/TripDayNavigation";
import { ItineraryDay } from "../../components/trips/ItineraryDay";
import { TripHeader } from "../../components/trips/TripHeader";
import { ItineraryGenerationLoader } from "../../components/trips/ItineraryGenerationLoader";
import { useTripGeneration } from "../../hooks/useTripGeneration";
import { FeaturedHotelCard } from "../../components/trips/FeaturedHotelCard";
import { cover, sampleDays } from "./planning-data";

const days = sampleDays;
function Fixture() {
  const initial = new URLSearchParams(location.search).get("screen") || "trip";
  const [screen, setScreen] = useState(initial);
  const [selected, setSelected] = useState(0);
  if (screen === "saved")
    return (
      <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-5 py-12">
        <h1 className="mb-3 font-editorial text-4xl text-slate-900">
          Your journeys
        </h1>
        <p className="mb-8 text-slate-600">
          Pick up a plan, or dream up your next escape.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {["planned", "generating", "failed"].map((status, index) => (
            <TripCard
              key={status}
              trip={{
                id: status,
                destination: ["Paris", "Tokyo", "Elsewhere"][index],
                start_date: "2099-06-01",
                end_date: "2099-06-03",
                travelers: 2,
                status,
              }}
            />
          ))}
        </div>
      </main>
    );
  if (screen === "live")
    return <LiveFixture onOpenTrip={() => setScreen("trip")} />;
  if (screen === "generation")
    return (
      <ItineraryGenerationLoader
        destination="Paris"
        heroImageUrl={
          "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format&fit=crop&q=80"
        }
        nights={2}
        travelers={2}
        startDate="2099-06-01"
        endDate="2099-06-03"
        days={sampleDays.slice(0, 2)}
        phase="searching"
        progress={42}
        message="Finding places for your days in Paris"
        searchProgress={{
          orchestrator: "done",
          hotels: "done",
          activities: "searching",
        }}
        activitiesCount={8}
        diningCount={4}
        transportCount={0}
        hotelPreview={{ name: "A stay near the Left Bank" }}
      >
        <aside className="mt-8 rounded-2xl bg-white/10 p-4">
          <p>Your trip is saved. You can leave and return.</p>
          <button
            className="mt-4 min-h-11 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900"
            onClick={() => setScreen("ready")}
          >
            Finish fixture planning
          </button>
        </aside>
      </ItineraryGenerationLoader>
    );
  if (screen === "ready")
    return (
      <ItineraryGenerationLoader
        destination="Paris"
        heroImageUrl={cover}
        summary="A few days of art, neighborhood walks, and food worth slowing down for."
        nights={2}
        travelers={2}
        startDate="2099-06-01"
        endDate="2099-06-03"
        phase="complete"
        progress={100}
        message="Your journey is ready"
        searchProgress={{ aggregator: "done" }}
        activitiesCount={8}
        diningCount={4}
        transportCount={0}
        days={sampleDays}
        onOpenTrip={() => setScreen("trip")}
      />
    );
  return (
    <div className="min-h-screen bg-slate-50">
      <TripHeader
        destination="Paris"
        heroImageUrl={
          "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format&fit=crop&q=80"
        }
        startDate="2099-06-01"
        endDate="2099-06-03"
        travelers={2}
        showActions={false}
      />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h2 className="mb-4 font-editorial text-2xl text-slate-900">
          Your itinerary
        </h2>
        <TripDayNavigation
          days={days}
          selectedIndex={selected}
          onSelect={setSelected}
          idPrefix="fixture-day"
        />
        {days.map((day, index) => (
          <div
            key={day.date}
            id={`fixture-day-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`fixture-day-tab-${index}`}
            hidden={selected !== index}
            tabIndex={0}
            className="mt-4"
          >
            <ItineraryDay
              {...day}
              summary={day.summary}
              morning={day.morning}
              afternoon={day.afternoon}
              evening={day.evening}
            />
          </div>
        ))}
        <section className="mt-12">
          <h2 className="mb-5 font-editorial text-2xl text-slate-900">
            A place to settle in
          </h2>
          <FeaturedHotelCard
            nights={2}
            hotel={{
              name: "A stay in Saint-Germain",
              images: [cover],
              description:
                "A suggested base for galleries, neighborhood walks, and unhurried mornings.",
              amenities: ["Breakfast", "Concierge", "Central location"],
            }}
          />
        </section>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

function LiveFixture({ onOpenTrip }: { onOpenTrip: () => void }) {
  const [serverCompleted, setServerCompleted] = useState(false);
  const state = useTripGeneration({
    tripId: "fixture",
    generationId: "fixture-job",
    completed: serverCompleted,
    enabled: !serverCompleted,
  });
  return (
    <ItineraryGenerationLoader
      destination="Paris"
      heroImageUrl={cover}
      nights={2}
      travelers={2}
      startDate="2099-06-01"
      endDate="2099-06-03"
      phase={state.phase}
      progress={state.progress}
      message={state.error || state.message}
      summary="Three beautifully paced days in Paris, ready to make your own."
      searchProgress={state.searchProgress}
      activitiesCount={state.activitiesCount}
      diningCount={state.diningCount}
      transportCount={state.transportCount}
      days={state.days}
      specBlocks={state.specBlocks}
      hotelPreview={
        state.topHotel
          ? {
              name: state.topHotel.name,
              image: state.topHotel.images?.[0],
              description: state.topHotel.description,
              amenities: state.topHotel.amenities,
            }
          : undefined
      }
      onOpenTrip={onOpenTrip}
    >
      <output data-testid="stream-state" className="sr-only">
        {JSON.stringify({
          blocks: state.specBlocks,
          days: state.days,
          phase: state.phase,
        })}
      </output>
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p>Your trip is saved. You can leave and return.</p>
        {state.phase === "error" && (
          <button
            className="mr-4 mt-3 min-h-11 font-semibold text-primary-800 underline"
            onClick={state.reconnect}
          >
            Reconnect live updates
          </button>
        )}
        <button
          className="mt-3 min-h-11 font-semibold text-primary-800 underline"
          onClick={async () => {
            const status = await (
              await fetch("/api/trips/fixture/generate")
            ).json();
            setServerCompleted(status.status === "completed");
          }}
        >
          Check planning status
        </button>
      </aside>
    </ItineraryGenerationLoader>
  );
}
