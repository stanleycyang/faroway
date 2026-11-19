import { describe, expect, it } from "vitest";
import { readVenueSource } from "@faroway/types";

const retrievedOn = "2026-11-02";

describe("readVenueSource", () => {
  it("keeps a public https page", () => {
    expect(
      readVenueSource({
        url: "https://restaurant.example/visit?lang=en",
        retrievedOn,
      }),
    ).toEqual({
      url: "https://restaurant.example/visit?lang=en",
      retrievedOn,
    });
  });

  it("drops non-public hosts that could be opened as a source link", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://restaurant.example/",
      "https://user:pass@restaurant.example/",
      "https://restaurant.example:8443/",
      "https://127.0.0.1/",
      "https://127.0.0.1:443/",
      "https://0x7f000001/",
      "https://2130706433/",
      "https://0177.0.0.1/",
      "https://127.1/",
      "https://169.254.169.254/",
      "https://[::1]/",
      "https://[::ffff:127.0.0.1]/",
      "https://localhost/",
      "https://evil.localhost/",
      "https://restaurant.example/path with space",
    ]) {
      expect(readVenueSource({ url, retrievedOn }), url).toBeUndefined();
    }
  });
});
