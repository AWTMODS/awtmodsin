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
  const [error, setError] = useState(false);

  if (!src || error) {
    return <span>{fallbackLetter || alt.slice(0, 1)}</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}
