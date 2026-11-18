import { revalidatePath } from "next/cache";
import {
  getCategories,
  createApplication,
  getApplicationBySlug,
  getDbClient,
  invalidateDbCache,
} from "@/lib/db";
import { AppCategory, Application } from "@/lib/types";
import {
  generateCleanSlug,
  mapGenreToCategory,
  generateModFeatures,
} from "@/lib/playstore-auto-poster";

function purgeAppCaches(slug?: string) {
  try {
    invalidateDbCache();
    revalidatePath("/", "page");
    revalidatePath("/apps", "page");
    revalidatePath("/categories", "page");
    revalidatePath("/search", "page");
    revalidatePath("/admin", "page");
    revalidatePath("/admin/apps", "page");
    revalidatePath("/admin/versions", "page");
    revalidatePath("/apps/[slug]", "page");
    revalidatePath("/download/[slug]", "page");
    if (slug) {
      const clean = slug.replace(/\.html$/i, "");
      revalidatePath(`/apps/${clean}`, "page");
      revalidatePath(`/apps/${clean}.html`, "page");
      revalidatePath(`/download/${clean}`, "page");
      revalidatePath(`/download/${clean}.html`, "page");
    }
  } catch {}
}

async function getGPlay() {
  const mod = await import("google-play-scraper");
  return (mod as any).default || mod;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "--")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

function extractMeta(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["'](?:og:)?${name}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return decodeHtmlEntities(match[1].trim());

  const reverseRegex = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:)?${name}["']`,
    "i"
  );
  const reverseMatch = html.match(reverseRegex);
  return reverseMatch ? decodeHtmlEntities(reverseMatch[1].trim()) : null;
}

function extractJsonLd(html: string): any {
  const regex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (
        parsed["@type"] === "SoftwareApplication" ||
        parsed["@type"] === "MobileApplication"
      ) {
        return parsed;
      }
      if (Array.isArray(parsed["@graph"])) {
        const item = parsed["@graph"].find(
          (x: any) =>
            x["@type"] === "SoftwareApplication" ||
            x["@type"] === "MobileApplication"
        );
        if (item) return item;
      }
    } catch {}
  }
  return null;
}

function cleanScrapedTitle(rawTitle: string): { cleanBase: string; finalTitle: string } {
  let cleaned = decodeHtmlEntities(rawTitle || "")
    .replace(/<[^>]*>/g, "")
    // Remove common site names and brand tags
    .replace(/\|?\s*(?:APKDone|HappyMod|AN1(?:\.COM)?|LiteAPKs|ModCombo|APKPure|APKMirror|Mobilism|Rexdl|Dlandroid|Google Play)[^\n|]*/gi, "")
    // Remove marketing suffixes
    .replace(/\b(?:MOD\s*APK|APK\s*MOD|Premium\s*Unlocked|VIP\s*Unlocked|Pro\s*Unlocked|Unlimited\s*Money|Full\s*Version|Free\s*Download|Download\s*for\s*Android)\b/gi, "")
    // Remove version numbers like v1.2.3 or 1.2.3 from the title base
    .replace(/\bv?[0-9]+(?:\.[0-9]+)+(?:[-_][a-zA-Z0-9]+)?\b/gi, "")
    // Strip trailing brackets / parentheses
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[:\-_|]+$/, "")
    .trim();

  // If title was stripped too aggressively, restore from first segment
  if (!cleaned || cleaned.length < 2) {
    cleaned = (rawTitle || "New Application").split(/[:\-_|]/)[0].trim();
  }

  const cleanBase = cleaned.trim();
  const finalTitle = `${cleanBase} MOD APK (Premium Unlocked)`;
  return { cleanBase, finalTitle };
}

/**
 * Scrapes any mod website link (APKDone, HappyMod, AN1, LiteAPKs, or arbitrary app URL),
 * extracts all metadata, and creates/updates a draft application post with developer set to "Aadith C V".
 */
