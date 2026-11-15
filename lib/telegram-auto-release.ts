import { getDbClient, getApplicationById, invalidateDbCache } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { HostingProvider, Application } from "@/lib/types";

// Classify hosting provider based on URL domain
export function detectHostingProvider(url: string): { provider: HostingProvider; mirrorName: string } {
  const lower = url.toLowerCase();
  if (lower.includes("exastash.com")) {
    return { provider: "custom", mirrorName: "ExaStash Cloud CDN" };
  }
  if (
    lower.includes("devuploads.com") ||
    lower.includes("devupload.com") ||
    lower.includes("hyp.sh") ||
    lower.includes("dlinks.me")
  ) {
    return { provider: "custom", mirrorName: "DevUploads Fast Mirror" };
  }
  if (lower.includes("t.me") || lower.includes("telegram.me")) {
    return { provider: "telegram", mirrorName: "Telegram VIP Fast Channel" };
  }
  if (lower.includes("mediafire.com")) {
    return { provider: "mediafire", mirrorName: "MediaFire Fast CDN" };
  }
  if (lower.includes("mega.nz") || lower.includes("mega.io")) {
    return { provider: "mega", mirrorName: "Mega Cloud CDN" };
  }
  if (lower.includes("drive.google.com")) {
    return { provider: "google_drive", mirrorName: "Google Drive High Speed" };
  }
  if (lower.includes("dropbox.com")) {
    return { provider: "dropbox", mirrorName: "Dropbox Cloud Mirror" };
  }
  return { provider: "custom", mirrorName: "Direct High-Speed Mirror" };
}

export function cleanSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ParsedApkInfo {
  appQuery: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  externalUrls: { url: string; provider: HostingProvider; mirrorName: string }[];
  releaseNotes: string;
}

// Parses raw APK filename, file size, and text/caption from Telegram message
export function parseApkReleaseInfo(
  fileName: string,
  captionText: string = "",
  fileSizeBytes: number = 0
): ParsedApkInfo {
  // Strip .apk to prevent false regex matches
  const combined = `${fileName} ${captionText}`.replace(/\.apk/gi, " ").trim();

  // 1. Extract URLs
  const urlRegex = /(https?:\/\/[^\s\),]+)/gi;
  const rawUrls = combined.match(urlRegex) || [];
  const uniqueUrls = Array.from(new Set(rawUrls));

  const externalUrls = uniqueUrls
    .filter((u) => !u.includes("api.telegram.org"))
    .map((u) => {
      const { provider, mirrorName } = detectHostingProvider(u);
      return { url: u.trim(), provider, mirrorName };
    });

  // 2. File Size
  let fileSize = "50 MB";
  if (fileSizeBytes > 0) {
    const mb = fileSizeBytes / (1024 * 1024);
    fileSize = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  } else {
    const sizeRegex = /\b([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))\b/i;
    const sizeMatch = combined.match(sizeRegex);
    if (sizeMatch) fileSize = sizeMatch[1].toUpperCase();
  }

  // 3. Version Name (e.g. V17, v17.0, v1.2.3, 17.5.1, V-17)
  let versionName = "v1.0.0";
  const vMatch = combined.match(/\b(?:v|ver|version)?\.?\s*([0-9]+(?:\.[0-9]+)*[a-z0-9_\-]*)\b/i);
  if (vMatch) {
    const v = vMatch[1].replace(/[-_]+$/, "");
    versionName = v.toLowerCase().startsWith("v") ? v : `v${v}`;
  }

  // 4. Version Code
  // Check for explicit "code: 170" or "vc: 170" or "code 17"
  let versionCode = 1;
  const codeRegex = /\b(?:code|vc|versioncode):?\s*([0-9]{1,9})\b/i;
  const codeMatch = combined.match(codeRegex);
  if (codeMatch) {
    versionCode = parseInt(codeMatch[1], 10);
  } else {
    // If not explicit, extract numeric digits from versionName (e.g. v17 -> 17, v9.0.22 -> 9022)
    const digitsOnly = versionName.replace(/[^0-9]/g, "");
    if (digitsOnly) {
      versionCode = parseInt(digitsOnly, 10);
    }
  }

  // 5. Changelog / Release Notes
  let releaseNotes = "Version update release with performance optimizations and unlocked features.";
  const changelogRegex = /\b(?:changelog|notes|whats new|features):\s*(.+)$/i;
  const changelogMatch = combined.match(changelogRegex);
  if (changelogMatch) {
    releaseNotes = changelogMatch[1].trim();
  }

  // 6. Target App Query from Filename
  let appQuery = fileName
    .replace(/\.apk$/i, "")
    .replace(/\b(?:awt|awtmods|mod|premium|pro|unlocked|plus|ultra|lite|v[0-9]+(?:\.[0-9]+)*|[0-9]+(?:\.[0-9]+)+)\b/gi, "")
    .replace(/[-_.]+/g, " ")
    .trim();

  if (!appQuery) {
    appQuery = captionText
      .replace(/\.apk$/i, "")
      .replace(/\b(?:uploaded to|devuploads|file name|file size|file link|easy copy|download)\b/gi, "")
      .replace(/[-_.]+/g, " ")
      .trim();
  }

  return {
    appQuery,
    versionName,
    versionCode,
    fileSize,
    externalUrls,
    releaseNotes,
  };
}

