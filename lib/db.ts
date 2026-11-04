import { createServerSupabaseClient } from "./supabase/server";
import {
  initialCategories,
  initialSiteSettings,
} from "./data/mock-data";
import {
  Application,
  AppCategory,
  ApplicationVersion,
  DownloadSource,
  SiteSettings,
  UserReport,
  DownloadEvent,
} from "./types";

// In-memory persistent state for real data
let memoryApps: Application[] = [];
let memoryCategories: AppCategory[] = [...initialCategories];
let memorySettings: SiteSettings = { ...initialSiteSettings };
let memoryReports: UserReport[] = [];
let memoryDownloads: DownloadEvent[] = [];

// Helper to get supabase client safely
function getSupabase() {
  try {
    return createServerSupabaseClient();
  } catch {
    return null;
  }
}

// ==========================================
// APPLICATIONS QUERIES
// ==========================================

export async function getApplications(options?: {
  categorySlug?: string;
  status?: string;
  search?: string;
  featured?: boolean;
  trending?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "newest" | "oldest" | "downloads" | "alphabetical";
}): Promise<{ applications: Application[]; total: number }> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      let query = supabase.from("applications").select("*, category:categories(*), versions:application_versions(*), screenshots(*)", { count: "exact" });

      if (options?.status) {
        query = query.eq("status", options.status);
      } else {
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
        query = query.or(`name.ilike.%${options.search}%,developer.ilike.%${options.search}%,package_name.ilike.%${options.search}%`);
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
        const apps = data.map((item: any) => ({
          ...item,
          latest_version: item.versions?.find((v: any) => v.is_latest) || item.versions?.[0],
        }));
        return { applications: apps, total: count || apps.length };
      }
    } catch {
      // Fallback to memory
    }
  }

  // Memory fallback logic
  let filtered = [...memoryApps];

  if (options?.status) {
    filtered = filtered.filter((a) => a.status === options.status);
  } else {
    filtered = filtered.filter((a) => a.status === "published");
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
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.developer.toLowerCase().includes(q) ||
        a.package_name.toLowerCase().includes(q) ||
        a.short_description.toLowerCase().includes(q)
    );
  }

  if (options?.sortBy === "oldest") {
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (options?.sortBy === "alphabetical") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (options?.sortBy === "downloads") {
    filtered.sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0));
  } else {
    // Newest
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const total = filtered.length;

  if (options?.limit) {
    const offset = options.offset || 0;
    filtered = filtered.slice(offset, offset + options.limit);
  }

  return { applications: filtered, total };
}

export async function getApplicationBySlug(slug: string): Promise<Application | null> {
  const supabase = getSupabase();

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
        .eq("slug", slug)
        .single();

      if (!error && data) {
        const latest = data.versions?.find((v: any) => v.is_latest) || data.versions?.[0];
        return {
          ...data,
          latest_version: latest,
          versions: data.versions,
        };
      }
    } catch {
      // Fallback
    }
  }

  const app = memoryApps.find((a) => a.slug === slug);
  return app || null;
}

export async function getCategories(): Promise<AppCategory[]> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  // Calculate actual app count per category dynamically
  return memoryCategories
    .filter((c) => c.is_active)
    .map((cat) => ({
      ...cat,
      app_count: memoryApps.filter(
        (a) => a.category_id === cat.id && a.status === "published"
      ).length,
    }));
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
  const totalApps = memoryApps.filter((a) => a.status === "published").length;
  const totalDownloads = memoryApps.reduce(
    (acc, app) => acc + (app.downloads_count || 0),
    memoryDownloads.length
  );
  const totalCategories = memoryCategories.filter((c) => c.is_active).length;
  const recentUpdates = memoryApps.filter(
    (a) => new Date(a.updated_at).getTime() > Date.now() - 30 * 86400000
  ).length;

  return {
    totalApps,
    totalDownloads,
    totalCategories,
    recentUpdates,
  };
}

