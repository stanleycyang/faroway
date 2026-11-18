"use client";

import { useState } from "react";
import Image from "next/image";
import { JourneyCoverArtwork } from "./JourneyCoverArtwork";

const OPTIMIZED_HOSTS = new Set([
  "images.unsplash.com",
  "hare-media-cdn.tripadvisor.com",
  "media-cdn.tripadvisor.com",
  "media.tacdn.com",
]);

function canOptimize(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return OPTIMIZED_HOSTS.has(host) || host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/** Decorative photography; trip surfaces may opt into atlas artwork if absent or failed. */
export function TripCoverImage({
  src,
  className,
  journeyFallback = false,
  priority = false,
  sizes = "(min-width: 1024px) 42vw, 100vw",
}: {
  src?: string;
  className?: string;
  journeyFallback?: boolean;
  priority?: boolean;
  sizes?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src)
    return journeyFallback ? <JourneyCoverArtwork /> : null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      unoptimized={!canOptimize(src)}
      priority={priority}
      className={className}
      onError={() => setFailedSource(src)}
    />
  );
}
