import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./supabase/server";
import { getEnv } from "./env";
import {
  initialCategories,
  initialSiteSettings,
} from "./data/mock-data";
import {
  Application,
  AppCategory,
  ApplicationVersion,
  SiteSettings,
  UserReport,
  DownloadEvent,
  ApplicationReview,
} from "./types";

const DEFAULT_SUPABASE_URL = "https://uzmskxruuvfgokststox.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "sb_publishable_GDnnEMuWJQLDOMSlvox7CA_e-bPy7LR";

// In-memory fallback state
let memoryApps: Application[] = [];
let memoryCategories: AppCategory[] = [...initialCategories];
let memorySettings: SiteSettings = { ...initialSiteSettings };
let memoryReports: UserReport[] = [];
let memoryDownloads: DownloadEvent[] = [];

// High performance in-memory TTL caching (cleared instantly on admin mutations)
let cachedCategories: { data: AppCategory[]; timestamp: number } | null = null;
let cachedSettings: { data: SiteSettings; timestamp: number } | null = null;
let cachedStats: { data: any; timestamp: number } | null = null;
const cachedAppsMap = new Map<string, { data: { applications: Application[]; total: number }; timestamp: number }>();
const cachedSlugMap = new Map<string, { data: Application | null; timestamp: number }>();

export function invalidateDbCache() {
  cachedCategories = null;
  cachedSettings = null;
  cachedStats = null;
  cachedAppsMap.clear();
  cachedSlugMap.clear();
}

// Persistent singleton Supabase client with HTTP connection pooling
let sharedSupabaseClient: any = null;

export function getDbClient() {
  if (sharedSupabaseClient) return sharedSupabaseClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  sharedSupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return sharedSupabaseClient;
}

// ==========================================
// APPLICATIONS QUERIES
// ==========================================

