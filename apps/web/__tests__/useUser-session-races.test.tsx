import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  profile: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));
const callbacks: Array<
  (event: AuthChangeEvent, session: Session | null) => void
> = [];
let authChange: (event: AuthChangeEvent, session: Session | null) => void;
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }),
    auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange(callback: typeof authChange) {
        authChange = callback;
        callbacks.push(callback);
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));
import { useUser, useUserProfile } from "../hooks/useUser";

function session(id: string): Session {
  return {
    access_token: `fixture-${id}`,
    refresh_token: "fixture-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      email: `${id}@example.invalid`,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let state: ReturnType<typeof useUser>;
let renderer: ReactTestRenderer | undefined;
function Harness() {
  const current = useUser();
  React.useLayoutEffect(() => {
    state = current;
  });
  return null;
}
async function mount() {
  await act(async () => {
    renderer = create(<Harness />);
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  callbacks.length = 0;
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
});

test("a delayed initial session cannot resurrect an account after sign-out", async () => {
  const pending = deferred<{ data: { session: Session }; error: null }>();
  mocks.getSession.mockReturnValue(pending.promise);
  await mount();
  await act(async () => {
    authChange("SIGNED_OUT", null);
  });
  await act(async () => {
    pending.resolve({ data: { session: session("A") }, error: null });
  });
  expect(state.user).toBeNull();
  expect(state.session).toBeNull();
  expect(state.loading).toBe(false);
});

test("a failed refresh cannot erase a newer signed-in account or display its stale error", async () => {
  await mount();
  const pending = deferred<{ data: { session: Session }; error: null }>();
  mocks.getSession.mockReturnValue(pending.promise);
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = state.refresh();
  });
  await act(async () => {
    authChange("SIGNED_IN", session("B"));
  });
  await act(async () => {
    pending.reject(new Error("Old request failed"));
    await refresh;
  });
  expect(state.user?.id).toBe("B");
  expect(state.error).toBeNull();
  expect(state.loading).toBe(false);
});

test("a departing account's logout completion cannot clear a new account", async () => {
  await mount();
  await act(async () => {
    authChange("SIGNED_IN", session("A"));
  });
  const pending = deferred<{ error: null }>();
  mocks.signOut.mockReturnValue(pending.promise);
  let logout!: Promise<void>;
  await act(async () => {
    logout = state.signOut();
  });
  await act(async () => {
    authChange("SIGNED_OUT", null);
    authChange("SIGNED_IN", session("B"));
  });
  await act(async () => {
    pending.resolve({ error: null });
    await logout;
  });
  expect(state.user?.id).toBe("B");
  expect(state.loading).toBe(false);
});

test("unmount unsubscribes and ignores both pending reads and late callbacks", async () => {
  const pending = deferred<{ data: { session: Session }; error: null }>();
  mocks.getSession.mockReturnValue(pending.promise);
  await mount();
  const before = state;
  await act(async () => {
    renderer!.unmount();
  });
  renderer = undefined;
  await act(async () => {
    pending.resolve({ data: { session: session("A") }, error: null });
    authChange("SIGNED_IN", session("B"));
  });
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  expect(state).toBe(before);
});

test("Strict Mode cleanup fences an old subscription even after the new effect is active", async () => {
  const oldRead = deferred<{ data: { session: Session }; error: null }>();
  mocks.getSession
    .mockReturnValueOnce(oldRead.promise)
    .mockResolvedValue({ data: { session: session("B") }, error: null });
  await act(async () => {
    renderer = create(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    );
  });
  expect(callbacks).toHaveLength(2);
  expect(state.user?.id).toBe("B");
  await act(async () => {
    callbacks[0]("SIGNED_OUT", null);
    oldRead.resolve({ data: { session: session("A") }, error: null });
  });
  expect(state.user?.id).toBe("B");
  expect(state.loading).toBe(false);
});

test("stalled session read ends loading and ignores a late signed-in result", async () => {
  vi.useFakeTimers();
  const pending = deferred<{ data: { session: Session }; error: null }>();
  mocks.getSession.mockReturnValue(pending.promise);
  try {
    await mount();
    expect(state.loading).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(state.loading).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error?.message).toContain("could not be confirmed");
    await act(async () => {
      pending.resolve({ data: { session: session("Late") }, error: null });
    });
    expect(state.user).toBeNull();
    expect(state.error?.message).toContain("could not be confirmed");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test("stalled sign-out preserves the known account and releases loading without claiming success", async () => {
  vi.useFakeTimers();
  try {
    await mount();
    await act(async () => {
      authChange("SIGNED_IN", session("A"));
    });
    const pending = deferred<{ error: null }>();
    mocks.signOut.mockReturnValue(pending.promise);
    let logout!: Promise<void>;
    await act(async () => {
      logout = state.signOut();
    });
    await act(async () => {
      vi.advanceTimersByTime(20_000);
      await logout;
    });
    expect(state.loading).toBe(false);
    expect(state.user?.id).toBe("A");
    expect(state.error?.message).toContain("could not be confirmed");
    await act(async () => {
      pending.resolve({ error: null });
    });
    expect(state.user?.id).toBe("A");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

test("batched same-owner reauthentication changes account revision while token refresh preserves it", async () => {
  await mount();
  await act(async () => {
    authChange("SIGNED_IN", session("a"));
  });
  const revision = state.accountRevision;
  await act(async () => {
    authChange("TOKEN_REFRESHED", session("a"));
  });
  expect(state.accountRevision).toBe(revision);
  await act(async () => {
    authChange("SIGNED_OUT", null);
    authChange("SIGNED_IN", session("a"));
  });
  expect(state.accountRevision).toBe(revision + 2);
  expect(state.session?.user.id).toBe("a");
});

test("a late profile response cannot replace the new account profile", async () => {
  const old = deferred<{ data: { id: string; email: string }; error: null }>();
  mocks.profile.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
    data: { id: "b", email: "b@example.invalid" },
    error: null,
  });
  let profileState!: ReturnType<typeof useUserProfile>;
  function ProfileHarness() {
    const current = useUserProfile();
    React.useLayoutEffect(() => {
      profileState = current;
    });
    return null;
  }
  await act(async () => {
    renderer = create(<ProfileHarness />);
  });
  await act(async () => {
    authChange("SIGNED_IN", session("a"));
  });
  await act(async () => {
    authChange("SIGNED_IN", session("b"));
  });
  expect(profileState.profile?.id).toBe("b");
  await act(async () => {
    old.resolve({ data: { id: "a", email: "a@example.invalid" }, error: null });
  });
  expect(profileState.profile?.id).toBe("b");
  expect(profileState.error).toBeNull();
});
