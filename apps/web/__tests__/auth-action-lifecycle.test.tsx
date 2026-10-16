import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import {
  AuthActionProvider,
  useAuthActions,
} from "../components/auth/AuthActionProvider";

test("restoring an auth screen invalidates the previous attempt without unlocking its replacement", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  vi.stubGlobal("window", {
    addEventListener: (
      name: string,
      listener: (event: { persisted: boolean }) => void,
    ) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  });
  let actions!: ReturnType<typeof useAuthActions>;
  function Probe() {
    const current = useAuthActions();
    React.useEffect(() => {
      actions = current;
    }, [current]);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <AuthActionProvider>
          <Probe />
        </AuthActionProvider>,
      );
    });
    let first!: symbol;
    await act(async () => {
      first = actions.begin("email")!;
    });
    expect(actions.begin("google")).toBeNull();
    await act(async () => {
      listeners.get("pageshow")!({ persisted: false });
    });
    expect(actions.isActive(first)).toBe(true);
    await act(async () => {
      listeners.get("pageshow")!({ persisted: true });
    });
    expect(actions.isActive(first)).toBe(false);
    let second!: symbol;
    await act(async () => {
      second = actions.begin("google")!;
    });
    await act(async () => {
      actions.finish(first);
    });
    expect(actions.pending).toBe("google");
    expect(actions.isActive(second)).toBe(true);
    expect(actions.begin("email")).toBeNull();
    await act(async () => {
      actions.finish(second);
    });
    expect(actions.pending).toBeNull();
    expect(actions.isActive(second)).toBe(false);
    let third!: symbol;
    await act(async () => {
      third = actions.begin("apple")!;
    });
    await act(async () => {
      renderer.unmount();
    });
    expect(actions.isActive(third)).toBe(false);
    expect(actions.begin("email")).toBeNull();
    expect(listeners.size).toBe(0);
  } finally {
    if (renderer)
      await act(async () => {
        renderer.unmount();
      });
    vi.unstubAllGlobals();
  }
});
