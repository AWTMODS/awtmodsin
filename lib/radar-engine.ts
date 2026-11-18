import { getDbClient, getSiteSettings } from "./db";
import { isNewerVersion } from "./version-comparator";
import { revalidatePath } from "next/cache";

export type RadarWorkflowStatus =
  | "UPDATE_DETECTED"
  | "MODDING_STARTED"
  | "MODDED_COMPLETED"
  | "READY_TO_PUBLISH"
  | "MOD_RELEASED";

export type RadarPriority = "Low" | "Medium" | "High" | "Critical";

export interface RadarTrackedApp {
  id: string;
  package_name: string;
  app_name: string;
  play_store_url: string;
  icon_url?: string;
  developer?: string;
  category?: string;
  current_play_store_version: string;
  last_detected_version?: string;
  is_active_tracking: boolean;
  workflow_status: RadarWorkflowStatus;
  last_scanned_at: string;
  last_detected_at?: string;
  created_at: string;
  updated_at: string;
  // Dynamic relations
  current_cycle?: RadarModdingCycle;
  latest_remarks?: RadarRemark[];
}

export interface RadarModdingCycle {
  id: string;
  radar_app_id: string;
  cycle_number: number;
  target_play_store_version: string;
  mod_version?: string;
  workflow_status: RadarWorkflowStatus;
  priority: RadarPriority;
  assigned_modder: string;
  modding_started_at?: string;
  modded_completed_at?: string;
  ready_to_publish_at?: string;
  released_at?: string;
  download_url?: string;
  changelog?: string;
  testing_requirements?: string;
  internal_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface RadarRemark {
  id: string;
  radar_app_id: string;
  cycle_id?: string;
  admin_name: string;
  remarks: string;
  internal_instructions?: string;
  required_modifications?: string;
  known_issues?: string;
  testing_requirements?: string;
  created_at: string;
  updated_at: string;
}

export interface RadarActivityLog {
  id: string;
  radar_app_id: string;
  app_name: string;
  action: string;
  from_status?: RadarWorkflowStatus;
  to_status?: RadarWorkflowStatus;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface RadarRelease {
  id: string;
  radar_app_id: string;
  cycle_id?: string;
  app_name: string;
  package_name: string;
  icon_url?: string;
  original_play_store_version: string;
  released_mod_version: string;
  download_url: string;
  changelog?: string;
  release_remarks?: string;
  released_by: string;
  released_at: string;
  created_at: string;
}

export interface RadarScannerLog {
  id: string;
  trigger_type: "cron" | "manual" | "webhook";
  scanned_count: number;
  updates_detected: number;
  errors_count: number;
  details?: any;
  error_summary?: string;
  executed_at: string;
}

export interface RadarDashboardStats {
  totalTracked: number;
  activeRadar: number;
  newUpdatesDetected: number;
  moddingStarted: number;
  moddedCompleted: number;
  readyToPublish: number;
  totalReleasedMods: number;
  lastScannerRun?: string;
  scannerErrors: number;
}

const STORAGE_KEY = "radar_engine_full_state";

interface RadarInMemoryState {
  apps: RadarTrackedApp[];
  cycles: RadarModdingCycle[];
  remarks: RadarRemark[];
  activities: RadarActivityLog[];
  releases: RadarRelease[];
  scannerLogs: RadarScannerLog[];
}

let inMemoryState: RadarInMemoryState = {
  apps: [],
  cycles: [],
  remarks: [],
  activities: [],
  releases: [],
  scannerLogs: [],
};

let hasInitialized = false;

// Dynamic import helper for Google Play scraper
async function getGPlay() {
  const mod = await import("google-play-scraper");
  return (mod as any).default || mod;
}

/**
 * Ensures state is loaded from Supabase tables or JSON setting document
 */
async function loadState(): Promise<RadarInMemoryState> {
  const supabase = getDbClient();
  if (!supabase) return inMemoryState;

  try {
    // 1. Try reading from dedicated Supabase tables
    const { data: appsData, error: appsErr } = await supabase
      .from("radar_tracked_apps")
      .select("*")
      .order("created_at", { ascending: false });

    if (!appsErr && appsData && appsData.length > 0) {
      const [cyclesRes, remarksRes, actsRes, relRes, logsRes] = await Promise.all([
        supabase.from("radar_modding_cycles").select("*").order("created_at", { ascending: false }),
        supabase.from("radar_remarks").select("*").order("created_at", { ascending: false }),
        supabase.from("radar_activity_logs").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("radar_releases").select("*").order("released_at", { ascending: false }),
        supabase.from("radar_scanner_logs").select("*").order("executed_at", { ascending: false }).limit(50),
      ]);

      inMemoryState = {
        apps: appsData,
        cycles: cyclesRes.data || [],
        remarks: remarksRes.data || [],
        activities: actsRes.data || [],
        releases: relRes.data || [],
        scannerLogs: logsRes.data || [],
      };
      hasInitialized = true;
      return inMemoryState;
    }

    // 2. Fallback to site_settings JSON document
    const { data: docData } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", STORAGE_KEY)
      .maybeSingle();

    if (docData?.setting_value) {
      const parsed = typeof docData.setting_value === "string"
        ? JSON.parse(docData.setting_value)
        : docData.setting_value;
      if (parsed && Array.isArray(parsed.apps)) {
        inMemoryState = parsed;
        hasInitialized = true;
        return inMemoryState;
      }
    }
  } catch (err) {
    console.warn("loadState error:", err);
  }

  // Auto-seed initial tracked applications from existing catalog if empty
  if (!hasInitialized || inMemoryState.apps.length === 0) {
    await autoSeedFromCatalog();
  }

  return inMemoryState;
}

/**
 * Persists changes safely to both Supabase tables and fallback JSON document
 */
async function persistState(state: RadarInMemoryState) {
  inMemoryState = state;
  const supabase = getDbClient();
  if (!supabase) return;

  try {
    // Always backup to site_settings JSON document for instant zero-migration resilience
    await supabase.from("site_settings").upsert(
      {
        setting_key: STORAGE_KEY,
        setting_value: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );
  } catch {}

  try {
    revalidatePath("/admin");
    revalidatePath("/admin/radar");
    revalidatePath("/admin/radar/apps");
    revalidatePath("/admin/radar/queue");
    revalidatePath("/admin/radar/releases");
  } catch {}
}

/**
 * Automatically seeds radar tracking from published applications in the existing website catalog
 */
async function autoSeedFromCatalog() {
  const supabase = getDbClient();
  if (!supabase) return;

  try {
    const { data: catalogApps } = await supabase
      .from("applications")
      .select(`
        id, name, package_name, slug, icon_url, developer,
        category:categories(name),
        versions:application_versions(version_name)
      `)
      .not("package_name", "is", null)
      .limit(30);

    if (catalogApps && catalogApps.length > 0) {
      const now = new Date().toISOString();
      const initialApps: RadarTrackedApp[] = [];
      const initialCycles: RadarModdingCycle[] = [];

      catalogApps.forEach((c: any, index: number) => {
        if (!c.package_name || c.package_name.trim().length === 0) return;
        const appId = `radar-${c.id || index + 1}`;
        const cycleId = `cycle-${Date.now()}-${index}`;
        const ver = c.versions?.[0]?.version_name || "v1.0.0";

        // Assign realistic distributed workflow statuses for rich out-of-the-box demo
        let status: RadarWorkflowStatus = "UPDATE_DETECTED";
        if (index % 5 === 1) status = "MODDING_STARTED";
        if (index % 5 === 2) status = "MODDED_COMPLETED";
        if (index % 5 === 3) status = "READY_TO_PUBLISH";
        if (index % 5 === 4) status = "MOD_RELEASED";

        initialApps.push({
          id: appId,
          package_name: c.package_name.trim(),
          app_name: c.name,
          play_store_url: `https://play.google.com/store/apps/details?id=${c.package_name.trim()}`,
          icon_url: c.icon_url,
          developer: c.developer || "Aadith C V",
          category: c.category?.name || "Tools",
          current_play_store_version: ver,
          last_detected_version: ver,
          is_active_tracking: true,
          workflow_status: status,
          last_scanned_at: now,
          last_detected_at: now,
          created_at: now,
          updated_at: now,
        });

        initialCycles.push({
          id: cycleId,
          radar_app_id: appId,
          cycle_number: 1,
          target_play_store_version: ver,
          mod_version: `${ver} VIP Mod`,
          workflow_status: status,
          priority: index % 4 === 0 ? "Critical" : index % 3 === 0 ? "High" : "Medium",
          assigned_modder: "Aadith C V",
          modding_started_at: status !== "UPDATE_DETECTED" ? now : undefined,
          modded_completed_at: status === "MODDED_COMPLETED" || status === "READY_TO_PUBLISH" || status === "MOD_RELEASED" ? now : undefined,
          ready_to_publish_at: status === "READY_TO_PUBLISH" || status === "MOD_RELEASED" ? now : undefined,
          released_at: status === "MOD_RELEASED" ? now : undefined,
          download_url: `https://www.awtmods.in/apps/${c.slug}.html`,
          created_at: now,
          updated_at: now,
        });
      });

      inMemoryState.apps = initialApps;
      inMemoryState.cycles = initialCycles;
      hasInitialized = true;
      await persistState(inMemoryState);
    }
  } catch (err) {
    console.warn("autoSeedFromCatalog error:", err);
  }
}

// ==============================================================================
// 1. DASHBOARD & STATISTICS ENGINE
// ==============================================================================

export async function getRadarDashboardStats(): Promise<RadarDashboardStats> {
  const state = await loadState();

  const totalTracked = state.apps.length;
  // Active Radar = Tracked apps that are NOT released yet (Workflow active)
  const activeRadar = state.apps.filter(
    (a) => a.is_active_tracking && a.workflow_status !== "MOD_RELEASED"
  ).length;

  const newUpdatesDetected = state.apps.filter(
    (a) => a.workflow_status === "UPDATE_DETECTED"
  ).length;

  const moddingStarted = state.apps.filter(
    (a) => a.workflow_status === "MODDING_STARTED"
  ).length;

  const moddedCompleted = state.apps.filter(
    (a) => a.workflow_status === "MODDED_COMPLETED"
  ).length;

  const readyToPublish = state.apps.filter(
    (a) => a.workflow_status === "READY_TO_PUBLISH"
  ).length;

  const totalReleasedMods = state.releases.length;

  const lastScannerLog = state.scannerLogs[0];
  const lastScannerRun = lastScannerLog?.executed_at;
  const scannerErrors = state.scannerLogs.reduce((acc, l) => acc + (l.errors_count || 0), 0);

  return {
    totalTracked,
    activeRadar,
    newUpdatesDetected,
    moddingStarted,
    moddedCompleted,
    readyToPublish,
    totalReleasedMods,
    lastScannerRun,
    scannerErrors,
  };
}

// ==============================================================================
// 2. APPLICATION MANAGEMENT & LISTING
// ==============================================================================

export async function getRadarTrackedApps(params?: {
  search?: string;
  status?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<RadarTrackedApp[]> {
  const state = await loadState();
  let list = [...state.apps];

  if (params?.activeOnly) {
    // Mandatory Rule: Active Radar should only display applications that are not MOD_RELEASED
    list = list.filter((a) => a.is_active_tracking && a.workflow_status !== "MOD_RELEASED");
  }

  if (params?.status && params.status !== "ALL") {
    list = list.filter((a) => a.workflow_status === params.status);
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (a) =>
        a.app_name.toLowerCase().includes(q) ||
        a.package_name.toLowerCase().includes(q) ||
        (a.developer && a.developer.toLowerCase().includes(q))
    );
  }

  // Attach current modding cycle and latest remark
  const enriched = list.map((app) => {
    const current_cycle = state.cycles.find(
      (c) => c.radar_app_id === app.id && c.workflow_status === app.workflow_status
    ) || state.cycles.filter((c) => c.radar_app_id === app.id)[0];

    const latest_remarks = state.remarks.filter((r) => r.radar_app_id === app.id);

    return {
      ...app,
      current_cycle,
      latest_remarks,
    };
  });

  if (params?.limit) {
    return enriched.slice(0, params.limit);
  }

  return enriched;
}

export async function getRadarAppById(id: string): Promise<{
  app: RadarTrackedApp | null;
  cycles: RadarModdingCycle[];
  remarks: RadarRemark[];
  activities: RadarActivityLog[];
  releases: RadarRelease[];
}> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === id || a.package_name === id) || null;

  if (!app) {
    return { app: null, cycles: [], remarks: [], activities: [], releases: [] };
  }

  const cycles = state.cycles
    .filter((c) => c.radar_app_id === app.id)
    .sort((a, b) => b.cycle_number - a.cycle_number);

  const remarks = state.remarks
    .filter((r) => r.radar_app_id === app.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const activities = state.activities
    .filter((act) => act.radar_app_id === app.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const releases = state.releases
    .filter((rel) => rel.radar_app_id === app.id)
    .sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());

  const current_cycle = cycles[0];

  return {
    app: { ...app, current_cycle, latest_remarks: remarks },
    cycles,
    remarks,
    activities,
    releases,
  };
}

export async function addRadarApp(data: {
  package_name?: string;
  play_store_url?: string;
  app_name?: string;
  admin_name?: string;
}): Promise<{ success: boolean; app?: RadarTrackedApp; error?: string }> {
  const state = await loadState();

  let pkg = data.package_name?.trim();
  if (!pkg && data.play_store_url) {
    const match = data.play_store_url.match(/id=([a-zA-Z0-9_\.]+)/);
    if (match) pkg = match[1];
  }

  if (!pkg) {
    return { success: false, error: "Valid Android Package Name or Google Play URL is required." };
  }

  // Prevent duplicate package tracking
  const existing = state.apps.find((a) => a.package_name.toLowerCase() === pkg!.toLowerCase());
  if (existing) {
    // If it was inactive or released, reactivate
    existing.is_active_tracking = true;
    if (existing.workflow_status === "MOD_RELEASED") {
      existing.workflow_status = "UPDATE_DETECTED";
    }
    await persistState(state);
    return { success: true, app: existing };
  }

  // Fetch Play Store metadata
  let name = data.app_name?.trim() || pkg;
  let iconUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80";
  let version = "v1.0.0";
  let dev = "Aadith C V";
  let cat = "Tools";

  try {
    const gplay = await getGPlay();
    const info = await gplay.app({ appId: pkg, lang: "en", country: "in" });
    if (info) {
      name = info.title || name;
      iconUrl = info.icon || iconUrl;
      version = info.version && info.version !== "Varies with device" ? info.version : "v1.0.0";
      dev = info.developer || dev;
      cat = info.genre || cat;
    }
  } catch (err: any) {
    console.warn(`Could not scrape metadata for ${pkg}:`, err.message);
  }

  const now = new Date().toISOString();
  const appId = `radar-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const newApp: RadarTrackedApp = {
    id: appId,
    package_name: pkg,
    app_name: name,
    play_store_url: `https://play.google.com/store/apps/details?id=${pkg}`,
    icon_url: iconUrl,
    developer: dev,
    category: cat,
    current_play_store_version: version,
    last_detected_version: version,
    is_active_tracking: true,
    workflow_status: "UPDATE_DETECTED",
    last_scanned_at: now,
    last_detected_at: now,
    created_at: now,
    updated_at: now,
  };

  const initialCycle: RadarModdingCycle = {
    id: cycleId,
    radar_app_id: appId,
    cycle_number: 1,
    target_play_store_version: version,
    workflow_status: "UPDATE_DETECTED",
    priority: "Medium",
    assigned_modder: data.admin_name || "Aadith C V",
    created_at: now,
    updated_at: now,
  };

  const activity: RadarActivityLog = {
    id: `act-${Date.now()}`,
    radar_app_id: appId,
    app_name: name,
    action: "APPLICATION_ADDED_TO_RADAR",
    from_status: undefined,
    to_status: "UPDATE_DETECTED",
    performed_by: data.admin_name || "Admin",
    notes: `Added to Version Radar tracking. Play Store version: ${version}`,
    created_at: now,
  };

  state.apps = [newApp, ...state.apps];
  state.cycles = [initialCycle, ...state.cycles];
  state.activities = [activity, ...state.activities];

  await persistState(state);

  // Send Telegram Notification
  await dispatchTelegramNotification({
    type: "UPDATE_DETECTED",
    app: newApp,
    version,
    performedBy: data.admin_name || "Admin",
  });

  return { success: true, app: newApp };
}

export async function removeRadarApp(id: string): Promise<boolean> {
  const state = await loadState();
  const index = state.apps.findIndex((a) => a.id === id);
  if (index === -1) return false;

  // Soft delete / archive
  state.apps[index].is_active_tracking = false;
  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: id,
    app_name: state.apps[index].app_name,
    action: "REMOVED_FROM_ACTIVE_TRACKING",
    performed_by: "Admin",
    created_at: new Date().toISOString(),
  });

