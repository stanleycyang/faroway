"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

type ResilientImageProps = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  fallbackSrc?: string;
  fallbackAlt?: string;
};

/** A failed cover must not leave a broken image or obscure the story. */
export function ResilientImage({
  src,
  alt,
  fallbackSrc = "/images/journal-cover.svg",
  fallbackAlt,
  ...props
}: ResilientImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <Image
      {...props}
      alt={failedSrc === src && fallbackAlt ? fallbackAlt : alt}
      src={failedSrc === src ? fallbackSrc : src}
      onError={() => setFailedSrc(src)}
    />
  );
}