export async function getApplications(options?: {
  categorySlug?: string;
  platform?: string;
  status?: string;
  search?: string;
  featured?: boolean;
  trending?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "newest" | "oldest" | "downloads" | "alphabetical";
}): Promise<{ applications: Application[]; total: number }> {
  const cacheKey = JSON.stringify(options || {});
  const now = Date.now();
  // Do not serve cached results for admin queries (status: "all") so admin panel is always real-time live
  if (options?.status !== "all") {
    const cached = cachedAppsMap.get(cacheKey);
    if (cached && now - cached.timestamp < 3000) {
      return cached.data;
    }
  }

  const supabase = getDbClient();

  if (supabase) {
    try {
      let query = supabase.from("applications").select(
        "*, category:categories(*), versions:application_versions(*, download_sources(*)), screenshots(*)",
        { count: "exact" }
      );

      if (options?.platform) {
        query = query.eq("platform", options.platform);
      }

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      } else if (!options?.status) {
        query = query.eq("status", "published");
      }

      if (options?.featured !== undefined) {
        query = query.eq("is_featured", options.featured);
      }

      if (options?.trending !== undefined) {
        query = query.eq("is_trending", options.trending);
      }

      if (options?.categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", options.categorySlug)
          .single();
        if (cat) {
          query = query.eq("category_id", cat.id);
        }
      }

      if (options?.search) {
        query = query.or(
          `name.ilike.%${options.search}%,developer.ilike.%${options.search}%,package_name.ilike.%${options.search}%`
        );
      }

      if (options?.sortBy === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (options?.sortBy === "alphabetical") {
        query = query.order("name", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      if (options?.limit) {
        const from = options.offset || 0;
        query = query.range(from, from + options.limit - 1);
      }

      const { data, count, error } = await query;
      if (!error && data) {
        // Fetch original download counts from downloads table
        const appIds = data.map((item: any) => item.id);
        const dlCounts: Record<string, number> = {};

        if (appIds.length > 0) {
          const { data: dlData } = await supabase
            .from("downloads")
            .select("application_id")
            .in("application_id", appIds);

          if (dlData) {
            dlData.forEach((row: any) => {
              dlCounts[row.application_id] = (dlCounts[row.application_id] || 0) + 1;
            });
          }
        }

        const apps = data.map((item: any) => ({
          ...item,
          downloads_count: dlCounts[item.id] || 0,
          latest_version:
            item.versions?.find((v: any) => v.is_latest) || item.versions?.[0],
        }));
        const result = { applications: apps, total: count || apps.length };
        cachedAppsMap.set(cacheKey, { data: result, timestamp: now });
        return result;
      }
    } catch {
      // Fallback
    }
  }

  // Memory fallback logic
  let filtered = [...memoryApps];

  if (options?.status && options.status !== "all") {
    filtered = filtered.filter((a) => a.status === options.status);
  } else if (!options?.status) {
    filtered = filtered.filter((a) => a.status === "published");
  }

  if (options?.platform) {
    filtered = filtered.filter((a) => (a as any).platform === options.platform);
  }

  if (options?.featured !== undefined) {
    filtered = filtered.filter((a) => a.is_featured === options.featured);
  }

  if (options?.trending !== undefined) {
    filtered = filtered.filter((a) => a.is_trending === options.trending);
  }

  if (options?.categorySlug) {
    filtered = filtered.filter(
      (a) => a.category?.slug.toLowerCase() === options.categorySlug?.toLowerCase()
    );
  }

  if (options?.search) {
    const q = options.search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.developer.toLowerCase().includes(q) ||
        a.package_name.toLowerCase().includes(q)
    );
  }

  if (options?.sortBy === "oldest") {
    filtered.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } else if (options?.sortBy === "alphabetical") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const total = filtered.length;

  if (options?.limit) {
    const offset = options.offset || 0;
    filtered = filtered.slice(offset, offset + options.limit);
  }

  return { applications: filtered, total };
}

export async function getApplicationBySlug(slug: string): Promise<Application | null> {
  const cleanSlug = slug ? slug.replace(/\.html$/i, "").trim() : "";
  const legacyAliases: Record<string, string> = {
    "spotify-premium-mod-1793814592151": "spotify-premium",
    "minecraft-pocket-edition-1793815123541": "minecraft-mod-apk",
  };
  const targetSlug = legacyAliases[cleanSlug] || cleanSlug;
  const now = Date.now();
  const cached = cachedSlugMap.get(targetSlug);
  if (cached && now - cached.timestamp < 3000) {
    return cached.data;
  }

  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          category:categories(*),
          versions:application_versions(
            *,
            download_sources(*)
          ),
          screenshots(*)
        `)
        .or(`slug.eq.${targetSlug},slug.eq.${cleanSlug},slug.eq.${slug}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const latest =
          data.versions?.find((v: any) => v.is_latest) || data.versions?.[0];

        // Fetch original real download count for this app
        const { count: dlCount } = await supabase
          .from("downloads")
          .select("id", { count: "exact", head: true })
          .eq("application_id", data.id);

        const appData: Application = {
          ...data,
          latest_version: latest,
          versions: data.versions,
          downloads_count: dlCount || 0,
        };
        if (data.slug) cachedSlugMap.set(data.slug, { data: appData, timestamp: Date.now() });
        return appData;
      }
    } catch {
      // Fallback
    }
  }

  const app = memoryApps.find(
    (a) => a.slug === targetSlug || a.slug === cleanSlug || a.slug === slug
  );
  return app || null;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          category:categories(*),
          versions:application_versions(
            *,
            download_sources(*)
          ),
          screenshots(*)
        `)
        .eq("id", id)
        .single();

      if (!error && data) {
        const latest =
          data.versions?.find((v: any) => v.is_latest) || data.versions?.[0];

        const { count: dlCount } = await supabase
          .from("downloads")
          .select("id", { count: "exact", head: true })
          .eq("application_id", data.id);

        const appData: Application = {
          ...data,
          latest_version: latest,
          versions: data.versions,
          downloads_count: dlCount || 0,
        };
        if (data.slug) cachedSlugMap.set(data.slug, { data: appData, timestamp: Date.now() });
        return appData;
      }
    } catch {
      // Fallback
    }
  }

  const app = memoryApps.find((a) => a.id === id);
  return app || null;
}

export async function getCategories(): Promise<AppCategory[]> {
  const now = Date.now();
  if (cachedCategories && now - cachedCategories.timestamp < 60000) {
    return cachedCategories.data;
  }

  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data: cats, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && cats) {
        // Fetch published app counts per category
        const { data: apps } = await supabase
          .from("applications")
          .select("category_id")
          .eq("status", "published");

        const countsMap: Record<string, number> = {};
        apps?.forEach((a: any) => {
          countsMap[a.category_id] = (countsMap[a.category_id] || 0) + 1;
        });

        const result = cats.map((cat: any) => ({
          ...cat,
          app_count: countsMap[cat.id] || 0,
        }));

        cachedCategories = { data: result, timestamp: now };
        return result;
      }
    } catch {
      // Fallback
    }
  }

  const result = memoryCategories
    .filter((c) => c.is_active)
    .map((cat) => ({
      ...cat,
      app_count: memoryApps.filter(
        (a) => a.category_id === cat.id && a.status === "published"
      ).length,
    }));

  cachedCategories = { data: result, timestamp: now };
  return result;
}

export async function getCategoryBySlug(slug: string): Promise<AppCategory | null> {
  const categories = await getCategories();
  return categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export async function getFeaturedApps(): Promise<Application[]> {
  const { applications } = await getApplications({ featured: true, limit: 4 });
  return applications;
}

export async function getTrendingApps(): Promise<Application[]> {
  return getTrendingAndroidApps(6);
}

/**
 * Retrieves the top trending Android apps ranked by downloads within the last 24 hours.
 * If 24h downloads are tied or 0, ranks by is_trending flag, total downloads, and rating.
 */
export async function getTrendingAndroidApps(limit: number = 10): Promise<Application[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const now = new Date();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Query downloads recorded within the last 24 hours
      const { data: recentDownloads } = await supabase
        .from("downloads")
        .select("application_id")
        .gte("downloaded_at", since24h);

      const dl24hMap: Record<string, number> = {};
      if (recentDownloads) {
        recentDownloads.forEach((d: any) => {
          if (d.application_id) {
            dl24hMap[d.application_id] = (dl24hMap[d.application_id] || 0) + 1;
          }
        });
      }

      // 2. Query all published Android applications (excluding platform = 'pc')
      const { data: appsData, error } = await supabase
        .from("applications")
        .select(`
          *,
          category:categories(*),
          versions:application_versions(*, download_sources(*)),
          screenshots(*)
        `)
        .eq("status", "published")
        .or("platform.eq.android,platform.is.null");

      if (!error && appsData) {
        // 3. Fetch all-time download counts for these apps
        const appIds = appsData.map((a: any) => a.id);
        const totalDlMap: Record<string, number> = {};

        if (appIds.length > 0) {
          const { data: allDls } = await supabase
            .from("downloads")
            .select("application_id")
            .in("application_id", appIds);

          if (allDls) {
            allDls.forEach((d: any) => {
              if (d.application_id) {
                totalDlMap[d.application_id] = (totalDlMap[d.application_id] || 0) + 1;
              }
            });
          }
        }

        const mappedApps: Application[] = appsData
          .filter((item: any) => item.category?.slug !== "pc-software" && item.platform !== "pc")
          .map((item: any) => ({
            ...item,
            downloads_24h: dl24hMap[item.id] || 0,
            downloads_count: totalDlMap[item.id] || 0,
            latest_version:
              item.versions?.find((v: any) => v.is_latest) || item.versions?.[0],
          }));

        // Sort by:
        // 1. Most downloads in last 24 hours (24h velocity)
        // 2. is_trending flag
        // 3. Total all-time downloads
        // 4. Rating
        mappedApps.sort((a, b) => {
          const dl24A = a.downloads_24h || 0;
          const dl24B = b.downloads_24h || 0;
          if (dl24B !== dl24A) return dl24B - dl24A;

          if (b.is_trending && !a.is_trending) return 1;
          if (!b.is_trending && a.is_trending) return -1;

          const totalA = a.downloads_count || 0;
          const totalB = b.downloads_count || 0;
          if (totalB !== totalA) return totalB - totalA;

          return (b.rating || 0) - (a.rating || 0);
        });

        return mappedApps.slice(0, limit);
      }
    } catch (err) {
      console.error("Error in getTrendingAndroidApps:", err);
    }
  }

  // Memory fallback
  const androidApps = memoryApps
    .filter((a) => a.status === "published" && a.platform !== "pc" && a.category?.slug !== "pc-software")
    .map((a) => {
      const now = Date.now();
      const count24h = memoryDownloads.filter(
        (d) => d.application_id === a.id && now - new Date(d.downloaded_at).getTime() <= 86400000
      ).length;
      return { ...a, downloads_24h: count24h };
    })
    .sort((a, b) => (b.downloads_24h || 0) - (a.downloads_24h || 0) || (b.is_trending ? 1 : 0) - (a.is_trending ? 1 : 0));

  return androidApps.slice(0, limit);
}

export async function getLatestReleases(): Promise<Application[]> {
  const { applications } = await getApplications({ limit: 6, sortBy: "newest" });
  return applications;
}

export async function getRecentlyUpdated(): Promise<Application[]> {
  const { applications } = await getApplications({ limit: 6 });
  return [...applications].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getSiteStats() {
  const now = Date.now();
  if (cachedStats && now - cachedStats.timestamp < 30000) {
    return cachedStats.data;
  }

  const supabase = getDbClient();

  if (supabase) {
    try {
      const [pubAppsCount, draftAppsCount, catsCount, dlsCount] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("downloads").select("id", { count: "exact", head: true }),
      ]);

      const publishedApps = pubAppsCount.count || 0;
      const draftApps = draftAppsCount.count || 0;
      const totalApps = publishedApps + draftApps;
      const totalCategories = catsCount.count || 0;
      const totalDownloads = dlsCount.count || 0; // Original live platform count

      const result = {
        totalApps,
        publishedApps,
        draftApps,
        totalDownloads,
        totalCategories,
        recentUpdates: publishedApps,
      };

      cachedStats = { data: result, timestamp: now };
      return result;
    } catch {
      // Fallback
    }
  }

  const publishedApps = memoryApps.filter((a) => a.status === "published").length;
  const draftApps = memoryApps.filter((a) => a.status === "draft").length;

  const result = {
    totalApps: publishedApps + draftApps,
    publishedApps,
    draftApps,
    totalDownloads: memoryDownloads.length,
    totalCategories: memoryCategories.filter((c) => c.is_active).length,
    recentUpdates: publishedApps,
  };

  cachedStats = { data: result, timestamp: now };
  return result;
}

export async function getAnalyticsChartData(days: number = 30) {
  const points: { date: string; downloads: number }[] = [];
  const now = new Date();
  const stepDays = days <= 7 ? 1 : days <= 30 ? 4 : 15;
  const numSteps = Math.ceil(days / stepDays);

  const supabase = getDbClient();
  let dbDownloads: any[] = [];
  if (supabase) {
    try {
      const sinceDate = new Date(now.getTime() - days * 86400000).toISOString();
      const { data } = await supabase
        .from("downloads")
        .select("downloaded_at")
        .gte("downloaded_at", sinceDate);
      if (data) {
        dbDownloads = data;
      }
    } catch {
      // Fallback
    }
  }

  for (let i = numSteps - 1; i >= 0; i--) {
    const stepStart = new Date(now.getTime() - (i + 1) * stepDays * 86400000);
    const stepEnd = new Date(now.getTime() - i * stepDays * 86400000);
    const dateLabel = stepEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const count = dbDownloads.filter((d: any) => {
      const t = new Date(d.downloaded_at).getTime();
      return t >= stepStart.getTime() && t <= stepEnd.getTime();
    }).length;

    points.push({
      date: dateLabel,
      downloads: count,
    });
  }

  return points;
}

// ==========================================
// ADMIN MUTATIONS (SAVED DIRECTLY TO DATABASE)
// ==========================================

const VALID_DOWNLOAD_TYPES = new Set(["upload", "external"]);
const VALID_HOSTING_PROVIDERS = new Set([
  "mediafire",
  "google_drive",
  "dropbox",
  "mega",
  "telegram",
  "custom",
  "cloudflare_r2",
  "supabase_storage",
]);

function sanitizeAppPayload(data: any) {
  const sanitized = { ...data };

  // Guarantee non-null required strings for applications table
  if (!sanitized.name) sanitized.name = "Untitled App";
  if (!sanitized.slug) sanitized.slug = `app-${Date.now()}`;
  if (!sanitized.package_name) sanitized.package_name = `com.awtmods.${sanitized.slug.replace(/[^a-z0-9]/gi, ".")}`;
  if (!sanitized.developer) sanitized.developer = "Aadith C V";
  if (!sanitized.short_description) {
    sanitized.short_description = `Download ${sanitized.name} with premium features unlocked for Android.`;
  }
  if (!sanitized.description) {
    sanitized.description = `### Overview\n${sanitized.name} is available for download with premium mod features unlocked.`;
  }
  if (!sanitized.icon_url) sanitized.icon_url = "/icons/default-app.png";
  if (!sanitized.android_requirement) sanitized.android_requirement = "Android 7.0+";
  if (!sanitized.status) sanitized.status = "published";

  // Sanitize version & download sources if present
  if (sanitized.version) {
    const v = { ...sanitized.version };
    if (!v.version_name) v.version_name = "v1.0.0";
    if (!v.version_code) v.version_code = 1;
    if (!v.file_size) v.file_size = "Varies with device";
    if (!v.android_requirement) v.android_requirement = sanitized.android_requirement || "Android 7.0+";

    if (Array.isArray(v.download_sources)) {
      v.download_sources = v.download_sources.map((src: any, index: number) => {
        let download_type = src.download_type;
        if (!VALID_DOWNLOAD_TYPES.has(download_type)) {
          download_type = "external";
        }
        let hosting_provider = src.hosting_provider;
        if (!VALID_HOSTING_PROVIDERS.has(hosting_provider)) {
          hosting_provider = "mediafire";
        }
        return {
          ...src,
          download_type,
          hosting_provider,
          download_url: src.download_url || "https://www.mediafire.com",
          mirror_name: src.mirror_name || (hosting_provider === "mediafire" ? "MediaFire Fast CDN" : "Primary Mirror"),
          is_primary: index === 0 ? true : !!src.is_primary,
          is_active: src.is_active !== false,
        };
      });
    }

    sanitized.version = v;
  }

  // Sanitize screenshots array
  if (Array.isArray(sanitized.screenshots)) {
    sanitized.screenshots = sanitized.screenshots
      .map((s: any) => (typeof s === "string" ? s : s?.image_url))
      .filter((url: any) => typeof url === "string" && url.trim().length > 0);
  }

  return sanitized;
}