// Smart App Matcher in Supabase
export async function matchApplicationByApk(
  fileName: string,
  captionText: string = ""
): Promise<{ matchedApp: Application | null; candidates: Application[] }> {
  const supabase = getDbClient();
  if (!supabase) return { matchedApp: null, candidates: [] };

  const baseName = fileName
    .replace(/\.apk$/i, "")
    .replace(/[-_.]v[0-9]+.*$/i, "")
    .replace(/[-_.](mod|pro|premium|unlocked|plus|mini).*$/i, "");

  const slugFromBase = cleanSlug(baseName);

  // 1. Exact slug match (e.g. "awt-instagram" == "awt-instagram")
  const { data: exactSlug } = await supabase
    .from("applications")
    .select(`
      id, name, slug, icon_url, package_name, status,
      versions:application_versions(id, version_name, version_code, is_latest)
    `)
    .eq("slug", slugFromBase)
    .limit(1);

  if (exactSlug && exactSlug.length > 0) {
    return { matchedApp: exactSlug[0] as any, candidates: [exactSlug[0] as any] };
  }

  // 2. Exact slug match without "awt-" prefix
  const strippedAwt = slugFromBase.replace(/^awt-/, "");
  const { data: noAwtSlug } = await supabase
    .from("applications")
    .select(`
      id, name, slug, icon_url, package_name, status,
      versions:application_versions(id, version_name, version_code, is_latest)
    `)
    .eq("slug", strippedAwt)
    .limit(1);

  if (noAwtSlug && noAwtSlug.length > 0) {
    return { matchedApp: noAwtSlug[0] as any, candidates: [noAwtSlug[0] as any] };
  }

  // 3. Exact slug match with "awt-" prefix prepended
  const withAwt = `awt-${slugFromBase}`;
  const { data: withAwtSlug } = await supabase
    .from("applications")
    .select(`
      id, name, slug, icon_url, package_name, status,
      versions:application_versions(id, version_name, version_code, is_latest)
    `)
    .eq("slug", withAwt)
    .limit(1);

  if (withAwtSlug && withAwtSlug.length > 0) {
    return { matchedApp: withAwtSlug[0] as any, candidates: [withAwtSlug[0] as any] };
  }

  // 4. Search query on name & slug
  const query = baseName
    .replace(/awt/gi, "")
    .replace(/[-_.]+/g, " ")
    .trim();

  const { data: searchCandidates } = await supabase
    .from("applications")
    .select(`
      id, name, slug, icon_url, package_name, status,
      versions:application_versions(id, version_name, version_code, is_latest)
    `)
    .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
    .limit(4);

  if (searchCandidates && searchCandidates.length > 0) {
    // If only 1 result or top result exact name match
    if (searchCandidates.length === 1) {
      return { matchedApp: searchCandidates[0] as any, candidates: searchCandidates as any };
    }
    const exactName = searchCandidates.find(
      (c: any) => c.name.toLowerCase() === baseName.toLowerCase() || c.name.toLowerCase() === query.toLowerCase()
    );
    if (exactName) {
      return { matchedApp: exactName as any, candidates: searchCandidates as any };
    }
    return { matchedApp: null, candidates: searchCandidates as any };
  }

  return { matchedApp: null, candidates: [] };
}

