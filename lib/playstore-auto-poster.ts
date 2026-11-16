import { getCategories, createApplication, getApplicationBySlug, getDbClient, invalidateDbCache } from "@/lib/db";
import { AppCategory, Application } from "@/lib/types";

// Dynamic import for google-play-scraper
async function getGPlay() {
  const mod = await import("google-play-scraper");
  return (mod as any).default || mod;
}

function generateCleanSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

function mapGenreToCategory(
  genre: string | undefined,
  genreId: string | undefined,
  categories: AppCategory[]
): string {
  const g = (genre || "").toLowerCase();
  const gid = (genreId || "").toLowerCase();

  if (gid.startsWith("game") || g.includes("game") || g.includes("arcade") || g.includes("action") || g.includes("rpg")) {
    const gameCat = categories.find((c) => c.slug === "games");
    if (gameCat) return gameCat.id;
  }

  if (g.includes("music") || g.includes("audio") || gid.includes("music")) {
    const musicCat = categories.find((c) => c.slug === "music-audio");
    if (musicCat) return musicCat.id;
  }

  if (g.includes("video") || g.includes("player") || gid.includes("video")) {
    const videoCat = categories.find((c) => c.slug === "media-video");
    if (videoCat) return videoCat.id;
  }

  if (g.includes("photo") || g.includes("camera") || gid.includes("photography")) {
    const photoCat = categories.find((c) => c.slug === "photography");
    if (photoCat) return photoCat.id;
  }

  if (g.includes("social") || gid.includes("social")) {
    const socialCat = categories.find((c) => c.slug === "social");
    if (socialCat) return socialCat.id;
  }

  if (g.includes("communication") || gid.includes("communication")) {
    const commCat = categories.find((c) => c.slug === "communication");
    if (commCat) return commCat.id;
  }

  if (g.includes("productivity") || g.includes("business") || gid.includes("productivity")) {
    const prodCat = categories.find((c) => c.slug === "productivity");
    if (prodCat) return prodCat.id;
  }

  const toolsCat = categories.find((c) => c.slug === "tools");
  if (toolsCat) return toolsCat.id;

  return categories[0]?.id || "";
}

