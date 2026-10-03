"use client";

import { createContext, useContext } from "react";

const ViatorContentContext = createContext(false);

export function ViatorContentPolicy({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <ViatorContentContext.Provider value={enabled}>
      {children}
    </ViatorContentContext.Provider>
  );
}

export function useViatorContentEnabled() {
  return useContext(ViatorContentContext);
}
