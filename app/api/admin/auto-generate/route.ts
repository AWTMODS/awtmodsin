import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCategories, createApplication } from "@/lib/db";
import { AppCategory } from "@/lib/types";

// Dynamic import for google-play-scraper in Next.js runtime
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

  // Games
  if (gid.startsWith("game") || g.includes("game") || g.includes("arcade") || g.includes("action") || g.includes("rpg")) {
    const gameCat = categories.find((c) => c.slug === "games");
    if (gameCat) return gameCat.id;
  }

  // Music & Audio
  if (g.includes("music") || g.includes("audio") || gid.includes("music")) {
    const musicCat = categories.find((c) => c.slug === "music-audio");
    if (musicCat) return musicCat.id;
  }

  // Media & Video
  if (g.includes("video") || g.includes("player") || gid.includes("video")) {
    const videoCat = categories.find((c) => c.slug === "media-video");
    if (videoCat) return videoCat.id;
  }

  // Photography
  if (g.includes("photo") || g.includes("camera") || gid.includes("photography")) {
    const photoCat = categories.find((c) => c.slug === "photography");
    if (photoCat) return photoCat.id;
  }

  // Social
  if (g.includes("social") || gid.includes("social")) {
    const socialCat = categories.find((c) => c.slug === "social");
    if (socialCat) return socialCat.id;
  }

  // Communication
  if (g.includes("communication") || gid.includes("communication")) {
    const commCat = categories.find((c) => c.slug === "communication");
    if (commCat) return commCat.id;
  }

  // Productivity
  if (g.includes("productivity") || g.includes("business") || gid.includes("productivity")) {
    const prodCat = categories.find((c) => c.slug === "productivity");
    if (prodCat) return prodCat.id;
  }

  // Tools
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

