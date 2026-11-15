import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDbClient, getApplicationById, invalidateDbCache } from "@/lib/db";
import { Application, HostingProvider } from "@/lib/types";

// Classify hosting provider based on URL domain
function detectHostingProvider(url: string): { provider: HostingProvider; mirrorName: string } {
  const lower = url.toLowerCase();
  if (lower.includes("devuploads.com") || lower.includes("devupload.com") || lower.includes("hyp.sh") || lower.includes("dlinks.me")) {
    return { provider: "custom", mirrorName: "DevUploads Fast Mirror" };
  }
  if (lower.includes("t.me") || lower.includes("telegram.me")) {
    return { provider: "telegram", mirrorName: "Telegram Fast Channel" };
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

// Parse raw plain text containing app name, version, code, and 1 or more URLs
function parseQuickReleaseText(rawText: string) {
  const text = rawText.trim();
  if (!text) return null;

  // 1. Extract ALL HTTP/HTTPS URLs
  const urlRegex = /(https?:\/\/[^\s\),]+)/gi;
  const urls = text.match(urlRegex) || [];

  const downloadSources = urls.map((url, idx) => {
    const { provider, mirrorName } = detectHostingProvider(url);
    return {
      download_type: "external" as const,
      hosting_provider: provider,
      download_url: url.trim(),
      mirror_name: mirrorName,
      is_primary: idx === 0,
      is_active: true,
    };
  });

  // Remove URLs from text for further entity extraction
  let remainder = text.replace(urlRegex, " ").replace(/\s+/g, " ");

  // 2. Extract Version Name (e.g. v.1.0.1, v1.0.1, 1.0.1, v12.45.0, 8.9.22)
  let versionName = "v1.0.0";
  const versionRegex = /\b(?:v|ver|version)?\.?\s*([0-9]+(?:\.[0-9]+)+[a-z0-9_\-\.]*)\b/i;
  const versionMatch = remainder.match(versionRegex);
  if (versionMatch) {
    const rawVer = versionMatch[1];
    versionName = rawVer.startsWith("v") ? rawVer : `v${rawVer}`;
    // Remove version from remainder
    remainder = remainder.replace(versionMatch[0], " ").replace(/\s+/g, " ");
  }

  // 3. Extract Version Code (e.g. 5267189, code 1234, or numeric sequence)
  let versionCode = 1;
  const codeRegex = /\b(?:code:?\s*)?([0-9]{3,9})\b/i;
  const codeMatch = remainder.match(codeRegex);
  if (codeMatch) {
    versionCode = parseInt(codeMatch[1], 10) || 1;
    remainder = remainder.replace(codeMatch[0], " ").replace(/\s+/g, " ");
  }

  // 4. Extract File Size if present (e.g. 68 MB, 1.2 GB, 55MB)
  let fileSize = "50 MB";
  const sizeRegex = /\b([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))\b/i;
  const sizeMatch = remainder.match(sizeRegex);
  if (sizeMatch) {
    fileSize = sizeMatch[1].toUpperCase();
    remainder = remainder.replace(sizeMatch[0], " ").replace(/\s+/g, " ");
  }

  // 5. Extract Changelog / Release notes if labeled
  let releaseNotes = "Version update with performance optimizations and unlocked features.";
  const changelogRegex = /\b(?:changelog|notes|whats new|features):\s*(.+)$/i;
  const changelogMatch = remainder.match(changelogRegex);
  if (changelogMatch) {
    releaseNotes = changelogMatch[1].trim();
    remainder = remainder.replace(changelogMatch[0], " ").replace(/\s+/g, " ");
  }

  // 6. Remaining words represent the target App query
  const cleanAppQuery = remainder
    .replace(/\b(apk|mod|download|link|update|new|latest|version|code)\b/gi, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    rawText,
    appQuery: cleanAppQuery || remainder.trim(),
    versionName,
    versionCode,
    fileSize,
    downloadSources,
    releaseNotes,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = "parse", text, payload } = body;
    const supabase = getDbClient();

    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    // ==========================================
    // ACTION 1: PARSE AND PREVIEW
    // ==========================================
    if (action === "parse") {
      if (!text || typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "Please enter update text to parse" }, { status: 400 });
      }

      const parsed = parseQuickReleaseText(text);
      if (!parsed) {
        return NextResponse.json({ error: "Failed to parse text" }, { status: 400 });
      }

      // Search DB for matching applications
      const q = parsed.appQuery.toLowerCase();
      let matchedApp: Application | null = null;
      let candidates: Application[] = [];

      if (q) {
        const { data: apps } = await supabase
          .from("applications")
          .select(`
            id, name, slug, icon_url, package_name, status,
            versions:application_versions(id, version_name, version_code, is_latest)
          `)
          .or(`name.ilike.%${q}%,slug.ilike.%${q}%,package_name.ilike.%${q}%`)
          .limit(5);

        if (apps && apps.length > 0) {
          matchedApp = apps[0] as any;
          candidates = apps as any;
        }
      }

      // If no match found by broad query, search by first keyword
      if (!matchedApp && q.split(" ")[0]) {
        const firstWord = q.split(" ")[0];
        const { data: fallbackApps } = await supabase
          .from("applications")
          .select(`
            id, name, slug, icon_url, package_name, status,
            versions:application_versions(id, version_name, version_code, is_latest)
          `)
          .ilike("name", `%${firstWord}%`)
          .limit(5);

        if (fallbackApps && fallbackApps.length > 0) {
          matchedApp = fallbackApps[0] as any;
          candidates = fallbackApps as any;
        }
      }

      return NextResponse.json({
        success: true,
        parsed,
        matchedApp,
        candidates,
      });
    }

    // ==========================================
    // ACTION 2: DEPLOY THE QUICK UPDATE
    // ==========================================
    if (action === "deploy") {
      const { appId, versionName, versionCode, fileSize, releaseNotes, downloadSources } = payload || {};

      if (!appId) {
        return NextResponse.json({ error: "Target application ID is required" }, { status: 400 });
      }
      if (!versionName) {
        return NextResponse.json({ error: "Version name is required" }, { status: 400 });
      }
      if (!Array.isArray(downloadSources) || downloadSources.length === 0) {
        return NextResponse.json({ error: "At least one download mirror link is required" }, { status: 400 });
      }

      // Prepare save payload for admin_save_application RPC
      const savePayload = {
        id: appId,
        version: {
          version_name: versionName,
          version_code: parseInt(versionCode, 10) || 1,
          file_size: fileSize || "50 MB",
          architecture: "arm64-v8a",
          android_requirement: "Android 7.0+",
          sha256: null,
          release_notes: releaseNotes || "Version update release.",
          is_latest: true,
          status: "published",
          download_sources: downloadSources.map((src: any, index: number) => ({
            download_type: "external",
            hosting_provider: src.hosting_provider || "mediafire",
            download_url: src.download_url,
            mirror_name: src.mirror_name || "Download Mirror",
            is_primary: index === 0 ? true : !!src.is_primary,
            is_active: src.is_active !== false,
          })),
        },
      };

      const { data: rpcRes, error: rpcErr } = await supabase.rpc("admin_save_application", {
        p_app: savePayload,
      });

      if (rpcErr || !rpcRes?.success) {
        console.error("Quick release RPC error:", rpcErr);
        return NextResponse.json(
          { error: rpcErr?.message || "Failed to persist version update" },
          { status: 500 }
        );
      }

      // Fetch the updated full app with newly attached version and mirrors
      const updatedApp = await getApplicationById(appId);

      // Invalidate memory cache and revalidate paths
      invalidateDbCache();
      try {
        revalidatePath("/");
        revalidatePath("/apps");
        revalidatePath("/admin/apps");
        revalidatePath("/admin/versions");
        if (updatedApp?.slug) {
          revalidatePath(`/apps/${updatedApp.slug}`);
          revalidatePath(`/download/${updatedApp.slug}`);
        }
      } catch (revErr) {
        console.warn("Revalidation warning:", revErr);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully released ${versionName} with ${downloadSources.length} mirrors for ${updatedApp?.name || "Application"}!`,
        app: updatedApp,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Quick release exception:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process quick release" },
      { status: 500 }
    );
  }
}
