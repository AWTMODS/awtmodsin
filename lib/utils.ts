import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | undefined | null): string {
  if (num === null || num === undefined || isNaN(num)) {
    return "0";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M+";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K+";
  }
  return num.toString();
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Strips any trailing .html extension to get the raw clean slug
 */
export function cleanAppSlug(slug: string | undefined | null): string {
  if (!slug) return "";
  return slug.replace(/\.html$/i, "");
}

/**
 * Returns the canonical public URL path for an application detail page.
 * Format: /apps/{slug}.html
 */
export function getAppUrl(slug: string | undefined | null): string {
  const clean = cleanAppSlug(slug);
  return clean ? `/apps/${clean}.html` : "/apps";
}

/**
 * Returns the canonical public URL path for an application download page.
 * Format: /download/{slug}.html
 */
export function getDownloadUrl(
  slug: string | undefined | null,
  options?: { mirrorId?: string; versionId?: string }
): string {
  const clean = cleanAppSlug(slug);
  const base = clean ? `/download/${clean}.html` : "/apps";
  const params = new URLSearchParams();
  if (options?.mirrorId) params.set("mirror", options.mirrorId);
  if (options?.versionId) params.set("version", options.versionId);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
