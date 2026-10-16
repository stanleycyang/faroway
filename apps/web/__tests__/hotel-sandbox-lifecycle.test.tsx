import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { HotelSandbox } from "../app/hotels/sandbox/sandbox-form";
vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => true }));
vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
test("quote locks immediately, freezes fields and permits deliberate retry after rejection", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const fields = new Map<string, string>(
    Object.entries({
      city: "Paris",
      country: "FR",
      nationality: "US",
      checkin: "2026-11-08",
      checkout: "2026-11-10",
      adults: "2",
      children: "6, 10",
    }),
  );
  vi.stubGlobal(
    "FormData",
    class {
      get(name: string) {
        return fields.get(name);
      }
    },
  );
  let resolveResponse!: (response: Response) => void;
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ sandbox: true, data: [] }), {
        status: 200,
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<HotelSandbox />);
    });
    const submit = renderer.root.findByType("form").props.onSubmit;
    let pending!: Promise<void>;
    await act(async () => {
      pending = submit({ preventDefault: vi.fn(), currentTarget: {} });
      void submit({ preventDefault: vi.fn(), currentTarget: {} });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      cityName: "Paris",
      occupancies: [{ adults: 2, children: [6, 10] }],
    });
    await act(async () => {
      resolveResponse(new Response("Unavailable", { status: 429 }));
      await pending;
    });
    expect(renderer.root.findByType("fieldset").props.disabled).toBe(false);
    expect(JSON.stringify(renderer.toJSON())).toContain("Search limit reached");
    await act(async () => {
      await renderer.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn(), currentTarget: {} });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(renderer.toJSON())).toContain("hotels returned");
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      "Search limit reached",
    );
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});