export async function createApplication(
  data: Partial<Application> & { version?: any }
): Promise<Application> {
  invalidateDbCache();
  const supabase = getDbClient();
  const sanitized = sanitizeAppPayload(data);

  if (supabase) {
    try {
      const { data: result, error } = await supabase.rpc(
        "admin_save_application",
        {
          p_app: sanitized,
        }
      );

      if (!error && result?.success && result?.app) {
        // Fetch full application with nested relations (versions, mirrors, screenshots)
        const fullApp = await getApplicationById(result.app.id);
        const finalApp = fullApp || result.app;
        memoryApps.unshift(finalApp);
        return finalApp;
      }
      if (error) {
        console.error("Supabase RPC admin_save_application error:", error);
      }
    } catch (rpcErr) {
      console.error("createApplication RPC call exception:", rpcErr);
    }
  }

  // Memory fallback if DB is not reachable
  const newId = `app-${Date.now()}`;
  const category =
    memoryCategories.find((c) => c.id === sanitized.category_id) || memoryCategories[0];

  const newVersion: ApplicationVersion = {
    id: `ver-${Date.now()}`,
    application_id: newId,
    version_name: sanitized.version?.version_name || "v1.0.0",
    version_code: sanitized.version?.version_code || 1,
    file_size: sanitized.version?.file_size || "Varies with device",
    architecture: sanitized.version?.architecture || "arm64-v8a",
    android_requirement: sanitized.version?.android_requirement || "Android 7.0+",
    sha256: sanitized.version?.sha256 || null,
    release_notes: sanitized.version?.release_notes || "Initial release",
    is_latest: true,
    status: "published",
    created_at: new Date().toISOString(),
    download_sources: sanitized.version?.download_sources || [],
  };

  const newApp: Application = {
    id: newId,
    name: sanitized.name || "Untitled App",
    slug: sanitized.slug || `app-${Date.now()}`,
    package_name: sanitized.package_name || "com.awtmods.app",
    developer: sanitized.developer || "Aadith C V",
    category_id: category.id,
    category,
    short_description: sanitized.short_description || "",
    description: sanitized.description || "",
    icon_url: sanitized.icon_url || "/icons/default-app.png",
    banner_url: sanitized.banner_url || null,
    android_requirement: sanitized.android_requirement || "Android 7.0+",
    is_featured: !!sanitized.is_featured,
    is_trending: !!sanitized.is_trending,
    status: sanitized.status || "published",
    rating: 0,
    reviews_count: 0,
    downloads_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latest_version: newVersion,
    versions: [newVersion],
    screenshots: (sanitized.screenshots as any) || [],
    mod_features: sanitized.mod_features || [],
  };

  memoryApps.unshift(newApp);
  return newApp;
}

