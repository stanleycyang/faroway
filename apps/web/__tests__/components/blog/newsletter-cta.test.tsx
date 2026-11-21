import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NewsletterCTA brand alignment & E2E contracts", () => {
  it("renders crisp Mist/Paper surface without .glass-card, banned placeholder, or amber bar", () => {
    const html = renderToStaticMarkup(<NewsletterCTA />);
    expect(html).not.toContain("glass-card");
    expect(html).not.toContain("placeholder:text-slate-400");
    expect(html).not.toContain("from-primary to-amber-500");
    expect(html).toContain("bg-[#EFF5F3]");
    expect(html).toContain("bg-[#143D46]");
    expect(html).toContain("Email address");
    expect(html).toContain("Subscribe Free");
  });

  it("submits email to /api/blog/newsletter, focuses status without promising welcome email", async () => {
    const focusSpy = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(<NewsletterCTA />, {
        createNodeMock: (el) => {
          if (el.type === "p") {
            return { focus: focusSpy };
          }
          return {};
        },
      });
    });

    const input = root.root.findByProps({ id: "newsletter-email" });
    await act(async () => {
      input.props.onChange({ target: { value: "reader@example.invalid" } });
    });

    const form = root.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/blog/newsletter");
    expect(JSON.parse(init.body)).toEqual({
      email: "reader@example.invalid",
      source: "blog",
    });

    const status = root.root.findByProps({ role: "status" });
    const statusText = status.children.join("");
    expect(statusText).toContain("You’re subscribed");
    expect(statusText).toContain("reader@example.invalid");
    expect(statusText.toLowerCase()).not.toContain("welcome email");
    expect(focusSpy).toHaveBeenCalled();
  });

  it("preserves email on 503 failure and renders alert for retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ success: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
    vi.stubGlobal("fetch", fetchMock);

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(<NewsletterCTA />);
    });

    const input = root.root.findByProps({ id: "newsletter-email" });
    await act(async () => {
      input.props.onChange({ target: { value: "retry@example.invalid" } });
    });

    const form = root.root.findByType("form");
    await act(async () => {
      await form.props.onSubmit({ preventDefault: vi.fn() });
    });

    const alert = root.root.findByProps({ role: "alert" });
    expect(alert.children.join("")).toContain(
      "couldn’t confirm your subscription",
    );
    expect(root.root.findByProps({ id: "newsletter-email" }).props.value).toBe(
      "retry@example.invalid",
    );

    await act(async () => {
      await root.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      root.root.findByProps({ role: "status" }).children.join(""),
    ).toContain("You’re subscribed");
  });
});
