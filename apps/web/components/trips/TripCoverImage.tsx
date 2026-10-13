"use client";

import { useState } from "react";
import Image from "next/image";

/** Decorative cover photography falls back to the surrounding surface on failure. */
export function TripCoverImage({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === src) return null;
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