export async function updateApplication(
  id: string,
  updates: Partial<Application> & { version?: any; screenshots?: any }
): Promise<Application | null> {
  invalidateDbCache();
  const supabase = getDbClient();
  const sanitized = sanitizeAppPayload({ id, ...updates });

  if (supabase) {
    try {
      const { data: result, error } = await supabase.rpc(
        "admin_save_application",
        {
          p_app: sanitized,
        }
      );

      if (!error && result?.success && result?.app) {
        const fullApp = await getApplicationById(id);
        return fullApp || result.app;
      }

      // If simple update and RPC returned error, fallback to direct table update
      const { version, screenshots, category, latest_version, versions, ...appFields } = updates as any;
      if (Object.keys(appFields).length > 0) {
        const { data: directData, error: directErr } = await supabase
          .from("applications")
          .update({ ...appFields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();

        if (!directErr && directData) {
          return directData;
        }
      }
    } catch (err) {
      console.error("updateApplication error:", err);
    }
  }

  const index = memoryApps.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const current = memoryApps[index];
  const updated: Application = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  memoryApps[index] = updated;
  return updated;
}

export async function deleteApplication(id: string): Promise<boolean> {
  invalidateDbCache();
  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("admin_delete_application", {
        p_app_id: id,
      });

      if (!error && data) {
        memoryApps = memoryApps.filter((a) => a.id !== id);
        return true;
      }
    } catch (err) {
      console.error("deleteApplication error:", err);
    }
  }

  const initialLen = memoryApps.length;
  memoryApps = memoryApps.filter((a) => a.id !== id);
  return memoryApps.length < initialLen;
}

