import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TripDay } from "@faroway/types";
const account = vi.hoisted(() => ({ owner: "owner", revision: 0 }));
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    session: { user: { id: account.owner } },
    loading: false,
    accountRevision: account.revision,
  }),
}));
import { VenueEvidencePanel } from "@/components/trips/VenueEvidencePanel";
const props = {
  tripId: "trip",
  ownerId: "owner",
  revision: "2026-10-28T00:00:00Z",
  days: [
    { morning: { activities: [{ id: "venue", name: "Museum" }], meals: [] } },
  ] as unknown as TripDay[],
};
const entry = {
  venue_id: "venue",
  requirement: "step_free_entrance",
  status: "contradicted",
  note: "Private staff report",
  observed_at: props.revision,
  evidence_revision: "a".repeat(64),
};
let renderer: ReturnType<typeof create> | undefined;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  account.owner = "owner";
  account.revision = 0;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    renderer = create(<VenueEvidencePanel {...props} />);
  });
  await act(async () =>
    renderer!.root.findAllByType("button")[0].props.onClick(),
  );
}
test("loads the matching plan context and removes private reports on account switch", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tripRevision: props.revision,
          evidenceRevision: "a".repeat(64),
          evidence: [entry],
        }),
      ),
    ),
  );
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain(entry.note);
  account.owner = "other";
  account.revision++;
  await act(async () => renderer!.update(<VenueEvidencePanel {...props} />));
  expect(renderer!.toJSON()).toBeNull();
});
test("discards evidence from a different trip revision", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tripRevision: props.revision,
          evidenceRevision: "a".repeat(64),
          evidence: [{ ...entry, evidence_revision: "b".repeat(64) }],
        }),
      ),
    ),
  );
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(entry.note);
  expect(JSON.stringify(renderer!.toJSON())).toContain("Could not load");
});

test("sharing-only version updates reload the same reports", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        tripRevision: props.revision,
        evidenceRevision: "a".repeat(64),
        evidence: [entry],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  await mount();
  const next = { ...props, revision: "2026-10-28T01:00:00Z" };
  fetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        tripRevision: next.revision,
        evidenceRevision: "a".repeat(64),
        evidence: [entry],
      }),
    ),
  );
  await act(async () => renderer!.update(<VenueEvidencePanel {...next} />));
  await act(async () =>
    renderer!.root.findAllByType("button")[0].props.onClick(),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain(entry.note);
});

test("does not display old reports when reopening fails to refresh", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tripRevision: props.revision,
            evidenceRevision: "a".repeat(64),
            evidence: [entry],
          }),
        ),
      )
      .mockRejectedValueOnce(new Error("offline")),
  );
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain(entry.note);
  await act(async () =>
    renderer!.root.findAllByType("button")[0].props.onClick(),
  );
  await act(async () =>
    renderer!.root.findAllByType("button")[0].props.onClick(),
  );
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(entry.note);
  expect(JSON.stringify(renderer!.toJSON())).toContain("Could not load");
});
