"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AuthActions {
  pending: string | null;
  begin: (action: string) => symbol | null;
  finish: (attempt: symbol) => void;
  isActive: (attempt: symbol) => boolean;
}
const AuthActionContext = createContext<AuthActions | null>(null);

/** One owner for all methods on an auth screen, including same-tick submits. */
export function AuthActionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const activeRef = useRef(true);
  const attemptRef = useRef<symbol | null>(null);
  useEffect(() => {
    activeRef.current = true;
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      pendingRef.current = null;
      attemptRef.current = null;
      setPending(null);
    };
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pageshow", restore);
      activeRef.current = false;
      attemptRef.current = null;
    };
  }, []);
  return (
    <AuthActionContext.Provider
      value={{
        pending,
        begin(action) {
          if (!activeRef.current || pendingRef.current) return null;
          const attempt = Symbol(action);
          attemptRef.current = attempt;
          pendingRef.current = action;
          setPending(action);
          return attempt;
        },
        finish(attempt) {
          if (attemptRef.current !== attempt) return;
          attemptRef.current = null;
          pendingRef.current = null;
          if (activeRef.current) setPending(null);
        },
        isActive: (attempt) =>
          activeRef.current && attemptRef.current === attempt,
      }}
    >
      {children}
    </AuthActionContext.Provider>
  );
}

export function useAuthActions() {
  const context = useContext(AuthActionContext);
  if (!context) throw new Error("Auth controls require AuthActionProvider");
  return context;
}