export async function addApplicationVersion(
  appId: string,
  versionData: Partial<ApplicationVersion>
): Promise<ApplicationVersion | null> {
  invalidateDbCache();
  const supabase = getDbClient();

  if (supabase) {
    try {
      // Mark existing versions as not latest
      await supabase
        .from("application_versions")
        .update({ is_latest: false })
        .eq("application_id", appId);

      const { data: ver, error } = await supabase
        .from("application_versions")
        .insert({
          application_id: appId,
          version_name: versionData.version_name || "v1.0.0",
          version_code: versionData.version_code || 1,
          file_size: versionData.file_size || "Varies with device",
          architecture: versionData.architecture || "arm64-v8a",
          android_requirement: versionData.android_requirement || "Android 7.0+",
          sha256: versionData.sha256 || null,
          release_notes: versionData.release_notes || "",
          is_latest: versionData.is_latest ?? true,
          status: versionData.status || "published",
        })
        .select()
        .single();

      if (!error && ver) {
        return ver;
      }
    } catch (err) {
      console.error("addApplicationVersion error:", err);
    }
  }

  return null;
}

export async function setLatestApplicationVersion(
  appId: string,
  versionId: string
): Promise<boolean> {
  invalidateDbCache();
  const supabase = getDbClient();

  if (supabase) {
    try {
      // 1. Mark all versions for this app as not latest
      await supabase
        .from("application_versions")
        .update({ is_latest: false })
        .eq("application_id", appId);

      // 2. Mark target version as latest
      const { error } = await supabase
        .from("application_versions")
        .update({ is_latest: true })
        .eq("id", versionId);

      if (!error) {
        return true;
      }
    } catch (err) {
      console.error("setLatestApplicationVersion error:", err);
    }
  }

  return false;
}

