import React from "react";
import { createRoot } from "react-dom/client";
import {
  TripCheckout,
  useTripCheckout,
} from "../../components/trips/TripCheckout";

function Experience() {
  const checkout = useTripCheckout()!;
  return (
    <button
      disabled={!checkout.enabled}
      onClick={() =>
        checkout.review({
          id: "activity_v_123P1",
          name: "Paris walking tour",
          date: "2099-06-01",
        })
      }
    >
      Review experience
    </button>
  );
}

createRoot(document.getElementById("root")!).render(
  <TripCheckout tripId="00000000-0000-4000-8000-000000000001" travelers={2}>
    <Experience />
  </TripCheckout>,
);
