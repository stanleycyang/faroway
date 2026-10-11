import { describe, expect, it } from "vitest";
import {
  getAuthRedirectIntent,
  getLoginCopy,
  getSignupCopy,
} from "@/lib/auth/login-copy";

describe("auth copy for redirect intent", () => {
  it("does not say Welcome back when login is from create", () => {
    expect(getAuthRedirectIntent("/create")).toBe("create");
    expect(getAuthRedirectIntent("/create?resume=1")).toBe("create");
    const copy = getLoginCopy("/create");
    expect(copy.title).not.toMatch(/welcome back/i);
    expect(copy.title).toMatch(/waiting/i);
    expect(copy.emphasizeSignup).toBe(true);
    expect(copy.signupCta).toMatch(/sign up/i);
  });

  it("explains trips login instead of a silent welcome", () => {
    expect(getAuthRedirectIntent("/trips")).toBe("trips");
    const copy = getLoginCopy("/trips");
    expect(copy.title).toMatch(/see your trips/i);
    expect(copy.subtitle).toMatch(/signing in/i);
  });

  it("keeps Welcome back for generic dashboard login", () => {
    expect(getLoginCopy("/dashboard").title).toBe("Welcome back");
  });

  it("emphasizes signup copy for first-timers arriving from create", () => {
    const copy = getSignupCopy("/create?resume=1");
    expect(copy.title).toMatch(/generate your trip/i);
    expect(copy.subtitle).toMatch(/destination/i);
  });
});