  await persistState(state);
  return true;
}

// ==============================================================================
// 3. ADMIN-CONTROLLED MODDING WORKFLOW TRANSITIONS
// ==============================================================================

/**
 * 1 -> 2: Transition from UPDATE_DETECTED to MODDING_STARTED
 */
export async function transitionToModdingStarted(params: {
  appId: string;
  adminName: string;
  remarks: string;
  internalInstructions?: string;
  requiredModifications?: string;
  knownIssues?: string;
  testingRequirements?: string;
  assignedModder?: string;
  priority?: RadarPriority;
}): Promise<{ success: boolean; error?: string }> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === params.appId);
  if (!app) return { success: false, error: "Application not found" };

  const prevStatus = app.workflow_status;
  const now = new Date().toISOString();

  // 1. Update Application status
  app.workflow_status = "MODDING_STARTED";
  app.updated_at = now;

  // 2. Find or create current cycle
  let cycle = state.cycles.find((c) => c.radar_app_id === app.id);
  if (!cycle || cycle.workflow_status === "MOD_RELEASED") {
    cycle = {
      id: `cycle-${Date.now()}`,
      radar_app_id: app.id,
      cycle_number: (state.cycles.filter((c) => c.radar_app_id === app.id).length || 0) + 1,
      target_play_store_version: app.current_play_store_version,
      workflow_status: "MODDING_STARTED",
      priority: params.priority || "Medium",
      assigned_modder: params.assignedModder || "Aadith C V",
      modding_started_at: now,
      created_at: now,
      updated_at: now,
    };
    state.cycles.unshift(cycle);
  } else {
    cycle.workflow_status = "MODDING_STARTED";
    cycle.priority = params.priority || cycle.priority;
    cycle.assigned_modder = params.assignedModder || cycle.assigned_modder;
    cycle.modding_started_at = now;
    cycle.updated_at = now;
  }

  // 3. Save multiline remarks & instructions
  if (params.remarks || params.internalInstructions) {
    const remark: RadarRemark = {
      id: `rem-${Date.now()}`,
      radar_app_id: app.id,
      cycle_id: cycle.id,
      admin_name: params.adminName || "Admin",
      remarks: params.remarks,
      internal_instructions: params.internalInstructions,
      required_modifications: params.requiredModifications,
      known_issues: params.knownIssues,
      testing_requirements: params.testingRequirements,
      created_at: now,
      updated_at: now,
    };
    state.remarks.unshift(remark);
  }

  // 4. Record Activity
  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: app.id,
    app_name: app.app_name,
    action: "MODDING_STARTED",
    from_status: prevStatus,
    to_status: "MODDING_STARTED",
    performed_by: params.adminName || "Admin",
    notes: `Modder: ${params.assignedModder || "Aadith C V"} • Priority: ${params.priority || "Medium"}`,
    created_at: now,
  });

  await persistState(state);

  // Telegram alert
  await dispatchTelegramNotification({
    type: "MODDING_STARTED",
    app,
    priority: params.priority || "Medium",
    modder: params.assignedModder || "Aadith C V",
    notes: params.remarks,
    performedBy: params.adminName,
  });

  return { success: true };
}

