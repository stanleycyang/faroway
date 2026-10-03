import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PlacesAutocompleteInput } from "../../components/create/PlacesAutocompleteInput";

function Fixture() {
  const [selected, setSelected] = useState("");
  return (
    <>
      <PlacesAutocompleteInput
        localDestinations={[{ name: "Tokyo", country: "Japan" }]}
        onSelect={(place) => setSelected(JSON.stringify(place))}
      />
      <output>{selected}</output>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