function generateFullDescription(
  name: string,
  rawSummary: string,
  rawDescription: string,
  modFeatures: string[],
  developer: string,
  version: string
): string {
  const cleanSummary = (rawSummary || rawDescription.slice(0, 200) || "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return `### Overview
**${name}** is a premier application developed by **${developer}**, designed to deliver an exceptional mobile experience with rich features, intuitive design, and state-of-the-art performance.

${cleanSummary}

---

### 🌟 MOD Features Unlocked
This exclusive modified release comes fully unlocked with premium perks:
${modFeatures.map((feat) => `- **${feat}**`).join("\n")}

---

### 🚀 Key Highlights & Capabilities
- **Fluid & Responsive:** High framerate performance with ultra-low latency response.
- **Battery & Memory Efficient:** Optimized background execution preserving device resources.
- **Verified Safe Package:** Audited against malware, spyware, and unauthorized tracking.
- **Regular Updates:** Seamless compatibility with latest Android versions.

---

### 📥 How to Download and Install
1. **Download APK:** Click the **Download APK** button above to get the latest installation package.
2. **Enable Unknown Sources:** Go to **Settings > Security > Install Unknown Apps** and allow your browser/file manager.
3. **Install Package:** Open your Downloads folder and tap the APK file to initiate installation.
4. **Launch & Enjoy:** Open **${name}** and immediately access all unlocked features!

---

*Notice: This application is provided for personal testing and educational evaluation. Build version: ${version}.*`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = (body.query || "").trim();
    const platform = body.platform || "android";
    const createImmediately = !!body.createImmediately;
    const initialStatus = body.status === "published" ? "published" : "draft";

    if (!query) {
      return NextResponse.json(
        { error: "App name or search term is required" },
        { status: 400 }
      );
    }

    const categories = await getCategories();
    const gplay = await getGPlay();

    // Check if query is a direct Google Play store URL or Package ID
    let appId = "";
    if (query.includes("play.google.com/store/apps/details")) {
      const match = query.match(/id=([a-zA-Z0-9._]+)/);
      if (match) appId = match[1];
    } else if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(query)) {
      // Looks like a package name directly (e.g. com.spotify.music)
      appId = query;
    }

    let detail: any = null;

    if (appId) {
      try {
        detail = await gplay.app({ appId });
      } catch {
        detail = null;
      }
    }

    // Search Google Play if not found by direct appId
    if (!detail) {
      // Clean query from mod keywords for better Google Play search accuracy
      const cleanTerm =
        query
          .replace(/\b(mod|apk|premium|pro|unlocked|hack|free|plus|latest)\b/gi, "")
          .trim() || query;

      try {
        const results = await gplay.search({ term: cleanTerm, num: 3 });
        if (results && results.length > 0) {
          appId = results[0].appId;
          detail = await gplay.app({ appId });
        }
      } catch (err: any) {
        console.warn("Google Play search attempt failed:", err.message);
      }
    }

    // If still not found, construct a polished template
    if (!detail) {
      const appName = query.replace(/\b(mod|apk)\b/gi, "").trim();
      const formattedTitle = `${appName} MOD APK (Premium Unlocked)`;
      const slug = generateCleanSlug(formattedTitle);
      const categoryId = categories[0]?.id || "";
      const modFeatures = generateModFeatures(appName);

      const generatedApp = {
        name: formattedTitle,
        slug,
        package_name: `com.awtmods.${slug.replace(/-/g, ".")}`,
        developer: "AWTMods Team",
        category_id: categoryId,
        platform,
        short_description: `Download ${formattedTitle} for Android. Enjoy full premium unlocked features and verified safe APK.`,
        description: generateFullDescription(
          formattedTitle,
          `High performance ${appName} package with unlocked capabilities.`,
          "",
          modFeatures,
          "AWTMods Team",
          "v1.0.0"
        ),
        icon_url: "/icons/default-app.png",
        banner_url: null,
        android_requirement: "Android 7.0+",
        is_featured: false,
        is_trending: false,
        status: initialStatus,
        screenshots: [],
        mod_features: modFeatures,
        version: {
          version_name: "v1.0.0",
          version_code: 1,
          file_size: "45 MB",
          architecture: "arm64-v8a",
          android_requirement: "Android 7.0+",
          sha256: null,
          release_notes: "Initial MOD APK release with unlocked features.",
          is_latest: true,
          status: initialStatus,
          download_sources: [
            {
              download_type: "direct",
              hosting_provider: "other",
              download_url: "https://www.mediafire.com",
              mirror_name: "MediaFire Fast CDN",
              is_primary: true,
            },
          ],
        },
      };

      if (createImmediately) {
        const created = await createApplication(generatedApp as any);
        try {
          revalidatePath("/");
          revalidatePath("/apps");
          revalidatePath("/admin/apps");
        } catch {}
        return NextResponse.json({ success: true, app: created, generated: generatedApp });
      }

      return NextResponse.json({ success: true, appData: generatedApp });
    }

    // Detail was found on Google Play!
    // Format Title
    let rawTitle = detail.title || query;
    // Strip trailing marketing junk (e.g. "Spotify: Music and Podcasts" -> "Spotify")
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

    // Take up to 6 screenshots
    const screenshots: string[] = Array.isArray(detail.screenshots)
      ? detail.screenshots.slice(0, 6)
      : [];

    const shortDescription = (detail.summary || `${cleanTitleBase} modded application for Android with unlocked features.`)
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 160);

    const fullDescription = generateFullDescription(
      finalName,
      detail.summary || "",
      detail.description || "",
      modFeatures,
      detail.developer || "Verified Developer",
      versionName
    );

    const generatedApp = {
      name: finalName,
      slug,
      package_name: detail.appId || `com.awtmods.${slug.replace(/-/g, ".")}`,
      developer: detail.developer || "Verified Developer",
      category_id: categoryId,
      platform,
      short_description: shortDescription,
      description: fullDescription,
      icon_url: detail.icon || "/icons/default-app.png",
      banner_url: detail.headerImage || (screenshots.length > 0 ? screenshots[0] : null),
      android_requirement: androidReq,
      is_featured: false,
      is_trending: false,
      status: initialStatus,
      screenshots,
      mod_features: modFeatures,
      version: {
        version_name: versionName,
        version_code: 1,
        file_size: fileSize,
        architecture: "arm64-v8a",
        android_requirement: androidReq,
        sha256: null,
        release_notes: "Initial modified APK release with premium features unlocked.",
        is_latest: true,
        status: initialStatus,
        download_sources: [
          {
            download_type: "direct",
            hosting_provider: "other",
            download_url: "https://www.mediafire.com",
            mirror_name: "MediaFire Fast CDN",
            is_primary: true,
          },
        ],
      },
    };

    if (createImmediately) {
      const created = await createApplication(generatedApp as any);
      try {
        revalidatePath("/");
        revalidatePath("/apps");
        revalidatePath("/admin/apps");
        if (created.slug) {
          revalidatePath(`/apps/${created.slug}`);
        }
      } catch {}
      return NextResponse.json({ success: true, app: created, generated: generatedApp });
    }

    return NextResponse.json({ success: true, appData: generatedApp });
  } catch (err: any) {
    console.error("Auto-generate error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to auto-generate app" },
      { status: 500 }
    );
  }
}