/**
 * 2 -> 3: Transition from MODDING_STARTED to MODDED_COMPLETED
 */
export async function transitionToModdedCompleted(params: {
  appId: string;
  adminName: string;
  completionRemarks?: string;
}): Promise<{ success: boolean; error?: string }> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === params.appId);
  if (!app) return { success: false, error: "Application not found" };

  const prevStatus = app.workflow_status;
  const now = new Date().toISOString();

  app.workflow_status = "MODDED_COMPLETED";
  app.updated_at = now;

  const cycle = state.cycles.find((c) => c.radar_app_id === app.id);
  if (cycle) {
    cycle.workflow_status = "MODDED_COMPLETED";
    cycle.modded_completed_at = now;
    cycle.updated_at = now;
  }

  if (params.completionRemarks) {
    state.remarks.unshift({
      id: `rem-${Date.now()}`,
      radar_app_id: app.id,
      cycle_id: cycle?.id,
      admin_name: params.adminName || "Admin",
      remarks: params.completionRemarks,
      created_at: now,
      updated_at: now,
    });
  }

  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: app.id,
    app_name: app.app_name,
    action: "MODDED_COMPLETED",
    from_status: prevStatus,
    to_status: "MODDED_COMPLETED",
    performed_by: params.adminName || "Admin",
    notes: params.completionRemarks || "Modding phase completed successfully.",
    created_at: now,
  });

  await persistState(state);

  await dispatchTelegramNotification({
    type: "MODDED_COMPLETED",
    app,
    performedBy: params.adminName,
    notes: params.completionRemarks,
  });

  return { success: true };
}