export async function getAnalyticsChartData(days: number = 30) {
  // Generate real chart data points based on actual downloads or zero baseline
  const points: { date: string; downloads: number }[] = [];
  const now = new Date();

  const stepDays = days <= 7 ? 1 : days <= 30 ? 4 : 15;
  const numSteps = Math.ceil(days / stepDays);

  for (let i = numSteps - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepDays * 86400000);
    const dateLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Count actual recorded downloads matching this timeframe
    const countInWindow = memoryDownloads.filter((dl) => {
      const dlTime = new Date(dl.downloaded_at).getTime();
      const startTime = d.getTime() - stepDays * 86400000;
      const endTime = d.getTime();
      return dlTime >= startTime && dlTime <= endTime;
    }).length;

    points.push({
      date: dateLabel,
      downloads: countInWindow,
    });
  }

  return points;
}

// ==========================================
// ADMIN MUTATIONS
// ==========================================

export async function createApplication(data: Partial<Application> & { version?: any }): Promise<Application> {
  const newId = `app-${Date.now()}`;
  const category = memoryCategories.find((c) => c.id === data.category_id) || memoryCategories[0];
  
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
    rating: 5.0,
    reviews_count: 1,
    downloads_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latest_version: newVersion,
    versions: [newVersion],
    screenshots: (data.screenshots as any) || [],
  };

  memoryApps.unshift(newApp);
  return newApp;
}

export async function updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
  const index = memoryApps.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const current = memoryApps[index];
  const updated: Application = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.category_id && updates.category_id !== current.category_id) {
    const cat = memoryCategories.find((c) => c.id === updates.category_id);
    if (cat) updated.category = cat;
  }

  memoryApps[index] = updated;
  return updated;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const initialLen = memoryApps.length;
  memoryApps = memoryApps.filter((a) => a.id !== id);
  return memoryApps.length < initialLen;
}

export async function addApplicationVersion(appId: string, versionData: Partial<ApplicationVersion>): Promise<ApplicationVersion | null> {
  const app = memoryApps.find((a) => a.id === appId);
  if (!app) return null;

  const newVer: ApplicationVersion = {
    id: `ver-${Date.now()}`,
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
    created_at: new Date().toISOString(),
    download_sources: versionData.download_sources || [],
  };

  if (newVer.is_latest) {
    app.versions?.forEach((v) => (v.is_latest = false));
    app.latest_version = newVer;
  }

  if (!app.versions) app.versions = [];
  app.versions.unshift(newVer);
  app.updated_at = new Date().toISOString();

  return newVer;
}

export async function recordDownload(params: {
  application_id: string;
  version_id: string;
  download_source_id?: string;
  event_type?: "initiated" | "completed" | "mirror_click";
}): Promise<boolean> {
  const event: DownloadEvent = {
    id: `dl-${Date.now()}`,
    application_id: params.application_id,
    version_id: params.version_id,
    download_source_id: params.download_source_id,
    event_type: params.event_type || "initiated",
    downloaded_at: new Date().toISOString(),
  };

  memoryDownloads.push(event);

  const app = memoryApps.find((a) => a.id === params.application_id);
  if (app) {
    app.downloads_count = (app.downloads_count || 0) + 1;
  }

  return true;
}

export async function submitReport(report: {
  application_id?: string | null;
  report_type: any;
  email?: string | null;
  message: string;
}): Promise<UserReport> {
  let appName = undefined;
  if (report.application_id) {
    const app = memoryApps.find((a) => a.id === report.application_id);
    appName = app?.name;
  }

  const newReport: UserReport = {
    id: `rep-${Date.now()}`,
    application_id: report.application_id,
    application_name: appName,
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
  if (status && status !== "all") {
    return memoryReports.filter((r) => r.status === status);
  }
  return memoryReports;
}

export async function updateReportStatus(id: string, status: "pending" | "resolved" | "dismissed"): Promise<boolean> {
  const r = memoryReports.find((rep) => rep.id === id);
  if (r) {
    r.status = status;
    return true;
  }
  return false;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return memorySettings;
}

export async function updateSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
  memorySettings = {
    ...memorySettings,
    ...updates,
  };
  return memorySettings;
}
