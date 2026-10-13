import React from "react";
import type { ImageProps } from "next/image";

export default function Image({
  src,
  alt,
  fill,
  priority,
  unoptimized,
  style,
  ...props
}: ImageProps) {
  // The fixture deliberately replaces Next's image optimizer with native DOM.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={typeof src === "string" ? src : ""}
      alt={alt}
      style={{
        ...(fill
          ? ({
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
            } as const)
          : {}),
        ...style,
      }}
      loading={priority ? "eager" : "lazy"}
      data-unoptimized={unoptimized || undefined}
    />
  );
}