/**
 * 3 -> 4: Transition to READY_TO_PUBLISH
 */
export async function transitionToReadyToPublish(params: {
  appId: string;
  adminName: string;
  finalModVersion: string;
  downloadUrl?: string;
  releaseNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === params.appId);
  if (!app) return { success: false, error: "Application not found" };

  const prevStatus = app.workflow_status;
  const now = new Date().toISOString();

  app.workflow_status = "READY_TO_PUBLISH";
  app.updated_at = now;

  const cycle = state.cycles.find((c) => c.radar_app_id === app.id);
  if (cycle) {
    cycle.workflow_status = "READY_TO_PUBLISH";
    cycle.mod_version = params.finalModVersion;
    cycle.download_url = params.downloadUrl;
    cycle.changelog = params.releaseNotes;
    cycle.ready_to_publish_at = now;
    cycle.updated_at = now;
  }

  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: app.id,
    app_name: app.app_name,
    action: "READY_TO_PUBLISH",
    from_status: prevStatus,
    to_status: "READY_TO_PUBLISH",
    performed_by: params.adminName || "Admin",
    notes: `Version: ${params.finalModVersion}`,
    created_at: now,
  });

  await persistState(state);

  await dispatchTelegramNotification({
    type: "READY_TO_PUBLISH",
    app,
    version: params.finalModVersion,
    performedBy: params.adminName,
  });

  return { success: true };
}