export async function recordDownload(params: {
  application_id: string;
  version_id: string;
  download_source_id?: string;
  event_type?: "initiated" | "completed" | "mirror_click";
}): Promise<boolean> {
  const supabase = getDbClient();

  if (supabase) {
    try {
      await supabase.from("downloads").insert({
        application_id: params.application_id,
        version_id: params.version_id,
        download_source_id: params.download_source_id,
        event_type: params.event_type || "initiated",
      });
      return true;
    } catch {
      // Fallback
    }
  }

  const event: DownloadEvent = {
    id: `dl-${Date.now()}`,
    application_id: params.application_id,
    version_id: params.version_id,
    download_source_id: params.download_source_id,
    event_type: params.event_type || "initiated",
    downloaded_at: new Date().toISOString(),
  };

  memoryDownloads.push(event);
  return true;
}

export async function submitReport(report: {
  application_id?: string | null;
  report_type: any;
  email?: string | null;
  message: string;
}): Promise<UserReport> {
  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("reports")
        .insert({
          application_id: report.application_id || null,
          report_type: report.report_type,
          email: report.email || null,
          message: report.message,
          status: "pending",
        })
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  const newReport: UserReport = {
    id: `rep-${Date.now()}`,
    application_id: report.application_id,
    report_type: report.report_type,
    email: report.email,
    message: report.message,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  memoryReports.unshift(newReport);
  return newReport;
}

export async function getReports(status?: string): Promise<UserReport[]> {
  const supabase = getDbClient();

  if (supabase) {
    try {
      let query = supabase.from("reports").select("*, application:applications(name)");
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        return data.map((r: any) => ({
          ...r,
          application_name: r.application?.name,
        }));
      }
    } catch {
      // Fallback
    }
  }

  if (status && status !== "all") {
    return memoryReports.filter((r) => r.status === status);
  }
  return memoryReports;
}

