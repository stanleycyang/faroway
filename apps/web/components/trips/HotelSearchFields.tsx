"use client";
import { useState } from "react";
import {
  HOTEL_SEARCH_CONSENT_VERSION,
  HOTEL_SEARCH_DISCLOSURE,
  validateHotelSearchDetails,
  parseHotelChildrenAges,
  hotelChildrenAgeText,
  type HotelSearchDetails,
} from "@faroway/constants";

export function HotelSearchFields({
  value,
  travelers,
  adults,
  onChange,
  ageText: editorAgeText,
  onAgeTextChange,
}: {
  value: HotelSearchDetails | null;
  travelers: number;
  adults?: number;
  /** Optional editor-only raw input, never part of HotelSearchDetails. */
  ageText?: string[];
  onAgeTextChange?: (value: string[]) => void;
  onChange: (value: HotelSearchDetails | null) => void;
}) {
  const [localAgeText, setLocalAgeText] = useState(
    value?.rooms.map((room) => room.children.join(", ")) || [],
  );
  const ageText = editorAgeText ?? localAgeText;
  const setAgeText = (text: string[]) => {
    setLocalAgeText(text);
    onAgeTextChange?.(text);
  };
  const initialAdults = adults ?? travelers;
  const input =
    "mt-1 block min-h-11 w-full rounded-xl border border-gray-300 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4 my-4">
      <legend className="font-semibold px-1">
        Hotel room details (optional)
      </legend>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(event) => {
            setAgeText([""]);
            onChange(
              event.target.checked
                ? {
                    countryCode: "",
                    guestNationality: "",
                    consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
                    rooms: Array.from(
                      { length: Math.min(4, Math.ceil(initialAdults / 8)) },
                      (_, index) => ({
                        adults: Math.min(8, initialAdults - index * 8),
                        children: [],
                      }),
                    ),
                  }
                : null,
            );
          }}
        />
        <span>Save room details and allow hotel searches with Nuitee</span>
      </label>
      <p className="text-sm text-gray-600 mt-2">{HOTEL_SEARCH_DISCLOSURE}</p>
      {value && (
        <div className="mt-4 space-y-4">
          <label className="block">
            Destination country (two-letter code)
            <input
              value={value.countryCode}
              maxLength={2}
              onChange={(event) =>
                onChange({
                  ...value,
                  countryCode: event.target.value.toUpperCase(),
                })
              }
              placeholder="For example: FR"
              className={input}
            />
          </label>
          <label className="block">
            Guest nationality (two-letter code)
            <input
              value={value.guestNationality}
              maxLength={2}
              onChange={(event) =>
                onChange({
                  ...value,
                  guestNationality: event.target.value.toUpperCase(),
                })
              }
              placeholder="For example: US"
              className={input}
            />
          </label>
          {value.rooms.map((room, index) => (
            <div
              key={index}
              className="grid sm:grid-cols-2 gap-3 border-t pt-3"
            >
              <label>
                Adults in room {index + 1}
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={room.adults}
                  className={input}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rooms: value.rooms.map((item, i) =>
                        i === index
                          ? { ...item, adults: Number(event.target.value) }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Children’s ages at check-in, room {index + 1}
                <input
                  value={hotelChildrenAgeText(room.children, ageText[index])}
                  placeholder="For example: 6, 10"
                  className={input}
                  onChange={(event) => {
                    const text = event.target.value;
                    setAgeText(
                      value.rooms.map((item, i) =>
                        i === index
                          ? text
                          : hotelChildrenAgeText(item.children, ageText[i]),
                      ),
                    );
                    const children = parseHotelChildrenAges(text);
                    onChange({
                      ...value,
                      rooms: value.rooms.map((item, i) =>
                        i === index ? { ...item, children } : item,
                      ),
                    });
                  }}
                />
              </label>
            </div>
          ))}
          <div className="flex gap-4">
            {value.rooms.length < 4 && (
              <button
                type="button"
                className="min-h-11 px-2 underline text-sm"
                onClick={() => {
                  setAgeText([
                    ...value.rooms.map((room, i) =>
                      hotelChildrenAgeText(room.children, ageText[i]),
                    ),
                    "",
                  ]);
                  onChange({
                    ...value,
                    rooms: [...value.rooms, { adults: 1, children: [] }],
                  });
                }}
              >
                Add room
              </button>
            )}
            {value.rooms.length > 1 && (
              <button
                type="button"
                className="min-h-11 px-2 underline text-sm"
                onClick={() => {
                  setAgeText(ageText.slice(0, -1));
                  onChange({ ...value, rooms: value.rooms.slice(0, -1) });
                }}
              >
                Remove last room
              </button>
            )}
          </div>
          {!validateHotelSearchDetails(value, travelers) && (
            <p role="status" className="text-sm text-amber-800">
              Complete the country codes and room guests. Room guests must total{" "}
              {travelers}; children’s ages must be 0–17.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