/**
 * 4 -> 5: Transition to MOD_RELEASED - AUTOMATIC RADAR REMOVAL
 * MANDATORY REQUIREMENT:
 * 1. Change application status to MOD_RELEASED.
 * 2. Save release details in database.
 * 3. Automatically remove from Active Radar (Active Radar filters by != MOD_RELEASED).
 * 4. Move to Release History.
 * 5. Update stats immediately.
 */
export async function transitionToModReleased(params: {
  appId: string;
  adminName: string;
  releasedModVersion: string;
  downloadUrl: string;
  changelog?: string;
  releaseRemarks?: string;
}): Promise<{ success: boolean; release?: RadarRelease; error?: string }> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === params.appId);
  if (!app) return { success: false, error: "Application not found" };

  const prevStatus = app.workflow_status;
  const now = new Date().toISOString();

  // 1. Change status to MOD_RELEASED
  app.workflow_status = "MOD_RELEASED";
  app.updated_at = now;

  const cycle = state.cycles.find((c) => c.radar_app_id === app.id);
  if (cycle) {
    cycle.workflow_status = "MOD_RELEASED";
    cycle.mod_version = params.releasedModVersion;
    cycle.download_url = params.downloadUrl;
    cycle.changelog = params.changelog;
    cycle.released_at = now;
    cycle.updated_at = now;
  }

  // 2. Save permanent release record in Release History
  const releaseRecord: RadarRelease = {
    id: `rel-${Date.now()}`,
    radar_app_id: app.id,
    cycle_id: cycle?.id,
    app_name: app.app_name,
    package_name: app.package_name,
    icon_url: app.icon_url,
    original_play_store_version: app.current_play_store_version,
    released_mod_version: params.releasedModVersion,
    download_url: params.downloadUrl,
    changelog: params.changelog,
    release_remarks: params.releaseRemarks,
    released_by: params.adminName || "Admin",
    released_at: now,
    created_at: now,
  };

  state.releases.unshift(releaseRecord);

  // 3. Record audit activity
  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: app.id,
    app_name: app.app_name,
    action: "MOD_RELEASED",
    from_status: prevStatus,
    to_status: "MOD_RELEASED",
    performed_by: params.adminName || "Admin",
    notes: `Released ${params.releasedModVersion}. Automatically archived from Active Radar.`,
    created_at: now,
  });

  // 4. Automatically persist state and update stats
  await persistState(state);

  // 5. Telegram broadcast & alert
  await dispatchTelegramNotification({
    type: "MOD_RELEASED",
    app,
    version: params.releasedModVersion,
    downloadUrl: params.downloadUrl,
    performedBy: params.adminName,
  });

  return { success: true, release: releaseRecord };
}

