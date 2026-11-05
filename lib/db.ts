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

export function invalidateDbCache() {
  cachedCategories = null;
  cachedSettings = null;
  cachedStats = null;
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
        return { applications: apps, total: count || apps.length };
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
  const supabase = getDbClient();
  const cleanSlug = slug ? slug.replace(/\.html$/i, "").trim() : "";
  const legacyAliases: Record<string, string> = {
    "spotify-premium-mod-1793814592151": "spotify-premium",
    "minecraft-pocket-edition-1793815123541": "minecraft-mod-apk",
  };
  const targetSlug = legacyAliases[cleanSlug] || cleanSlug;

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

        return {
          ...data,
          latest_version: latest,
          versions: data.versions,
          downloads_count: dlCount || 0,
        };
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

        return {
          ...data,
          latest_version: latest,
          versions: data.versions,
          downloads_count: dlCount || 0,
        };
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
  const { applications } = await getApplications({ trending: true, limit: 6 });
  return applications;
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

export async function createApplication(
  data: Partial<Application> & { version?: any }
): Promise<Application> {
  invalidateDbCache();
  const supabase = getDbClient();

  if (supabase) {
    try {
      const { data: result, error } = await supabase.rpc(
        "admin_save_application",
        {
          p_app: data,
        }
      );

      if (!error && result?.success && result?.app) {
        // Also keep memory updated as local cache
        memoryApps.unshift(result.app);
        return result.app;
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
    memoryCategories.find((c) => c.id === data.category_id) || memoryCategories[0];

  const newVersion: ApplicationVersion = {
    id: `ver-${Date.now()}`,
    application_id: newId,
    version_name: data.version?.version_name || "v1.0.0",
    version_code: data.version?.version_code || 1,
    file_size: data.version?.file_size || "50 MB",
    architecture: data.version?.architecture || "arm64-v8a",
    android_requirement: data.version?.android_requirement || "Android 7.0+",
    sha256: data.version?.sha256 || null,
    release_notes: data.version?.release_notes || "Initial release",
    is_latest: true,
    status: "published",
    created_at: new Date().toISOString(),
    download_sources: data.version?.download_sources || [],
  };

  const newApp: Application = {
    id: newId,
    name: data.name || "Untitled App",
    slug: data.slug || `app-${Date.now()}`,
    package_name: data.package_name || "com.awtmods.app",
    developer: data.developer || "AWTMods Team",
    category_id: category.id,
    category,
    short_description: data.short_description || "",
    description: data.description || "",
    icon_url: data.icon_url || "/icons/default-app.png",
    banner_url: data.banner_url || null,
    android_requirement: data.android_requirement || "Android 7.0+",
    is_featured: !!data.is_featured,
    is_trending: !!data.is_trending,
    status: data.status || "published",
    rating: 0,
    reviews_count: 0,
    downloads_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latest_version: newVersion,
    versions: [newVersion],
    screenshots: (data.screenshots as any) || [],
    mod_features: data.mod_features || [],
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

  if (supabase) {
    try {
      const { data: result, error } = await supabase.rpc(
        "admin_save_application",
        {
          p_app: { id, ...updates },
        }
      );

      if (!error && result?.success && result?.app) {
        return result.app;
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
          file_size: versionData.file_size || "50 MB",
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
  const supabase = getDbClient();

  if (supabase) {
    try {
      for (const [key, value] of Object.entries(updates)) {
        await supabase
          .from("site_settings")
          .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
      }
    } catch {
      // Fallback
    }
  }

  memorySettings = {
    ...memorySettings,
    ...updates,
  };
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
