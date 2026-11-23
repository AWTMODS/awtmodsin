import { getDbClient, getApplicationById, getApplicationBySlug, invalidateDbCache } from "@/lib/db";
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
  const combined = `${fileName} ${captionText}`.trim();

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

  // 2. File Size (extract from bytes or text)
  let fileSize = "Varies with device";
  if (fileSizeBytes > 0) {
    const mb = fileSizeBytes / (1024 * 1024);
    fileSize = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  } else {
    const sizeRegex = /\b([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))\b/i;
    const sizeMatch = combined.match(sizeRegex);
    if (sizeMatch) fileSize = sizeMatch[1].toUpperCase();
  }

  // 3. Strip file size patterns (e.g. 138.56 MB) to prevent false version matches!
  const textWithoutSize = combined
    .replace(/\b[0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB|bytes)\b/gi, " ")
    .replace(/\.apk/gi, " ");

  // 4. Extract Version Name from filename first (priority #1)
  let versionName = "v1.0.0";
  let hasFoundVersion = false;

  // Pattern A: Filename has _v1, -v1.0, _v17, .v2.5
  const fnVMatch = fileName.match(/[-_.]v([0-9]+(?:\.[0-9]+)*)/i);
  if (fnVMatch) {
    versionName = `v${fnVMatch[1]}`;
    hasFoundVersion = true;
  }

  // Pattern B: Filename has numeric version with at least one dot (e.g. _8.9.96, -2.5.1)
  if (!hasFoundVersion) {
    const fnDotMatch = fileName.match(/[-_.]([0-9]+(?:\.[0-9]+)+)/i);
    if (fnDotMatch) {
      versionName = `v${fnDotMatch[1]}`;
      hasFoundVersion = true;
    }
  }

  // Pattern C: Explicit label in caption: "version: 1.2" or "v1.2"
  if (!hasFoundVersion) {
    const capMatch = textWithoutSize.match(/\b(?:version|ver|v)\s*[:=\-]?\s*([0-9]+(?:\.[0-9]+)*)/i);
    if (capMatch) {
      versionName = `v${capMatch[1]}`;
      hasFoundVersion = true;
    }
  }

  // 5. Extract Version Code
  // Check for explicit "code: 170" or "vc: 170" or "versioncode 170"
  let versionCode = 0;
  const codeRegex = /\b(?:code|vc|versioncode):?\s*([0-9]{1,9})\b/i;
  const codeMatch = textWithoutSize.match(codeRegex);
  if (codeMatch) {
    versionCode = parseInt(codeMatch[1], 10);
  }
  if (!versionCode) {
    const fnCodeMatch = fileName.match(/_([0-9]{3,10})\.apk$/i) || fileName.match(/_v?[0-9.]+_([0-9]+)\.apk$/i);
    if (fnCodeMatch) {
      versionCode = parseInt(fnCodeMatch[1], 10);
    }
  }

  // 6. Changelog / Release Notes
  let releaseNotes = "Version update release with performance optimizations and unlocked features.";
  const changelogRegex = /\b(?:changelog|notes|whats new|features):\s*(.+)$/i;
  const changelogMatch = textWithoutSize.match(changelogRegex);
  if (changelogMatch) {
    releaseNotes = changelogMatch[1].trim();
  }

  // 7. Clean App Query from Filename
  let cleanBaseApp = fileName
    .replace(/\.apk$/i, "")
    .replace(/[-_.]v[0-9]+.*$/i, "")
    .replace(/[-_.][0-9]+(?:\.[0-9]+)+.*$/i, "")
    .replace(/[-_.](mod|pro|premium|unlocked|plus|mini).*$/i, "")
    .replace(/\b(?:awt|awtmods)\b/gi, "")
    .replace(/[-_.]+/g, " ")
    .trim();

  return {
    appQuery: cleanBaseApp || "Application",
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

  // 4. Exact name match
  const { data: exactName } = await supabase
    .from("applications")
    .select(`
      id, name, slug, icon_url, package_name, status,
      versions:application_versions(id, version_name, version_code, is_latest)
    `)
    .ilike("name", baseName)
    .limit(1);

  if (exactName && exactName.length > 0) {
    return { matchedApp: exactName[0] as any, candidates: [exactName[0] as any] };
  }

  // 5. Search query on name & slug
  const query = baseName
    .replace(/awt/gi, "")
    .replace(/[-_.]+/g, " ")
    .trim();

  if (query.length >= 3) {
    const { data: searchCandidates } = await supabase
      .from("applications")
      .select(`
        id, name, slug, icon_url, package_name, status,
        versions:application_versions(id, version_name, version_code, is_latest)
      `)
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
      .limit(4);

    if (searchCandidates && searchCandidates.length > 0) {
      if (searchCandidates.length === 1) {
        return { matchedApp: searchCandidates[0] as any, candidates: searchCandidates as any };
      }
      const exact = searchCandidates.find(
        (c: any) =>
          c.name.toLowerCase() === baseName.toLowerCase() ||
          c.name.toLowerCase() === query.toLowerCase()
      );
      if (exact) {
        return { matchedApp: exact as any, candidates: searchCandidates as any };
      }
      return { matchedApp: null, candidates: searchCandidates as any };
    }
  }

  // 6. Split compound words (e.g. "InstaUltra" -> ["Insta", "Ultra"])
  const splitWords = baseName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !["awt", "mod", "apk", "pro", "app", "ultra", "plus", "mini"].includes(w.toLowerCase())
    );

  for (const word of splitWords) {
    const { data: wordCandidates } = await supabase
      .from("applications")
      .select(`
        id, name, slug, icon_url, package_name, status,
        versions:application_versions(id, version_name, version_code, is_latest)
      `)
      .or(`name.ilike.%${word}%,slug.ilike.%${word}%`)
      .limit(4);

    if (wordCandidates && wordCandidates.length > 0) {
      if (wordCandidates.length === 1) {
        return { matchedApp: wordCandidates[0] as any, candidates: wordCandidates as any };
      }
      return { matchedApp: null, candidates: wordCandidates as any };
    }
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
  fileId?: string;
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

  // Check if a version matching this version code or version name already exists
  const existingVersion = currentApp.versions?.find(
    (v) =>
      (params.versionCode > 0 && v.version_code === params.versionCode) ||
      (params.versionName && v.version_name?.toLowerCase() === params.versionName.toLowerCase())
  );

  if (existingVersion && (params.telegramMessageLink || params.fileId)) {
    const tgUrl = params.telegramMessageLink || "https://t.me/awtmods";
    const { data: existingSources } = await supabase
      .from("download_sources")
      .select("id")
      .eq("version_id", existingVersion.id)
      .eq("hosting_provider", "telegram");

    if (existingSources && existingSources.length > 0) {
      await supabase
        .from("download_sources")
        .update({
          download_url: tgUrl,
          storage_key: params.fileId || null,
          mirror_name: "Telegram VIP Direct File",
          is_active: true,
        })
        .eq("id", existingSources[0].id);
    } else {
      await supabase
        .from("download_sources")
        .insert({
          version_id: existingVersion.id,
          download_type: "external",
          hosting_provider: "telegram",
          download_url: tgUrl,
          storage_key: params.fileId || null,
          mirror_name: "Telegram VIP Direct File",
          is_primary: false,
          is_active: true,
        });
    }

    // Also update version_name if current one looks like raw code (e.g. v2300002 -> v2.3.0)
    if (params.versionName && existingVersion.version_name?.startsWith("v" + existingVersion.version_code)) {
      await supabase
        .from("application_versions")
        .update({ version_name: params.versionName })
        .eq("id", existingVersion.id);
    }

    invalidateDbCache();
    const updatedApp = await getApplicationById(params.appId);
    return { success: true, app: updatedApp || currentApp };
  }

  const prevCode = currentLatestVersion?.version_code || 0;
  let finalVersionCode = params.versionCode;

  // Ensure version_code is strictly valid and increasing
  if (!finalVersionCode || finalVersionCode <= 0) {
    finalVersionCode = prevCode > 0 ? prevCode + 1 : 1;
  } else if (finalVersionCode <= prevCode) {
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
  if (params.telegramMessageLink || params.fileId) {
    downloadSources.push({
      download_type: "external",
      hosting_provider: "telegram",
      download_url: params.telegramMessageLink || "https://t.me/awtmods",
      storage_key: params.fileId || null,
      mirror_name: "Telegram VIP Direct File",
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
      storage_key: null,
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
      file_size: params.fileSize || "Varies with device",
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
    revalidatePath("/", "page");
    revalidatePath("/apps", "page");
    revalidatePath("/admin", "page");
    revalidatePath("/admin/apps", "page");
    revalidatePath("/admin/versions", "page");
    revalidatePath("/apps/[slug]", "page");
    revalidatePath("/download/[slug]", "page");
    if (currentApp.slug) {
      const clean = currentApp.slug.replace(/\.html$/i, "");
      revalidatePath(`/apps/${clean}`, "page");
      revalidatePath(`/apps/${clean}.html`, "page");
      revalidatePath(`/download/${clean}`, "page");
      revalidatePath(`/download/${clean}.html`, "page");
    }
  } catch (revErr) {
    console.warn("Auto-release revalidate warning:", revErr);
  }

  const updatedApp = await getApplicationById(params.appId);
  const latestVer = updatedApp?.latest_version || updatedApp?.versions?.[0];

  // If a Telegram fileId is provided, persist it directly to the version's telegram download_source
  if (params.fileId && latestVer?.id) {
    try {
      await supabase
        .from("download_sources")
        .update({ storage_key: params.fileId })
        .eq("version_id", latestVer.id)
        .eq("hosting_provider", "telegram");
    } catch (keyErr) {
      console.warn("Could not persist storage_key:", keyErr);
    }
  }

  // Clear from Play Store Version Radar pending updates since app was updated to latest version
  try {
    const { getRadarState, saveRadarState } = await import("@/lib/playstore-radar");
    const radar = await getRadarState();
    if (radar.updates && radar.updates[params.appId]) {
      delete radar.updates[params.appId];
      radar.updatesCount = Object.keys(radar.updates).length;
      await saveRadarState(radar);
    }
  } catch {}

  return { success: true, app: updatedApp || undefined };
}

// Automatically creates a new Application in Supabase and publishes version
export async function executeAutoCreateApp(params: {
  rawName: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  externalUrls?: { url: string; provider: HostingProvider; mirrorName: string }[];
  telegramMessageLink?: string;
  fileId?: string;
  releaseNotes?: string;
}): Promise<{ success: boolean; app?: Application; error?: string }> {
  const supabase = getDbClient();
  if (!supabase) return { success: false, error: "Database client unavailable" };

  // Clean the app name (strip version, mod, apk)
  const cleanName = params.rawName
    .replace(/\.apk$/i, "")
    .replace(/[-_.]v[0-9]+.*$/i, "")
    .replace(/[-_.][0-9]+(?:\.[0-9]+)+.*$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  const appDisplayName =
    cleanName
      .split(/\s+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || "New Application";

  const appSlug = cleanSlug(cleanName);

  // Check if app already exists by slug
  const { data: existingApp } = await supabase
    .from("applications")
    .select("id")
    .eq("slug", appSlug)
    .maybeSingle();

  let appId = existingApp?.id;

  if (!appId) {
    // Valid Category: Tools (c4444444-4444-4444-4444-444444444444)
    const categoryId = "c4444444-4444-4444-4444-444444444444";

    const { data: newApp, error: insertErr } = await supabase
      .from("applications")
      .insert({
        name: appDisplayName,
        slug: appSlug,
        package_name: `com.awt.${appSlug.replace(/-/g, ".")}`,
        developer: "Aadith C V",
        category_id: categoryId,
        short_description: `${appDisplayName} Mod APK with unlocked premium features and clean ad-free experience.`,
        description: `Download the latest mod version of ${appDisplayName} with unlocked features.`,
        icon_url: "https://www.awtmods.in/icons/default-app.png",
        status: "published",
        is_featured: false,
        is_trending: false,
        mod_features: [
          "Premium / VIP features Unlocked",
          "Audio and visual ads blocked",
          "Smooth optimised mod version",
          "Clean & verified APK (Safe to Install)",
        ],
      })
      .select()
      .single();

    if (insertErr || !newApp) {
      console.error("Auto create app error:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to create application" };
    }
    appId = newApp.id;
  }

  return executeAutoApkRelease({
    appId,
    versionName: params.versionName,
    versionCode: params.versionCode > 0 ? params.versionCode : 1,
    fileSize: params.fileSize,
    externalUrls: params.externalUrls,
    telegramMessageLink: params.telegramMessageLink,
    fileId: params.fileId,
    releaseNotes: params.releaseNotes,
  });
}

// Clones logo, screenshots, category, and mod features from an existing app
export async function executeCloneApplication(params: {
  sourceAppId: string;
  rawName: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  externalUrls?: { url: string; provider: HostingProvider; mirrorName: string }[];
  telegramMessageLink?: string;
  fileId?: string;
  releaseNotes?: string;
}): Promise<{ success: boolean; app?: Application; error?: string }> {
  const supabase = getDbClient();
  if (!supabase) return { success: false, error: "Database client unavailable" };

  let sourceApp = await getApplicationById(params.sourceAppId);
  if (!sourceApp) {
    sourceApp = await getApplicationBySlug("awt-instagram");
  }
  if (!sourceApp) {
    sourceApp = await getApplicationBySlug("instagram");
  }
  if (!sourceApp) return { success: false, error: "Source app not found to clone from" };

  const cleanName = params.rawName
    .replace(/\.apk$/i, "")
    .replace(/[-_.]v[0-9]+.*$/i, "")
    .replace(/[-_.][0-9]+(?:\.[0-9]+)+.*$/i, "")
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  const appDisplayName =
    cleanName
      .split(/\s+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || "New Application";

  const appSlug = cleanSlug(cleanName);

  // Check if app already exists by slug
  const { data: existingApp } = await supabase
    .from("applications")
    .select("id")
    .eq("slug", appSlug)
    .maybeSingle();

  let appId = existingApp?.id;

  if (!appId) {
    const { data: newApp, error: insertErr } = await supabase
      .from("applications")
      .insert({
        name: appDisplayName,
        slug: appSlug,
        package_name: `com.awt.${appSlug.replace(/-/g, ".")}`,
        developer: sourceApp.developer || "Aadith C V",
        category_id: sourceApp.category_id || "c4444444-4444-4444-4444-444444444444",
        short_description: (sourceApp.short_description || "")
          .replace(new RegExp(sourceApp.name, "gi"), appDisplayName) ||
          `${appDisplayName} Mod APK with unlocked premium features and clean ad-free experience.`,
        description: (sourceApp.description || "")
          .replace(new RegExp(sourceApp.name, "gi"), appDisplayName) ||
          `Download the latest mod version of ${appDisplayName} with unlocked features.`,
        icon_url: sourceApp.icon_url || "https://www.awtmods.in/icons/default-app.png",
        banner_url: sourceApp.banner_url || null,
        status: "published",
        is_featured: false,
        is_trending: false,
        mod_features: Array.isArray(sourceApp.mod_features) && sourceApp.mod_features.length > 0
          ? sourceApp.mod_features
          : [
              "Premium / VIP features Unlocked",
              "Audio and visual ads blocked",
              "Smooth optimised mod version",
              "Clean & verified APK (Safe to Install)",
            ],
      })
      .select()
      .single();

    if (insertErr || !newApp) {
      console.error("Clone app create error:", insertErr);
      return { success: false, error: insertErr?.message || "Failed to create application" };
    }
    appId = newApp.id;
  }

  return executeAutoApkRelease({
    appId,
    versionName: params.versionName,
    versionCode: params.versionCode > 0 ? params.versionCode : 1,
    fileSize: params.fileSize,
    externalUrls: params.externalUrls,
    telegramMessageLink: params.telegramMessageLink,
    fileId: params.fileId,
    releaseNotes: params.releaseNotes,
  });
}

export interface PendingApkRelease {
  rawFileName: string;
  cleanAppName: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  fileId?: string | null;
  telegramMessageLink?: string | null;
  externalUrls?: { url: string; provider: HostingProvider; mirrorName: string }[];
  releaseNotes?: string;
  sourceChatId?: number;
  sourceMessageId?: number;
  createdAt?: number;
}

/**
 * Temporarily persists pending APK metadata in Supabase site_settings so inline keyboard
 * callback queries have access to the exact fileId, DevUploads mirrors, and sizes.
 */
export async function savePendingApkRelease(data: PendingApkRelease): Promise<string> {
  const supabase = getDbClient();
  const shortId = Math.random().toString(36).substring(2, 8);
  if (supabase) {
    await supabase.from("site_settings").upsert({
      setting_key: `tg_pending_${shortId}`,
      setting_value: { ...data, createdAt: Date.now() },
      updated_at: new Date().toISOString(),
    });
  }
  return shortId;
}

/**
 * Retrieves and cleans up pending APK metadata when the admin selects a release action.
 */
export async function getPendingApkRelease(shortId: string): Promise<PendingApkRelease | null> {
  const supabase = getDbClient();
  if (!supabase || !shortId) return null;
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", `tg_pending_${shortId}`)
      .maybeSingle();

    if (data?.setting_value) {
      // Clean up after reading
      await supabase
        .from("site_settings")
        .delete()
        .eq("setting_key", `tg_pending_${shortId}`);
      return data.setting_value as PendingApkRelease;
    }
  } catch (err) {
    console.warn("getPendingApkRelease err:", err);
  }
  return null;
}