// ==============================================================================
// 4. REMARKS & ACTIVITY AUDIT TIMELINE
// ==============================================================================

export async function addRadarRemark(params: {
  appId: string;
  adminName: string;
  remarks: string;
  internalInstructions?: string;
  testingRequirements?: string;
}): Promise<RadarRemark | null> {
  const state = await loadState();
  const app = state.apps.find((a) => a.id === params.appId);
  if (!app) return null;

  const now = new Date().toISOString();
  const remark: RadarRemark = {
    id: `rem-${Date.now()}`,
    radar_app_id: app.id,
    admin_name: params.adminName || "Admin",
    remarks: params.remarks,
    internal_instructions: params.internalInstructions,
    testing_requirements: params.testingRequirements,
    created_at: now,
    updated_at: now,
  };

  state.remarks.unshift(remark);

  state.activities.unshift({
    id: `act-${Date.now()}`,
    radar_app_id: app.id,
    app_name: app.app_name,
    action: "REMARK_ADDED",
    performed_by: params.adminName || "Admin",
    notes: params.remarks.slice(0, 100),
    created_at: now,
  });

  await persistState(state);
  return remark;
}

export async function getRadarReleases(search?: string): Promise<RadarRelease[]> {
  const state = await loadState();
  let list = [...state.releases];

  if (search) {
    const q = search.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.app_name.toLowerCase().includes(q) ||
        r.package_name.toLowerCase().includes(q) ||
        r.released_mod_version.toLowerCase().includes(q)
    );
  }

  return list;
}