export async function scrapeAndCreateFromModUrl(
  inputUrl: string
): Promise<{ success: boolean; app?: Application; error?: string; isNew?: boolean; wasAlreadyPublished?: boolean }> {
  try {
    // 1. Extract URL and potential custom size passed on the same line
    const sizeMatch = inputUrl.match(/\b([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))\b/i);
    const customSize = sizeMatch ? sizeMatch[1].toUpperCase() : null;

    const urlMatch = inputUrl.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
      return { success: false, error: "Invalid URL provided" };
    }
    const targetUrl = urlMatch[0];

    // If it's a Google Play link, delegate to Google Play scraper
    if (targetUrl.includes("play.google.com/store/apps/details")) {
      const { scrapeAndCreateFromPlayStore } = await import("@/lib/playstore-auto-poster");
      return await scrapeAndCreateFromPlayStore(inputUrl);
    }

    // 2. Fetch the target webpage
    let html = "";
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status}: Could not load webpage from ${new URL(targetUrl).hostname}`,
        };
      }
      html = await res.text();
    } catch (fetchErr: any) {
      return {
        success: false,
        error: `Failed to fetch webpage: ${fetchErr.message || "Network error"}`,
      };
    }

    // 3. Extract JSON-LD and meta tags
    const jsonLd = extractJsonLd(html);
    const ogTitle = extractMeta(html, "title");
    const ogImage = extractMeta(html, "image");
    const ogDescription = extractMeta(html, "description");

    const htmlTitleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    const rawTitle =
      jsonLd?.name ||
      ogTitle ||
      (h1Match ? h1Match[1].replace(/<[^>]*>/g, "").trim() : null) ||
      (htmlTitleMatch ? htmlTitleMatch[1].trim() : "Modded Application");

    const { cleanBase, finalTitle } = cleanScrapedTitle(rawTitle);
    const slug = generateCleanSlug(`${cleanBase} mod`);

    // 4. Check for embedded Google Play link on the page
    const playStoreMatch = html.match(
      /(?:https?:\/\/)?play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/i
    );
    let playPackageId = playStoreMatch ? playStoreMatch[1] : null;

    if (!playPackageId) {
      // Look for package name in page scripts or metadata
      const pkgMatch = html.match(
        /(?:package(?:_name)?|appId|bundleId)["']?\s*[:=]\s*["']([a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+)["']/i
      );
      if (pkgMatch) playPackageId = pkgMatch[1];
    }

    let gplayDetail: any = null;
    if (playPackageId) {
      try {
        const gplay = await getGPlay();
        gplayDetail = await gplay.app({ appId: playPackageId });
      } catch {}
    }

    // 5. Version Extraction
    let versionName = "vLatest";
    if (jsonLd?.softwareVersion) {
      versionName = jsonLd.softwareVersion.startsWith("v")
        ? jsonLd.softwareVersion
        : `v${jsonLd.softwareVersion}`;
    } else {
      const verMatch = (rawTitle + " " + (ogDescription || "") + " " + html.slice(0, 3000)).match(
        /(?:Version|Ver|v)[\s:]*([0-9]+(?:\.[0-9]+)+(?:[-_][a-zA-Z0-9]+)?)/i
      );
      if (verMatch) {
        versionName = `v${verMatch[1]}`;
      } else if (gplayDetail?.version && gplayDetail.version !== "VARY") {
        versionName = `v${gplayDetail.version}`;
      }
    }

    // 6. File Size Extraction
    let fileSize =
      customSize ||
      jsonLd?.fileSize ||
      null;

    if (!fileSize) {
      const sizeMatchInHtml = html.match(
        /(?:Size|File Size|APK Size)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))/i
      );
      if (sizeMatchInHtml) {
        fileSize = sizeMatchInHtml[1].toUpperCase();
      } else if (gplayDetail?.size && gplayDetail.size !== "VARY") {
        fileSize = gplayDetail.size;
      } else {
        fileSize = "Varies with device";
      }
    }

    // 7. Icon URL
    let iconUrl =
      gplayDetail?.icon ||
      ogImage ||
      jsonLd?.image ||
      "/icons/default-app.png";

    if (iconUrl.startsWith("/")) {
      try {
        iconUrl = new URL(iconUrl, targetUrl).href;
      } catch {}
    }

    // 8. Screenshots
    let screenshots: string[] = [];
    if (Array.isArray(gplayDetail?.screenshots) && gplayDetail.screenshots.length > 0) {
      screenshots = gplayDetail.screenshots.slice(0, 6);
    } else if (Array.isArray(jsonLd?.screenshot)) {
      screenshots = jsonLd.screenshot.slice(0, 6);
    } else if (ogImage) {
      screenshots = [ogImage];
    }

    // 9. Mod Features Extraction
    let extractedFeatures: string[] = [];

    // Search for explicit MOD features list in page HTML
    const modFeaturesSectionMatch = html.match(
      /(?:mod\s*features?|mod\s*info|what(?:'s|\s+is)\s+in\s+the\s+mod|unlocked\s+features?|features\s+of\s+mod)[\s\S]{0,1200}?(?:<ul>([\s\S]*?)<\/ul>|<ol>([\s\S]*?)<\/ol>)/i
    );

    if (modFeaturesSectionMatch) {
      const listHtml = modFeaturesSectionMatch[1] || modFeaturesSectionMatch[2] || "";
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(listHtml)) !== null) {
        const text = decodeHtmlEntities(liMatch[1].replace(/<[^>]*>/g, "").trim());
        if (text && text.length > 2 && text.length < 120 && !text.toLowerCase().includes("download")) {
          extractedFeatures.push(text);
        }
      }
    }

    // If no features found in HTML list, generate contextual mod features
    if (extractedFeatures.length < 2) {
      extractedFeatures = generateModFeatures(cleanBase, gplayDetail?.genre || "");
    }
    extractedFeatures = extractedFeatures.slice(0, 6);

    // 10. Category Mapping
    const categories = await getCategories();
    const categoryId = mapGenreToCategory(
      gplayDetail?.genre || jsonLd?.applicationCategory,
      gplayDetail?.genreId,
      categories
    );

    // 11. Android Requirement
    let androidReq = "Android 7.0+";
    const reqMatch = html.match(/Android\s*([0-9]+(?:\.[0-9]+)?(?:\s*\+)?)/i);
    if (reqMatch) {
      androidReq = `Android ${reqMatch[1]}+`;
    } else if (gplayDetail?.androidVersionText && gplayDetail.androidVersionText !== "VARY") {
      androidReq = `Android ${gplayDetail.androidVersionText}+`;
    }

    // 12. Short Description & Full Description
    const rawShortDesc =
      ogDescription ||
      jsonLd?.description ||
      gplayDetail?.summary ||
      `${cleanBase} modded application with unlocked features.`;

    const shortDescription = decodeHtmlEntities(rawShortDesc)
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 160);

    const description = `### Overview\n**${finalTitle}** mod release with premium features unlocked.\n\n${shortDescription}\n\n### MOD Features:\n${extractedFeatures
      .map((f) => `- ${f}`)
      .join("\n")}\n\n### How to Install:\n1. Download the APK file from the button below.\n2. Enable "Install from Unknown Sources" in your device settings.\n3. Install the APK and enjoy your unlocked premium experience!`;

    // 13. Package Name & Developer
    const packageName =
      gplayDetail?.appId ||
      playPackageId ||
      `com.awtmods.${slug.replace(/-/g, ".")}`;

    // Developer is strictly Aadith C V as requested
    const developerName = "Aadith C V";

    // 14. Save or Update in Database
    const supabase = getDbClient();
    let existingApp = await getApplicationBySlug(slug);
    if (!existingApp && packageName) {
      const { getApplicationByPackage } = await import("@/lib/db");
      existingApp = await getApplicationByPackage(packageName);
    }

    if (existingApp && supabase) {
      const wasPublished = existingApp.status === "published";
      await supabase
        .from("applications")
        .update({
          name: finalTitle,
          package_name: packageName,
          developer: developerName,
          icon_url: iconUrl || existingApp.icon_url,
          banner_url:
            gplayDetail?.headerImage || existingApp.banner_url || iconUrl,
          mod_features: extractedFeatures,
          short_description: shortDescription,
        })
        .eq("id", existingApp.id);

      if (customSize) {
        const existingVer =
          existingApp.latest_version || existingApp.versions?.[0];
        if (existingVer?.id) {
          await supabase
            .from("application_versions")
            .update({ file_size: customSize })
            .eq("id", existingVer.id);
        }
      }

      purgeAppCaches(existingApp.slug || slug);
      const updated = await getApplicationBySlug(existingApp.slug || slug);
      return {
        success: true,
        app: updated || existingApp,
        isNew: false,
        wasAlreadyPublished: wasPublished,
      };
    }

    // Create fresh application post
    const newAppData = {
      name: finalTitle,
      slug,
      package_name: packageName,
      developer: developerName,
      category_id: categoryId,
      platform: "android" as const,
      short_description: shortDescription,
      description,
      icon_url: iconUrl,
      banner_url: gplayDetail?.headerImage || iconUrl,
      android_requirement: androidReq,
      is_featured: false,
      is_trending: false,
      status: "draft" as const,
      screenshots,
      mod_features: extractedFeatures,
      version: {
        version_name: versionName,
        version_code: 1,
        file_size: fileSize,
        architecture: "arm64-v8a",
        android_requirement: androidReq,
        sha256: null,
        release_notes: extractedFeatures.join("\n"),
        is_latest: true,
        status: "draft" as const,
        download_sources: [
          {
            download_type: "external" as const,
            hosting_provider: "custom" as const,
            download_url: `https://www.awtmods.in/download/${slug}`,
            mirror_name: "AWTMods Fast Mirror",
            is_primary: true,
          },
        ],
      },
    };

    const created = await createApplication(newAppData as any);
    purgeAppCaches(slug);
    return { success: true, app: created, isNew: true, wasAlreadyPublished: false };
  } catch (err: any) {
    console.error("scrapeAndCreateFromModUrl error:", err);
    return {
      success: false,
      error: err.message || "Failed to scrape mod webpage",
    };
  }
}
