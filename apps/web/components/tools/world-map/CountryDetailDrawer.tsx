"use client";

import { useRef, useState } from "react";
import { ChevronDown, MapPin, Star, Trash2, X } from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { useWorldMapStore } from "@/lib/tools/world-map/store";
import { CONTINENT_BY_ALPHA3 } from "@/lib/tools/world-map/continents";
import type { CountryVisit } from "@/lib/tools/world-map/types";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";
import { PhotoUpload } from "./PhotoUpload";
import type { WorldMapAffiliateBundle } from "./world-map-affiliates";

interface Props {
  iso: string | null;
  name: string | null;
  onClose: () => void;
  bundlesByCountryKey?: Record<string, WorldMapAffiliateBundle>;
  defaultLinks?: WorldMapAffiliateBundle;
}

const EMPTY_DRAFT = (iso: string): CountryVisit => ({
  iso,
  status: "visited",
});

function buildClientSafeBookingFallback(
  countryLabel: string,
): AffiliateLinkResult | null {
  const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(countryLabel)}`;
  if (!isAllowedAffiliateUrl(url)) return null;
  return {
    partner: "booking",
    label: `Explore stays in ${countryLabel}`,
    vertical: "hotels",
    url,
    configured: false,
    isSearchFallback: true,
    disclosure: "We may earn a commission at no extra cost to you.",
  };
}

export function CountryDetailDrawer({
  iso,
  name,
  onClose,
  bundlesByCountryKey,
  defaultLinks,
}: Props) {
  const open = Boolean(iso);
  const visit = useWorldMapStore((s) => {
    if (!iso) return undefined;
    const profile = s.profiles.find((p) => p.id === s.activeProfileId);
    return profile?.visits[iso];
  });
  const upsertVisit = useWorldMapStore((s) => s.upsertVisit);
  const deleteVisit = useWorldMapStore((s) => s.deleteVisit);

  const [draft, setDraft] = useState<CountryVisit | null>(() =>
    iso ? (visit ?? EMPTY_DRAFT(iso)) : null,
  );
  const [moreOpen, setMoreOpen] = useState(() =>
    Boolean(
      visit?.firstVisit ||
      visit?.lastVisit ||
      visit?.visitCount ||
      visit?.rating ||
      visit?.pinnedCity ||
      visit?.notes ||
      visit?.photoDataUrl,
    ),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocusTrap({ open, dialogRef, onClose });

  if (!open || !iso || !draft) return null;

  const isPinned = Boolean(visit);
  const countryLabel = name || iso;
  const matchedBundle = bundlesByCountryKey?.[countryLabel.toLowerCase()];
  const fallbackBooking = buildClientSafeBookingFallback(countryLabel);
  const stayLink =
    matchedBundle?.stay?.url && isAllowedAffiliateUrl(matchedBundle.stay.url)
      ? matchedBundle.stay
      : defaultLinks?.stay?.url && isAllowedAffiliateUrl(defaultLinks.stay.url)
        ? (fallbackBooking ?? defaultLinks.stay)
        : fallbackBooking;
  const flightLink =
    matchedBundle?.flight?.url &&
    isAllowedAffiliateUrl(matchedBundle.flight.url)
      ? matchedBundle.flight
      : defaultLinks?.flight?.url &&
          isAllowedAffiliateUrl(defaultLinks.flight.url)
        ? defaultLinks.flight
        : null;
  const esimLink =
    matchedBundle?.esim?.url && isAllowedAffiliateUrl(matchedBundle.esim.url)
      ? matchedBundle.esim
      : defaultLinks?.esim?.url && isAllowedAffiliateUrl(defaultLinks.esim.url)
        ? defaultLinks.esim
        : null;
  const insuranceLink =
    matchedBundle?.insurance?.url &&
    isAllowedAffiliateUrl(matchedBundle.insurance.url)
      ? matchedBundle.insurance
      : defaultLinks?.insurance?.url &&
          isAllowedAffiliateUrl(defaultLinks.insurance.url)
        ? defaultLinks.insurance
        : null;

  const hasPartnerLinks = Boolean(
    stayLink || flightLink || esimLink || insuranceLink,
  );
  const campaign = `tool-world-map-${iso.toLowerCase()}`;

  function save() {
    if (!draft || !iso) return;
    upsertVisit(iso, {
      firstVisit: draft.firstVisit || undefined,
      lastVisit: draft.lastVisit || undefined,
      visitCount: draft.visitCount || undefined,
      pinnedCity: draft.pinnedCity || undefined,
      notes: draft.notes || undefined,
      rating: draft.rating,
      photoDataUrl: draft.photoDataUrl,
    });
    onClose();
  }

  function pinAndClose() {
    if (!iso) return;
    upsertVisit(iso, {});
    onClose();
  }

  function unpin() {
    if (!iso) return;
    deleteVisit(iso);
    onClose();
  }

  const continent = CONTINENT_BY_ALPHA3[iso];

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-labelledby="country-drawer-title"
        tabIndex={-1}
        className="fixed z-50 bg-white shadow-2xl overflow-hidden flex flex-col inset-x-0 bottom-0 top-auto rounded-t-2xl max-h-[92vh] md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-2xl animate-slide-up md:animate-slide-in-right"
      >
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-start justify-between px-5 pt-4 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-[#EFF5F3] text-[#143D46] border border-[#DCE5E3]">
                {iso}
              </span>
              <h2
                id="country-drawer-title"
                className="text-2xl font-bold text-ink font-editorial truncate"
              >
                {countryLabel}
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              {continent ? <span>{continent}</span> : null}
              {isPinned ? (
                <span className="inline-flex items-center gap-1 text-primary-800 font-semibold ml-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" /> Pinned
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!isPinned && (
            <p className="text-sm text-slate-600 leading-relaxed">
              You haven&apos;t pinned {countryLabel} yet. Pin it now, and
              optionally add when you went, who you were with, and a photo.
            </p>
          )}

          {hasPartnerLinks && (
            <div className="rounded-xl border border-[#DCE5E3] bg-[#EFF5F3] p-4 space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#143D46]">
                  Plan &amp; book for {countryLabel}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Compare stays, flights, and travel essentials for your next
                  visit.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stayLink?.url && (
                  <TrackedAffiliateButton
                    label={stayLink.label}
                    variant="subtle"
                    source="tool"
                    placement="world_map_drawer"
                    campaign={campaign}
                    itemId={`map-${iso}-stay-${stayLink.partner}`}
                    itemName={stayLink.label}
                    itemType="hotel"
                    affiliateUrl={stayLink.url}
                    partner={stayLink.partner}
                  />
                )}
                {flightLink?.url && (
                  <TrackedAffiliateButton
                    label={flightLink.label}
                    variant="subtle"
                    source="tool"
                    placement="world_map_drawer"
                    campaign={campaign}
                    itemId={`map-${iso}-flight-${flightLink.partner}`}
                    itemName={flightLink.label}
                    itemType="flight"
                    affiliateUrl={flightLink.url}
                    partner={flightLink.partner}
                  />
                )}
                {esimLink?.url && (
                  <TrackedAffiliateButton
                    label={esimLink.label}
                    variant="subtle"
                    source="tool"
                    placement="world_map_drawer"
                    campaign={campaign}
                    itemId={`map-${iso}-esim-${esimLink.partner}`}
                    itemName={esimLink.label}
                    itemType={itemTypeForAffiliatePartner(esimLink.partner)}
                    affiliateUrl={esimLink.url}
                    partner={esimLink.partner}
                  />
                )}
                {insuranceLink?.url && (
                  <TrackedAffiliateButton
                    label={insuranceLink.label}
                    variant="subtle"
                    source="tool"
                    placement="world_map_drawer"
                    campaign={campaign}
                    itemId={`map-${iso}-ins-${insuranceLink.partner}`}
                    itemName={insuranceLink.label}
                    itemType={itemTypeForAffiliatePartner(
                      insuranceLink.partner,
                    )}
                    affiliateUrl={insuranceLink.url}
                    partner={insuranceLink.partner}
                  />
                )}
              </div>
              <AffiliateDisclosure
                variant="short"
                className="text-xs text-slate-600"
              />
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 py-2 transition-colors"
              aria-expanded={moreOpen}
              aria-controls="country-optional-details"
            >
              <span>Optional details</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  moreOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {moreOpen && (
              <div id="country-optional-details" className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First visit">
                    <input
                      type="date"
                      aria-label="First visit"
                      value={draft.firstVisit || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, firstVisit: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last visit">
                    <input
                      type="date"
                      aria-label="Last visit"
                      value={draft.lastVisit || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, lastVisit: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Times visited">
                    <input
                      type="number"
                      aria-label="Times visited"
                      min="0"
                      value={draft.visitCount ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          visitCount: e.target.value
                            ? Math.max(0, Number(e.target.value))
                            : undefined,
                        })
                      }
                      className={`${inputClass} tabular-nums`}
                      placeholder="1"
                    />
                  </Field>
                  <Field label="Rating">
                    <div className="flex items-center gap-1 h-[38px]">
                      {[1, 2, 3, 4, 5].map((r) => {
                        const active = (draft.rating ?? 0) >= r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                rating:
                                  draft.rating === r
                                    ? undefined
                                    : (r as 1 | 2 | 3 | 4 | 5),
                              })
                            }
                            className={`p-1 transition-all ${
                              active
                                ? "text-amber-600 scale-110"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                            aria-label={`Rate ${r} out of 5`}
                          >
                            <Star
                              className="w-4 h-4"
                              fill={active ? "currentColor" : "none"}
                              aria-hidden="true"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>

                <Field label="Memorable city">
                  <input
                    type="text"
                    aria-label="Memorable city"
                    value={draft.pinnedCity || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, pinnedCity: e.target.value })
                    }
                    placeholder="e.g. Kyoto"
                    className={inputClass}
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    aria-label="Notes"
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                    rows={4}
                    placeholder="What did you love? What would you do differently?"
                    className={`${inputClass} leading-relaxed resize-none`}
                  />
                </Field>

                <Field label="Cover photo">
                  <PhotoUpload
                    value={draft.photoDataUrl}
                    onChange={(url) =>
                      setDraft({ ...draft, photoDataUrl: url })
                    }
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 bg-[#FAF8F3]">
          {isPinned ? (
            <button
              type="button"
              onClick={unpin}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove pin
            </button>
          ) : (
            <span className="text-xs text-slate-600">
              {moreOpen ? "Save will pin and store details" : ""}
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              Cancel
            </button>
            {isPinned ? (
              <button
                type="button"
                onClick={save}
                className="text-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 px-5 py-2 rounded-lg transition-all"
              >
                Save details
              </button>
            ) : (
              <button
                type="button"
                onClick={moreOpen ? save : pinAndClose}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 px-5 py-2 rounded-lg transition-all"
              >
                <MapPin className="w-4 h-4" aria-hidden="true" /> Pin{" "}
                {countryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const inputClass =
  "w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700/40 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-slate-600 font-semibold mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