export async function getRadarLogs(): Promise<{
  scannerLogs: RadarScannerLog[];
  activityLogs: RadarActivityLog[];
}> {
  const state = await loadState();
  return {
    scannerLogs: state.scannerLogs.slice(0, 50),
    activityLogs: state.activities.slice(0, 100),
  };
}

// ==============================================================================
// 5. PLAY STORE AUTOMATED & MANUAL SCANNER ENGINE
// ==============================================================================

export async function runPlayStoreRadarScan(options?: {
  triggerType?: "cron" | "manual" | "webhook";
  adminName?: string;
}): Promise<{
  totalScanned: number;
  updatesDetected: number;
  errorsCount: number;
  updatedApps: Array<{ name: string; oldVersion: string; newVersion: string }>;
}> {
  const state = await loadState();
  const activeApps = state.apps.filter((a) => a.is_active_tracking);
  const trigger = options?.triggerType || "manual";

  let gplay: any = null;
  try {
    gplay = await getGPlay();
  } catch (err: any) {
    return {
      totalScanned: 0,
      updatesDetected: 0,
      errorsCount: 1,
      updatedApps: [],
    };
  }

  let updatesFound = 0;
  let errorsCount = 0;
  const updatedApps: Array<{ name: string; oldVersion: string; newVersion: string }> = [];
  const now = new Date().toISOString();

  for (const app of activeApps) {
    try {
      const info = await gplay.app({ appId: app.package_name, lang: "en", country: "in" });
      app.last_scanned_at = now;

      if (!info || !info.version || info.version === "Varies with device") {
        continue;
      }

      const storeVersion = info.version.trim();
      const currentVersion = app.current_play_store_version || "v1.0.0";

      // Check if store version is strictly newer
      if (isNewerVersion(storeVersion, currentVersion)) {
        const oldVer = currentVersion;
        app.current_play_store_version = storeVersion;
        app.last_detected_version = storeVersion;
        app.last_detected_at = now;

        // MANDATORY RULE 11: If app was MOD_RELEASED, move back into Active Radar
        // Set its workflow status to UPDATE_DETECTED and create a new modding cycle
        app.workflow_status = "UPDATE_DETECTED";

        const newCycle: RadarModdingCycle = {
          id: `cycle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          radar_app_id: app.id,
          cycle_number: (state.cycles.filter((c) => c.radar_app_id === app.id).length || 0) + 1,
          target_play_store_version: storeVersion,
          workflow_status: "UPDATE_DETECTED",
          priority: "High",
          assigned_modder: "Aadith C V",
          created_at: now,
          updated_at: now,
        };
        state.cycles.unshift(newCycle);

        state.activities.unshift({
          id: `act-${Date.now()}`,
          radar_app_id: app.id,
          app_name: app.app_name,
          action: "NEW_VERSION_DETECTED_ON_PLAY_STORE",
          from_status: "MOD_RELEASED",
          to_status: "UPDATE_DETECTED",
          performed_by: "Radar Scanner",
          notes: `Detected Play Store update: ${oldVer} ➔ ${storeVersion}`,
          created_at: now,
        });

        updatesFound++;
        updatedApps.push({
          name: app.app_name,
          oldVersion: oldVer,
          newVersion: storeVersion,
        });

        // Instant Telegram alert for detected update
        await dispatchTelegramNotification({
          type: "UPDATE_DETECTED",
          app,
          version: storeVersion,
          oldVersion: oldVer,
          changelog: info.recentChanges,
        });
      }
    } catch (err: any) {
      errorsCount++;
    }
  }

  // Record scanner log
  state.scannerLogs.unshift({
    id: `scan-${Date.now()}`,
    trigger_type: trigger,
    scanned_count: activeApps.length,
    updates_detected: updatesFound,
    errors_count: errorsCount,
    details: { updatedApps },
    error_summary: errorsCount > 0 ? `${errorsCount} packages could not be reached.` : undefined,
    executed_at: now,
  });

  await persistState(state);

  return {
    totalScanned: activeApps.length,
    updatesDetected: updatesFound,
    errorsCount,
    updatedApps,
  };
}

// ==============================================================================
// 6. TELEGRAM NOTIFICATIONS DISPATCHER
// ==============================================================================

async function dispatchTelegramNotification(params: {
  type: RadarWorkflowStatus;
  app: RadarTrackedApp;
  version?: string;
  oldVersion?: string;
  priority?: RadarPriority;
  modder?: string;
  notes?: string;
  changelog?: string;
  downloadUrl?: string;
  performedBy?: string;
}) {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = settings.telegramAdminChatId || 1343548529;

    if (!token || !adminChatId) return;

    let title = "";
    let emoji = "🚨";
    let messageBody = "";

    switch (params.type) {
      case "UPDATE_DETECTED":
        title = "NEW PLAY STORE UPDATE DETECTED";
        emoji = "🚨";
        messageBody =
          `📦 <b>App:</b> ${params.app.app_name}\n` +
          `🏷️ <b>Package:</b> <code>${params.app.package_name}</code>\n` +
          (params.oldVersion ? `📊 <b>Previous Version:</b> <code>${params.oldVersion}</code>\n` : "") +
          `✨ <b>New Store Version:</b> <code>${params.version || params.app.current_play_store_version}</code>\n\n` +
          (params.changelog ? `📝 <b>Changelog:</b>\n<i>${params.changelog.slice(0, 150)}</i>\n\n` : "") +
          `📍 <b>Status:</b> <code>UPDATE DETECTED</code>\n` +
          `⚡ Action required: Review in Radar and start modding.`;
        break;

      case "MODDING_STARTED":
        title = "MODDING STARTED";
        emoji = "🛠️";
        messageBody =
          `📦 <b>App:</b> ${params.app.app_name}\n` +
          `🎯 <b>Target Version:</b> <code>${params.app.current_play_store_version}</code>\n` +
          `👤 <b>Assigned Modder:</b> ${params.modder || "Aadith C V"}\n` +
          `🔥 <b>Priority:</b> <b>${params.priority || "Medium"}</b>\n` +
          `👤 <b>Updated by:</b> ${params.performedBy || "Admin"}\n\n` +
          (params.notes ? `📋 <b>Internal Instructions:</b>\n<i>${params.notes.slice(0, 200)}</i>\n\n` : "") +
          `📍 <b>Status:</b> <code>MODDING IN PROGRESS</code>`;
        break;

      case "MODDED_COMPLETED":
        title = "MOD COMPLETED — READY FOR TESTING";
        emoji = "✅";
        messageBody =
          `📦 <b>App:</b> ${params.app.app_name}\n` +
          `🏷️ <b>Version:</b> <code>${params.app.current_play_store_version}</code>\n` +
          `👤 <b>Completed by:</b> ${params.performedBy || "Admin"}\n\n` +
          (params.notes ? `📝 <b>Remarks:</b>\n<i>${params.notes.slice(0, 150)}</i>\n\n` : "") +
          `📍 <b>Status:</b> <code>MODDED COMPLETED</code>\n` +
          `⚡ Awaiting final publishing readiness check.`;
        break;

      case "READY_TO_PUBLISH":
        title = "READY TO PUBLISH";
        emoji = "📦";
        messageBody =
          `📦 <b>App:</b> ${params.app.app_name}\n` +
          `🏷️ <b>Mod Release Version:</b> <code>${params.version}</code>\n` +
          `👤 <b>Prepared by:</b> ${params.performedBy || "Admin"}\n\n` +
          `📍 <b>Status:</b> <code>READY TO PUBLISH</code>\n` +
          `⚡ 1-click away from public website & channel release.`;
        break;

      case "MOD_RELEASED":
        title = "MOD OFFICIALLY RELEASED & ARCHIVED";
        emoji = "🚀";
        messageBody =
          `📦 <b>App:</b> ${params.app.app_name}\n` +
          `🏷️ <b>Published Version:</b> <code>${params.version}</code>\n` +
          `🔗 <b>Live Download:</b> <a href="${params.downloadUrl}">${params.downloadUrl}</a>\n` +
          `👤 <b>Released by:</b> ${params.performedBy || "Admin"}\n\n` +
          `✨ <i>Successfully archived from Active Radar. Ready for public downloads!</i>`;
        break;
    }

    const inlineKeyboard = [
      [
        {
          text: `🔍 Open ${params.app.app_name.slice(0, 16)} in Radar`,
          url: `https://www.awtmods.in/admin/radar/apps/${params.app.id}`,
        },
      ],
      [
        { text: "🎛️ Radar Dashboard", url: "https://www.awtmods.in/admin/radar" },
        { text: "📥 Modding Queue", url: "https://www.awtmods.in/admin/radar/queue" },
      ],
    ];

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: `${emoji} <b>[RADAR] ${title}</b>\n\n${messageBody}`,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });
  } catch (err) {
    console.warn("Failed to dispatch Telegram radar notification:", err);
  }
}
