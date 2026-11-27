import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCategories, getApplications, createApplication } from "@/lib/db";
import { AppCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function mapCategory(
  categoryName: string | undefined,
  genreId: string | undefined,
  categories: AppCategory[]
): string {
  const g = (categoryName || "").toLowerCase();
  const gid = (genreId || "").toLowerCase();

  if (gid.startsWith("game") || g.includes("game")) {
    const c = categories.find((x) => x.slug === "games");
    if (c) return c.id;
  }
  if (g.includes("music") || g.includes("audio")) {
    const c = categories.find((x) => x.slug === "music-audio");
    if (c) return c.id;
  }
  if (g.includes("video") || g.includes("media") || g.includes("player")) {
    const c = categories.find((x) => x.slug === "media-video");
    if (c) return c.id;
  }
  if (g.includes("photo") || g.includes("camera")) {
    const c = categories.find((x) => x.slug === "photography");
    if (c) return c.id;
  }
  if (g.includes("social")) {
    const c = categories.find((x) => x.slug === "social");
    if (c) return c.id;
  }
  if (g.includes("communication")) {
    const c = categories.find((x) => x.slug === "communication");
    if (c) return c.id;
  }
  if (g.includes("productivity") || g.includes("business") || g.includes("education") || g.includes("shopping")) {
    const c = categories.find((x) => x.slug === "productivity");
    if (c) return c.id;
  }
  const tools = categories.find((x) => x.slug === "tools");
  return tools?.id || categories[0]?.id || "";
}

function findBestStoreMatch(
  query: string,
  store: Record<string, { name?: string; category?: string; iconUrl?: string; description?: string }>
): { pkg: string; info: any } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const entries = Object.entries(store || {});
  // 1. Exact package name match
  const exactPkg = entries.find(([pkg]) => pkg.toLowerCase() === q);
  if (exactPkg) return { pkg: exactPkg[0], info: exactPkg[1] };

  // 2. Exact app name match
  const exactName = entries.find(([, info]) => (info?.name || "").trim().toLowerCase() === q);
  if (exactName) return { pkg: exactName[0], info: exactName[1] };

  // 3. Name starts with query (e.g. "Target" -> "Target" or "Target: ...")
  const startsWith = entries.find(([, info]) => {
    const n = (info?.name || "").trim().toLowerCase();
    return n.startsWith(q + " ") || n.startsWith(q + ":") || n.startsWith(q + "-");
  });
  if (startsWith) return { pkg: startsWith[0], info: startsWith[1] };

  // 4. Substring match (shortest name wins so "Target" beats "Dead Target: Offline Games 3D")
  const subMatches = entries
    .filter(([, info]) => (info?.name || "").toLowerCase().includes(q))
    .sort((a, b) => (a[1]?.name?.length || 999) - (b[1]?.name?.length || 999));

  if (subMatches.length > 0) {
    return { pkg: subMatches[0][0], info: subMatches[0][1] };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawNames: string[] = Array.isArray(body.names)
      ? body.names
      : typeof body.namesText === "string"
      ? body.namesText.split(/\r?\n/)
      : [];

    const names = rawNames.map((n) => n.trim()).filter(Boolean);
    const status: "draft" | "published" = body.status === "published" ? "published" : "draft";

    if (names.length === 0) {
      return NextResponse.json({ error: "Please provide at least one app name." }, { status: 400 });
    }

    const [catalogRes, categories, existingAppsData, gplay] = await Promise.all([
      fetch("https://morphe-patches.software/data/catalog.json", { cache: "no-store" }),
      getCategories(),
      getApplications({ limit: 1500, status: "all" }),
      getGPlay().catch(() => null),
    ]);

    if (!catalogRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch morphe-patches.software catalog (${catalogRes.status})` },
        { status: 502 }
      );
    }

    const catalog = await catalogRes.json();
    const store = catalog.store || {};
    const bundles: any[] = Array.isArray(catalog.bundles) ? catalog.bundles : [];
    const compatibilities: Record<string, any[]> = catalog.compatibilities || {};

    const existingPkgSet = new Set(
      (existingAppsData.applications || [])
        .map((a) => (a.package_name || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const created: any[] = [];
    const skipped: { query: string; packageName: string; reason: string }[] = [];
    const notFound: string[] = [];

    for (const query of names) {
      const match = findBestStoreMatch(query, store);
      if (!match) {
        notFound.push(query);
        continue;
      }

      const { pkg, info } = match;
      if (existingPkgSet.has(pkg.toLowerCase())) {
        skipped.push({ query, packageName: pkg, reason: "Already exists on website" });
        continue;
      }

      // Collect Morphe patch names for this package
      const patchFeaturesSet = new Set<string>();
      const compatVersions: string[] = [];
      for (const b of bundles) {
        if (!Array.isArray(b.targetApps) || !b.targetApps.includes(pkg)) continue;
        for (const p of b.patches || []) {
          if (p?.name) patchFeaturesSet.add(String(p.name).trim());
          const cKey = p?.compatiblePackagesKey != null ? String(p.compatiblePackagesKey) : "";
          const compatList = cKey ? compatibilities[cKey] : null;
          if (Array.isArray(compatList)) {
            for (const cItem of compatList) {
              if (cItem?.packageName === pkg && Array.isArray(cItem.targets)) {
                for (const t of cItem.targets) {
                  if (t?.version) compatVersions.push(String(t.version));
                }
              }
            }
          }
        }
      }

      // Enrich with Play Store metadata if available
      let gplayDetail: any = null;
      if (gplay) {
        try {
          gplayDetail = await Promise.race([
            gplay.app({ appId: pkg, lang: "en", country: "us" }),
            new Promise((resolve) => setTimeout(() => resolve(null), 3500)),
          ]);
        } catch {
          gplayDetail = null;
        }
      }

      const rawTitle = gplayDetail?.title || info?.name || query;
      const cleanTitleBase = rawTitle.split(":")[0].split(" - ")[0].trim();
      const finalName = `${cleanTitleBase} MOD APK (Premium Unlocked)`;
      const slug = generateCleanSlug(`${cleanTitleBase} mod`);
      const categoryId = mapCategory(
        gplayDetail?.genre || info?.category,
        gplayDetail?.genreId,
        categories
      );

      const modFeatures =
        patchFeaturesSet.size > 0
          ? Array.from(patchFeaturesSet).slice(0, 8)
          : [
              "Premium VIP Features Unlocked",
              "Morphe Community Patches Applied",
              "Ad-Free Clean Experience",
              "Safe & Verified Build",
            ];

      const rawVer =
        compatVersions[compatVersions.length - 1] ||
        (gplayDetail?.version && gplayDetail.version !== "VARY" ? gplayDetail.version : "") ||
        "Latest";
      const versionName = rawVer.startsWith("v") ? rawVer : `v${rawVer}`;

      const screenshots: string[] = Array.isArray(gplayDetail?.screenshots)
        ? gplayDetail.screenshots.slice(0, 6)
        : [];

      const shortDescription = (
        gplayDetail?.summary ||
        info?.description ||
        `${cleanTitleBase} patched with Morphe community patches for Android.`
      )
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, 160);

      const fullDescription = [
        `${finalName} is a modified Android build powered by Morphe community patches.`,
        "",
        "### Morphe Patch Features",
        ...modFeatures.map((f) => `- ${f}`),
        "",
        gplayDetail?.description
          ? gplayDetail.description.replace(/<[^>]*>/g, "\n").slice(0, 1500)
          : info?.description || "",
      ]
        .filter(Boolean)
        .join("\n");

      const appPayload = {
        name: finalName,
        slug,
        package_name: pkg,
        developer: "Aadith C V",
        category_id: categoryId,
        platform: "android" as const,
        short_description: shortDescription,
        description: fullDescription,
        icon_url: gplayDetail?.icon || info?.iconUrl || "/icons/default-app.png",
        banner_url: gplayDetail?.headerImage || screenshots[0] || null,
        android_requirement:
          gplayDetail?.androidVersionText && gplayDetail.androidVersionText !== "VARY"
            ? `Android ${gplayDetail.androidVersionText}+`
            : "Android 7.0+",
        is_featured: false,
        is_trending: false,
        status,
        screenshots,
        mod_features: modFeatures,
        version: {
          version_name: versionName,
          version_code: 1,
          file_size:
            gplayDetail?.size && gplayDetail.size !== "VARY"
              ? gplayDetail.size
              : "Varies with device",
          architecture: "arm64-v8a",
          android_requirement: "Android 7.0+",
          sha256: null,
          release_notes: `Patched with Morphe community patches (${modFeatures.length} patches).`,
          is_latest: true,
          status,
          download_sources: [
            {
              download_type: "external",
              hosting_provider: "mediafire",
              download_url: "https://www.mediafire.com",
              mirror_name: "MediaFire Fast CDN",
              is_primary: true,
            },
          ],
        },
      };

      const saved = await createApplication(appPayload as any);
      existingPkgSet.add(pkg.toLowerCase());
      created.push(saved);
    }

    try {
      revalidatePath("/");
      revalidatePath("/apps");
      revalidatePath("/admin/apps");
    } catch {}

    return NextResponse.json({
      success: true,
      created,
      skipped,
      notFound,
    });
  } catch (err: any) {
    console.error("Morphe import error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to import from Morphe catalog" },
      { status: 500 }
    );
  }
}
