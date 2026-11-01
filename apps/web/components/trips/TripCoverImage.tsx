"use client";

import { useState } from "react";
import Image from "next/image";
import { JourneyCoverArtwork } from "./JourneyCoverArtwork";

/** Decorative photography; trip surfaces may opt into atlas artwork if absent or failed. */
export function TripCoverImage({
  src,
  className,
  journeyFallback = false,
}: {
  src?: string;
  className?: string;
  journeyFallback?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src)
    return journeyFallback ? <JourneyCoverArtwork /> : null;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="100vw"
      unoptimized
      priority
      className={className}
      onError={() => setFailedSource(src)}
    />
  );
}
