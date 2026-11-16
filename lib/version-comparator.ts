/**
 * Robust version comparator for Android application versions.
 * Handles strings like "v31.1.6", "28.0.8", "v1.0.0.12", "vLatest", "VARY"
 */

export function cleanVersionString(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .trim()
    .replace(/^v/i, "")
    .replace(/[^0-9.]/g, "")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Returns:
 *  1 if v1 > v2 (v1 is newer)
 * -1 if v1 < v2 (v2 is newer)
 *  0 if v1 === v2
 */
export function compareVersions(v1: string | null | undefined, v2: string | null | undefined): number {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  // Ignore non-comparable strings
  const upper1 = v1.toUpperCase();
  const upper2 = v2.toUpperCase();
  if (upper1.includes("VARY") || upper2.includes("VARY")) return 0;
  if (upper1.includes("LATEST") || upper2.includes("LATEST")) return 0;

  const clean1 = cleanVersionString(v1);
  const clean2 = cleanVersionString(v2);

  if (!clean1 || !clean2) {
    return v1.localeCompare(v2, undefined, { numeric: true, sensitivity: "base" });
  }

  const parts1 = clean1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean2.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Checks if candidateVersion is newer than currentVersion
 */
export function isNewerVersion(candidateVersion: string, currentVersion: string): boolean {
  return compareVersions(candidateVersion, currentVersion) > 0;
}