function generateModFeatures(title: string, genre: string = ""): string[] {
  const t = title.toLowerCase();
  const g = genre.toLowerCase();

  if (g.includes("game") || t.includes("game") || t.includes("craft") || t.includes("surfer") || t.includes("gta")) {
    return [
      "Unlimited Money & Gems",
      "All Characters & Skins Unlocked",
      "God Mode / Infinite Energy",
      "Ad-Free High Speed Play",
      "Anti-Ban Verified Build",
    ];
  }

  if (g.includes("music") || t.includes("spotify") || t.includes("music") || t.includes("sound")) {
    return [
      "Premium Unlocked (No Subscription)",
      "Ad-Free Continuous Audio",
      "Unlimited Skips Enabled",
      "Extreme Audio Quality (320kbps)",
      "Canvas & Storyline Active",
    ];
  }

  if (g.includes("video") || t.includes("capcut") || t.includes("inshot") || t.includes("video") || t.includes("kinemaster")) {
    return [
      "Pro / VIP Features Unlocked",
      "No Watermark on Export",
      "Ultra HD / 4K 60FPS Support",
      "All Premium Transitions & Filters",
      "Ad-Free Editing Experience",
    ];
  }

  if (g.includes("photo") || t.includes("photo") || t.includes("lightroom") || t.includes("picsart")) {
    return [
      "Gold / Premium Unlocked",
      "All Presets & Filters Accessible",
      "No Watermark High-Res Save",
      "AI Retouching Tools Activated",
      "Ad-Free Creative Workflow",
    ];
  }

  if (g.includes("social") || g.includes("communication") || t.includes("whatsapp") || t.includes("insta")) {
    return [
      "Privacy Shield (Hide Online / Blue Ticks)",
      "Anti-Delete Messages & Statuses",
      "High Resolution Media Uploads",
      "Custom Themes & Fonts Unlocked",
      "Anti-Ban Protection System",
    ];
  }

  return [
    "Premium VIP Features Unlocked",
    "Completely Ad-Free Clean UI",
    "Safe & Verified Malware-Free APK",
    "Optimized Battery & Performance",
    "No In-App Purchases Required",
  ];
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Scrapes Google Play Store by URL or Package ID, creates/updates the App in Supabase,
 * and prepares it for instant Telegram Channel broadcasting.
 */
export async function scrapeAndCreateFromPlayStore(
  inputUrlOrId: string
): Promise<{ success: boolean; app?: Application; error?: string }> {
  try {
    let appId = "";
    const match = inputUrlOrId.match(/id=([a-zA-Z0-9._]+)/i);
    if (match) {
      appId = match[1];
    } else if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(inputUrlOrId.trim())) {
      appId = inputUrlOrId.trim();
    } else {
      return { success: false, error: "Invalid Google Play Store link or package ID" };
    }

    const gplay = await getGPlay();
    let detail: any = null;
    try {
      detail = await gplay.app({ appId });
    } catch (err: any) {
      return { success: false, error: `Google Play lookup failed: ${err.message}` };
    }

    if (!detail) {
      return { success: false, error: "Application not found on Google Play Store" };
    }

    const categories = await getCategories();
    const rawTitle = detail.title || appId;
    const cleanTitleBase = rawTitle.split(":")[0].split("-")[0].trim();
    const finalName = `${cleanTitleBase} MOD APK (Premium Unlocked)`;
    const slug = generateCleanSlug(`${cleanTitleBase} mod`);
    const categoryId = mapGenreToCategory(detail.genre, detail.genreId, categories);
    const modFeatures = generateModFeatures(cleanTitleBase, detail.genre || "");

    const versionName =
      detail.version && detail.version !== "VARY"
        ? `v${detail.version}`
        : "vLatest";

    const fileSize =
      detail.size && detail.size !== "VARY"
        ? detail.size
        : "55 MB";

    const androidReq =
      detail.androidVersionText && detail.androidVersionText !== "VARY"
        ? `Android ${detail.androidVersionText}+`
        : "Android 7.0+";

    const screenshots: string[] = Array.isArray(detail.screenshots)
      ? detail.screenshots.slice(0, 6)
      : [];

    const shortDescription = decodeHtmlEntities(
      (detail.summary || `${cleanTitleBase} modded application for Android with unlocked features.`)
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, 160)
    );

    // Check if app already exists in database
    const supabase = getDbClient();
    let existingApp = await getApplicationBySlug(slug);

    if (existingApp && supabase) {
      // Update existing app with fresh Play Store metadata
      await supabase
        .from("applications")
        .update({
          name: finalName,
          package_name: detail.appId,
          icon_url: detail.icon || existingApp.icon_url,
          banner_url: detail.headerImage || existingApp.banner_url,
          mod_features: modFeatures,
          short_description: shortDescription,
        })
        .eq("id", existingApp.id);

      invalidateDbCache();
      const updated = await getApplicationBySlug(slug);
      return { success: true, app: updated || existingApp };
    }

    // Create fresh application entry
    const newAppData = {
      name: finalName,
      slug,
      package_name: detail.appId,
      developer: "Aadith C V",
      category_id: categoryId,
      platform: "android" as const,
      short_description: shortDescription,
      description: `### Overview\n**${finalName}** mod release with premium features unlocked.\n\n${shortDescription}\n\n### MOD Features:\n${modFeatures.map((f) => `- ${f}`).join("\n")}`,
      icon_url: detail.icon || "/icons/default-app.png",
      banner_url: detail.headerImage || (screenshots.length > 0 ? screenshots[0] : null),
      android_requirement: androidReq,
      is_featured: false,
      is_trending: false,
      status: "draft" as const,
      screenshots,
      mod_features: modFeatures,
      version: {
        version_name: versionName,
        version_code: 1,
        file_size: fileSize,
        architecture: "arm64-v8a",
        android_requirement: androidReq,
        sha256: null,
        release_notes: modFeatures.join("\n"),
        is_latest: true,
        status: "draft" as const,
        download_sources: [
          {
            download_type: "external" as const,
            hosting_provider: "custom" as const,
            download_url: `https://play.google.com/store/apps/details?id=${detail.appId}`,
            mirror_name: "Google Play Store Link",
            is_primary: true,
          },
        ],
      },
    };

    const created = await createApplication(newAppData as any);
    invalidateDbCache();
    return { success: true, app: created };
  } catch (err: any) {
    console.error("scrapeAndCreateFromPlayStore error:", err);
    return { success: false, error: err.message || "Failed to scrape Google Play Store" };
  }
}
