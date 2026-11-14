"use client";

import { useState } from "react";

interface AppIconProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLetter?: string;
}

export function AppIcon({
  src,
  alt,
  className = "absolute inset-0 h-full w-full object-cover",
  fallbackLetter,
}: AppIconProps) {
  const [errorLevel, setErrorLevel] = useState<number>(0);

  // If no source is provided at all
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary text-foreground font-bold">
        {fallbackLetter || alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  // Level 0: Direct URL with no-referrer
  // Level 1: Proxy URL through /api/image-proxy
  // Level 2: Fallback to SVG / letter
  const currentSrc =
    errorLevel === 0
      ? src
      : errorLevel === 1
      ? `/api/image-proxy?url=${encodeURIComponent(src)}`
      : "/icon.svg";

  if (errorLevel >= 2) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-900 border border-neutral-800 text-white font-black text-sm select-none">
        {fallbackLetter || alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setErrorLevel((prev) => prev + 1)}
    />
  );
}
