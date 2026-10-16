import { afterEach, expect, test, vi } from "vitest";
import {
  AuthRequestTimeoutError,
  withAuthRequestDeadline,
} from "@/lib/auth/request-deadline";

afterEach(() => {
  vi.useRealTimers();
});

test("returns the operation result when it settles before the deadline", async () => {
  await expect(withAuthRequestDeadline(Promise.resolve("ok"))).resolves.toBe(
    "ok",
  );
});

test("surfaces an operation failure that settles before the deadline", async () => {
  await expect(
    withAuthRequestDeadline(Promise.reject(new Error("unavailable"))),
  ).rejects.toThrow("unavailable");
});

test("a late rejection after the deadline stays handled", async () => {
  vi.useFakeTimers();
  let rejectLate: (error: unknown) => void = () => {};
  const operation = new Promise<string>((_resolve, reject) => {
    rejectLate = reject;
  });
  const pending = withAuthRequestDeadline(operation);
  const assertion = expect(pending).rejects.toBeInstanceOf(
    AuthRequestTimeoutError,
  );
  await vi.advanceTimersByTimeAsync(20_000);
  await assertion;
  rejectLate(new Error("late provider failure"));
  await Promise.resolve();
  await Promise.resolve();
});
