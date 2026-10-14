import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { TripFeedback } from "../components/trips/TripFeedback";
test("feedback submits one frozen snapshot and requires confirmed success before thanking the user", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let resolveResponse!: (r: Response) => void;
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripFeedback tripId="trip-a" />);
    });
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((b) => b.props["aria-label"] === "4 out of 5")!
        .props.onClick();
    });
    await act(async () => {
      renderer.root
        .findByType("textarea")
        .props.onChange({ target: { value: "A useful plan" } });
    });
    const submit = () =>
      renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Send feedback"))!.props.onClick;
    let pending!: Promise<void>;
    await act(async () => {
      const action = submit();
      pending = action();
      void action();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findAllByType("fieldset").every((f) => f.props.disabled),
    ).toBe(true);
    expect(renderer.root.findByType("textarea").props.disabled).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      score: 4,
      comment: "A useful plan",
    });
    await act(async () => {
      resolveResponse(new Response(JSON.stringify({}), { status: 200 }));
      await pending;
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      "Thanks for your feedback",
    );
    expect(JSON.stringify(renderer.toJSON())).toContain("couldn’t confirm");
    expect(renderer.root.findByType("textarea").props.value).toBe(
      "A useful plan",
    );
    await act(async () => {
      await submit()();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Thanks for your feedback",
    );
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});