export async function updateReportStatus(
  id: string,
  status: "pending" | "resolved" | "dismissed"
): Promise<boolean> {
  const supabase = getDbClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status })
        .eq("id", id);
      if (!error) return true;
    } catch {
      // Fallback
    }
  }

  const r = memoryReports.find((rep) => rep.id === id);
  if (r) {
    r.status = status;
    return true;
  }
  return false;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.timestamp < 60000) {
    return cachedSettings.data;
  }

  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (!error && data && data.length > 0) {
        const settingsObj: any = { ...initialSiteSettings };
        data.forEach((row: any) => {
          settingsObj[row.setting_key] = row.setting_value;
        });
        cachedSettings = { data: settingsObj, timestamp: now };
        return settingsObj;
      }
    } catch {
      // Fallback
    }
  }

  cachedSettings = { data: memorySettings, timestamp: now };
  return memorySettings;
}

export async function updateSiteSettings(
  updates: Partial<SiteSettings>
): Promise<SiteSettings> {
  invalidateDbCache();

  // Optimistically synchronize in-memory settings & cache immediately
  memorySettings = {
    ...memorySettings,
    ...updates,
  };
  cachedSettings = { data: memorySettings, timestamp: Date.now() };

  const supabase = getDbClient();

  if (supabase) {
    try {
      const rows = Object.entries(updates).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
      }));

      if (rows.length > 0) {
        // High-speed single batch upsert (1 network trip instead of 25 sequential trips)
        await supabase
          .from("site_settings")
          .upsert(rows, { onConflict: "setting_key" });
      }
    } catch (err) {
      console.error("updateSiteSettings batch upsert error:", err);
    }
  }

  return memorySettings;
}

