"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AdBannerProps {
  html?: string | null;
  enabled?: boolean;
  masterEnabled?: boolean;
  mobileEnabled?: boolean;
  desktopEnabled?: boolean;
  className?: string;
  slotName?: string;
}

export function AdBanner({
  html,
  enabled = true,
  masterEnabled = true,
  mobileEnabled = true,
  desktopEnabled = true,
  className,
  slotName = "Sponsored Advertisement",
}: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // If ads are disabled globally or for this slot, return null
  if (!masterEnabled || !enabled || !html || !html.trim()) {
    return null;
  }

  // Device-specific CSS classes
  const deviceClasses = cn(
    !mobileEnabled && "hidden sm:block",
    !desktopEnabled && "block sm:hidden"
  );

  if (!mobileEnabled && !desktopEnabled) {
    return null;
  }

  useEffect(() => {
    if (!containerRef.current || !html) return;

    // Safely insert HTML and evaluate embedded <script> tags
    const container = containerRef.current;
    container.innerHTML = html;

    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return (
    <div
      className={cn(
        "my-4 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-2 text-center transition-all",
        deviceClasses,
        className
      )}
    >
      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {slotName}
      </div>
      <div
        ref={containerRef}
        className="flex min-h-[50px] items-center justify-center overflow-x-auto text-xs"
      />
    </div>
  );
}