// Executes the Automated Release into Supabase & revalidates website caches
export async function executeAutoApkRelease(params: {
  appId: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  releaseNotes?: string;
  externalUrls?: { url: string; provider: HostingProvider; mirrorName: string }[];
  telegramMessageLink?: string;
}): Promise<{ success: boolean; app?: Application; error?: string }> {
  const supabase = getDbClient();
  if (!supabase) return { success: false, error: "Database client unavailable" };

  // Fetch current app to inspect latest version code
  const currentApp = await getApplicationById(params.appId);
  if (!currentApp) return { success: false, error: "Application not found" };

  const currentLatestVersion =
    currentApp.latest_version ||
    currentApp.versions?.find((v) => v.is_latest) ||
    currentApp.versions?.[0];

  const prevCode = currentLatestVersion?.version_code || 1;
  let finalVersionCode = params.versionCode;

  // Ensure version_code is strictly greater than previous version
  if (!finalVersionCode || finalVersionCode <= prevCode) {
    finalVersionCode = prevCode + 1;
  }

  // Assemble download sources
  const downloadSources: any[] = [];

  // 1. External Mirrors (e.g. DevUploads)
  if (params.externalUrls && params.externalUrls.length > 0) {
    params.externalUrls.forEach((src, idx) => {
      downloadSources.push({
        download_type: "external",
        hosting_provider: src.provider,
        download_url: src.url,
        mirror_name: src.mirrorName,
        is_primary: idx === 0,
        is_active: true,
      });
    });
  }

  // 2. Telegram VIP Direct File Source
  if (params.telegramMessageLink) {
    downloadSources.push({
      download_type: "external",
      hosting_provider: "telegram",
      download_url: params.telegramMessageLink,
      mirror_name: "Telegram VIP Fast Channel",
      is_primary: downloadSources.length === 0,
      is_active: true,
    });
  }

  // Fallback if no mirrors found
  if (downloadSources.length === 0) {
    downloadSources.push({
      download_type: "external",
      hosting_provider: "telegram",
      download_url: "https://t.me/awtmods",
      mirror_name: "Telegram Fast Channel",
      is_primary: true,
      is_active: true,
    });
  }

  const savePayload = {
    id: params.appId,
    version: {
      version_name: params.versionName,
      version_code: finalVersionCode,
      file_size: params.fileSize || "50 MB",
      architecture: "arm64-v8a",
      android_requirement: "Android 7.0+",
      sha256: null,
      release_notes: params.releaseNotes || "Performance optimizations and unlocked features.",
      is_latest: true,
      status: "published",
      download_sources: downloadSources,
    },
  };

  const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_save_application", {
    p_app: savePayload,
  });

  if (rpcErr || !rpcRes?.success) {
    console.error("Auto-release RPC error:", rpcErr);
    return { success: false, error: rpcErr?.message || "Failed to persist version update" };
  }

  // Invalidate memory caches
  invalidateDbCache();

  // Revalidate website static/ISR paths
  try {
    revalidatePath("/");
    revalidatePath("/apps");
    revalidatePath("/admin/apps");
    revalidatePath("/admin/versions");
    if (currentApp.slug) {
      revalidatePath(`/apps/${currentApp.slug}`);
      revalidatePath(`/download/${currentApp.slug}`);
    }
  } catch (revErr) {
    console.warn("Auto-release revalidate warning:", revErr);
  }

  const updatedApp = await getApplicationById(params.appId);
  return { success: true, app: updatedApp || undefined };
}