// ==========================================
// APPLICATION REVIEWS & RATINGS
// ==========================================

export async function getApplicationReviews(
  applicationId: string
): Promise<ApplicationReview[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("application_reviews")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data as ApplicationReview[];
      }
    } catch (err) {
      console.error("getApplicationReviews error:", err);
    }
  }
  return [];
}

// ==========================================
// COMMUNITY MOD REQUESTS ENGINE
// ==========================================

export async function getModRequests(): Promise<import("./types").ModRequest[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "community_mod_requests")
        .single();

      if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
        return data.setting_value as import("./types").ModRequest[];
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

export async function createModRequest(newReq: {
  app_name: string;
  package_name?: string;
  features_requested: string;
  requester_name?: string;
}): Promise<import("./types").ModRequest> {
  const allRequests = await getModRequests();
  const created: import("./types").ModRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    app_name: newReq.app_name.trim(),
    package_name: newReq.package_name?.trim() || undefined,
    features_requested: newReq.features_requested.trim(),
    requester_name: newReq.requester_name?.trim() || "Community Member",
    upvotes: 1,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  const updatedList = [created, ...allRequests];
  const supabase = getDbClient();
  if (supabase) {
    try {
      await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "community_mod_requests", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
    } catch (err) {
      console.error("createModRequest error:", err);
    }
  }

  return created;
}

export async function upvoteModRequest(id: string): Promise<number> {
  const allRequests = await getModRequests();
  let newUpvotes = 1;
  const updatedList = allRequests.map((r) => {
    if (r.id === id) {
      newUpvotes = (r.upvotes || 0) + 1;
      return { ...r, upvotes: newUpvotes };
    }
    return r;
  });

  const supabase = getDbClient();
  if (supabase) {
    try {
      await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "community_mod_requests", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
    } catch (err) {
      console.error("upvoteModRequest error:", err);
    }
  }

  return newUpvotes;
}

export async function updateModRequestStatus(
  id: string,
  status: import("./types").ModRequestStatus,
  completedAppSlug?: string
): Promise<boolean> {
  const allRequests = await getModRequests();
  const updatedList = allRequests.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        status,
        ...(completedAppSlug ? { completed_app_slug: completedAppSlug } : {}),
      };
    }
    return r;
  });

  const supabase = getDbClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "community_mod_requests", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
      return !error;
    } catch (err) {
      console.error("updateModRequestStatus error:", err);
    }
  }

  return false;
}


export async function createApplicationReview(data: {
  applicationId: string;
  userName: string;
  rating: number;
  comment: string;
}): Promise<ApplicationReview | null> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data: inserted, error } = await supabase
        .from("application_reviews")
        .insert({
          application_id: data.applicationId,
          user_name: data.userName.trim(),
          rating: data.rating,
          comment: data.comment.trim(),
        })
        .select()
        .single();

      if (!error && inserted) {
        return inserted as ApplicationReview;
      }
      if (error) {
        console.error("createApplicationReview error:", error);
      }
    } catch (err) {
      console.error("createApplicationReview exception:", err);
    }
  }
  return null;
}
