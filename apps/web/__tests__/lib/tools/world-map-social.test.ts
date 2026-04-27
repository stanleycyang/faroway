import { describe, it, expect } from "vitest";
import {
  socialShareText,
  smsIntent,
  threadsIntent,
  twitterIntent,
} from "@/lib/tools/world-map/social";

describe("socialShareText", () => {
  it("returns a signup nudge when the profile is empty", () => {
    const text = socialShareText("Stanley", 0, 0);
    expect(text).toContain("Stanley");
    expect(text).toContain("pin");
  });

  it("pluralizes country and continent correctly at 1", () => {
    const text = socialShareText("Stanley", 1, 1);
    expect(text).toContain("1 country");
    expect(text).toContain("1 continent");
    expect(text).not.toContain("countries");
    expect(text).not.toContain("continents");
  });

  it("pluralizes for N > 1", () => {
    const text = socialShareText("Stanley", 42, 5);
    expect(text).toContain("42 countries");
    expect(text).toContain("5 continents");
  });
});

describe("intent URL builders", () => {
  const url = "https://faroway.ai/tools/world-map/view?d=xyz";
  const text = "I've been to 42 countries";

  it("twitterIntent URL-encodes text and url", () => {
    const out = twitterIntent(url, text);
    expect(out).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
    expect(out).toContain(encodeURIComponent(url));
    // URLSearchParams uses `+` for spaces, which Twitter accepts.
    expect(out).toContain("I%27ve+been+to+42+countries");
  });

  it("threadsIntent embeds URL inline in the text param", () => {
    const out = threadsIntent(text, url);
    expect(out).toMatch(/^https:\/\/www\.threads\.net\/intent\/post\?/);
    expect(out).toContain("text=");
    // The URL should appear inside the `text` param, not as a separate one.
    expect(out).not.toMatch(/[&?]url=/);
  });

  it("smsIntent produces a body-only sms: URL", () => {
    const out = smsIntent(text, url);
    expect(out.startsWith("sms:?&body=")).toBe(true);
    expect(out).toContain(encodeURIComponent(url));
    expect(out).toContain(encodeURIComponent(text));
  });
});
