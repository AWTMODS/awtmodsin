"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Application, AppCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber, getAppUrl } from "@/lib/utils";
import {
  Search,
  Filter,
  PlusCircle,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  Sparkles,
  Zap,
  Loader2,
  X,
  RefreshCw,
  Radio,
  Play,
} from "lucide-react";
import { toast } from "sonner";

interface AppsTableProps {
  initialApps: Application[];
  categories: AppCategory[];
  defaultStatus?: string;
  defaultType?: string;
}

function isPcApp(app: Application): boolean {
  return (app as any).platform === "pc" || app.category?.slug === "pc-software";
}

function isGameApp(app: Application): boolean {
  if (isPcApp(app)) return false;
  const catSlug = app.category?.slug?.toLowerCase() || "";
  const catName = app.category?.name?.toLowerCase() || "";
  const name = app.name.toLowerCase();
  const pkg = (app.package_name || "").toLowerCase();
  return (
    catSlug === "games" ||
    catName.includes("game") ||
    name.includes("game") ||
    pkg.includes("game")
  );
}

export function AppsTable({
  initialApps,
  categories,
  defaultStatus = "",
  defaultType = "apps",
}: AppsTableProps) {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startingAppId, setStartingAppId] = useState<string | null>(null);
  const [startedModdingIds, setStartedModdingIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const resolvedDefaultType: "apps" | "games" | "pc" =
    defaultType === "games" || defaultType === "pc" ? defaultType : "apps";
  const [typeFilter, setTypeFilter] = useState<"apps" | "games" | "pc" | "duplicates">(
    resolvedDefaultType
  );

  useEffect(() => {
    setTypeFilter(resolvedDefaultType);
  }, [resolvedDefaultType]);

  // Sync state whenever initialApps changes from server refresh
  useEffect(() => {
    setApps(initialApps);
  }, [initialApps]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/apps", { cache: "no-store" });
      const data = await res.json();
      if (data.applications && Array.isArray(data.applications)) {
        setApps(data.applications);
        toast.success(`Refreshed! Loaded ${data.applications.length} applications.`);
      }
    } catch {
      router.refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Play Store Version Radar States
  const [radarUpdates, setRadarUpdates] = useState<Record<string, any>>({});
  const [isScanningRadar, setIsScanningRadar] = useState(false);

  const loadRadarState = async () => {
    try {
      const [checkRes, queueRes] = await Promise.all([
        fetch("/api/admin/radar/check", { cache: "no-store" }),
        fetch("/api/admin/radar/apps?activeOnly=true", { cache: "no-store" }),
      ]);
      const checkData = await checkRes.json().catch(() => null);
      if (checkData?.radar?.updates) {
        setRadarUpdates(checkData.radar.updates);
      }
      const queueData = await queueRes.json().catch(() => null);
      if (Array.isArray(queueData?.apps)) {
        const queued: Record<string, boolean> = {};
        for (const rApp of queueData.apps) {
          if (
            rApp.workflow_status === "MODDING_STARTED" ||
            rApp.workflow_status === "MODDED_COMPLETED" ||
            rApp.workflow_status === "READY_TO_PUBLISH"
          ) {
            const webId = rApp.website_app_id || String(rApp.id || "").replace(/^radar-/, "");
            if (webId) queued[webId] = true;
          }
        }
        setStartedModdingIds((prev) => ({ ...queued, ...prev }));
      }
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    loadRadarState();
    const onDbChange = () => {
      loadRadarState();
    };
    window.addEventListener("awtmods:db-change", onDbChange);
    return () => {
      window.removeEventListener("awtmods:db-change", onDbChange);
    };
  }, []);

  const handleRunRadar = async () => {
    setIsScanningRadar(true);
    toast.info("📡 Scanning Google Play Store for new updates...");
    try {
      const res = await fetch("/api/admin/radar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyTelegram: true }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.updatesFound > 0) {
          toast.success(`🚀 Radar Found ${data.updatesFound} updates! Bot alerts dispatched.`);
        } else {
          toast.success("✅ All applications are up-to-date with Google Play!");
        }
        // Refresh radar state
        const stateRes = await fetch("/api/admin/radar/check", { cache: "no-store" });
        const stateData = await stateRes.json();
        if (stateData.radar?.updates) {
          setRadarUpdates(stateData.radar.updates);
        }
      } else {
        toast.error(data.error || "Radar scan failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan radar");
    } finally {
      setIsScanningRadar(false);
    }
  };

  // Auto-Generate Quick Modal States
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickType, setQuickType] = useState<"apps" | "games" | "pc">("apps");
  const [quickStatus, setQuickStatus] = useState<"published" | "draft">("published");
  const [quickLoading, setQuickLoading] = useState(false);

  // Morphe Bulk Import Modal States
  const [showMorpheModal, setShowMorpheModal] = useState(false);
  const [morpheNamesText, setMorpheNamesText] = useState("");
  const [morpheStatus, setMorpheStatus] = useState<"draft" | "published">("draft");
  const [morpheLoading, setMorpheLoading] = useState(false);
  const [morpheSummary, setMorpheSummary] = useState<{
    createdCount: number;
    skipped: { query: string; packageName: string; reason: string }[];
    notFound: string[];
  } | null>(null);

  const handleMorpheImport = async () => {
    const names = morpheNamesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      toast.error("Please enter at least one app name (one per line)");
      return;
    }
    setMorpheLoading(true);
    setMorpheSummary(null);
    try {
      const res = await fetch("/api/admin/morphe-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names, status: morpheStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import from Morphe");
      }

      if (Array.isArray(data.created) && data.created.length > 0) {
        setApps((prev) => [...data.created, ...prev]);
      }

      setMorpheSummary({
        createdCount: data.created?.length || 0,
        skipped: data.skipped || [],
        notFound: data.notFound || [],
      });

      toast.success(
        `✨ Morphe Import: ${data.created?.length || 0} created, ${data.skipped?.length || 0} skipped, ${data.notFound?.length || 0} not found.`
      );
    } catch (err: any) {
      toast.error(err.message || "Morphe import failed");
    } finally {
      setMorpheLoading(false);
    }
  };

  const handleQuickCreate = async () => {
    const q = quickQuery.trim();
    if (!q) {
      toast.error("Please enter an application name");
      return;
    }
    setQuickLoading(true);
    try {
      const res = await fetch("/api/admin/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          platform: quickType === "pc" ? "pc" : "android",
          categorySlug: quickType === "games" ? "games" : quickType === "pc" ? "pc-software" : undefined,
          createImmediately: true,
          status: quickStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.app) {
        throw new Error(data.error || "Failed to auto-create application");
      }

      setApps((prev) => [data.app, ...prev]);
      setShowAutoModal(false);
      setQuickQuery("");
      toast.success(
        `✨ Successfully created "${data.app.name}" (${quickStatus})!`,
        {
          action: {
            label: "Edit Post",
            onClick: () => router.push(`/admin/apps/${data.app.id}/edit`),
          },
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-create app");
    } finally {
      setQuickLoading(false);
    }
  };

  // Scope apps to the current section (Android Apps, Android Games, or PC Software)
  const sectionApps = useMemo(() => {
    return apps.filter((app) => {
      if (resolvedDefaultType === "pc") return isPcApp(app);
      if (resolvedDefaultType === "games") return isGameApp(app);
      return !isPcApp(app) && !isGameApp(app);
    });
  }, [apps, resolvedDefaultType]);

  // Detect duplicate packages within the current section
  const duplicatePackages = useMemo(() => {
    const pkgCounts = new Map<string, number>();
    for (const app of sectionApps) {
      const p = app.package_name?.trim().toLowerCase();
      if (p) pkgCounts.set(p, (pkgCounts.get(p) || 0) + 1);
    }
    const dups = new Set<string>();
    pkgCounts.forEach((count, pkg) => {
      if (count > 1) dups.add(pkg);
    });
    return dups;
  }, [sectionApps]);

  const code1Count = sectionApps.filter((app) => app.latest_version?.version_code === 1).length;

  const filteredApps = sectionApps.filter((app) => {
    const matchesSearch =
      !search ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.developer.toLowerCase().includes(search.toLowerCase()) ||
      (app.package_name || "").toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      !selectedCategory || app.category_id === selectedCategory;

    const matchesStatus =
      !selectedStatus ||
      (selectedStatus === "radar_updates"
        ? !!radarUpdates[app.id]
        : selectedStatus === "code_1"
        ? app.latest_version?.version_code === 1
        : app.status === selectedStatus);

    const matchesType =
      typeFilter === "duplicates"
        ? duplicatePackages.has((app.package_name || "").trim().toLowerCase())
        : true;

    return matchesSearch && matchesCategory && matchesStatus && matchesType;
  });

  // When viewing duplicates, sort them side-by-side grouped by package name
  const displayApps = useMemo(() => {
    if (typeFilter === "duplicates") {
      return [...filteredApps].sort((a, b) => {
        const pkgA = (a.package_name || "").toLowerCase();
        const pkgB = (b.package_name || "").toLowerCase();
        if (pkgA !== pkgB) return pkgA.localeCompare(pkgB);
        const codeA = a.latest_version?.version_code || 0;
        const codeB = b.latest_version?.version_code || 0;
        return codeB - codeA;
      });
    }
    return filteredApps;
  }, [filteredApps, typeFilter]);

  const handleStartModding = async (app: Application) => {
    // Optimistic UI: mark as started immediately
    setStartedModdingIds((prev) => ({ ...prev, [app.id]: true }));
    setStartingAppId(app.id);
    try {
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_modding",
          appId: `radar-${app.id}`,
          priority: "High",
          remarks: `Release update initiated from Apps Table (version: ${app.latest_version?.version_name || "v1.0"}, code: ${app.latest_version?.version_code ?? 1})`,
          adminName: "Aadith C V",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start modding");

      toast.success(`🚀 Modding started for ${app.name}! Added to Modding Queue.`, {
        action: {
          label: "Open Queue",
          onClick: () => router.push("/admin/radar/queue"),
        },
      });
    } catch (err: any) {
      setStartedModdingIds((prev) => ({ ...prev, [app.id]: false }));
      toast.error(err.message || "Failed to start modding");
    } finally {
      setStartingAppId(null);
    }
  };

  const handleToggleStatus = async (app: Application) => {
    const newStatus = app.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
        );
        toast.success(`App status changed to ${newStatus}`);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFeatured = async (app: Application) => {
    const newFeatured = !app.is_featured;
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: newFeatured }),
      });
      if (res.ok) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === app.id ? { ...a, is_featured: newFeatured } : a
          )
        );
        toast.success(
          newFeatured ? "Marked as Featured" : "Removed from Featured"
        );
      }
    } catch {
      toast.error("Failed to update featured flag");
    }
  };

  const handleDelete = async (app: Application) => {
    if (!confirm(`Are you sure you want to permanently delete "${app.name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== app.id));
        toast.success(`Deleted ${app.name}`);
      }
    } catch {
      toast.error("Failed to delete application");
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Tab & Duplicates */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/60 border border-border overflow-x-auto scrollbar-none [scrollbar-width:none]">
        {resolvedDefaultType === "apps" && (
          <button
            type="button"
            onClick={() => setTypeFilter("apps")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              typeFilter === "apps"
                ? "bg-card text-emerald-500 shadow-xs border border-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>📱 Android Apps</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
              {sectionApps.length}
            </span>
          </button>
        )}

        {resolvedDefaultType === "games" && (
          <button
            type="button"
            onClick={() => setTypeFilter("games")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              typeFilter === "games"
                ? "bg-card text-amber-500 shadow-xs border border-amber-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>🎮 Android Games</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold">
              {sectionApps.length}
            </span>
          </button>
        )}

        {resolvedDefaultType === "pc" && (
          <button
            type="button"
            onClick={() => setTypeFilter("pc")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              typeFilter === "pc"
                ? "bg-card text-blue-500 shadow-xs border border-blue-500/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>💻 PC Software</span>
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-bold">
              {sectionApps.length}
            </span>
          </button>
        )}

        {duplicatePackages.size > 0 && (
          <button
            type="button"
            onClick={() => setTypeFilter("duplicates")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              typeFilter === "duplicates"
                ? "bg-rose-500/20 text-rose-400 shadow-xs border border-rose-500/40"
                : "text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <span>⚠️ Duplicates</span>
            <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold">
              {duplicatePackages.size} packages
            </span>
          </button>
        )}
      </div>

      {/* Search, Filter & Action Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search apps by name, developer, package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>

        {/* Filter Dropdowns & Action Buttons */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* Category & Status Filters */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full xl:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none truncate"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none truncate"
            >
              <option value="">All Statuses ({sectionApps.length})</option>
              {code1Count > 0 && (
                <option value="code_1" className="text-amber-500 font-bold">
                  ⚠️ Code: 1 (Needs Release) ({code1Count})
                </option>
              )}
              {Object.keys(radarUpdates).length > 0 && (
                <option value="radar_updates" className="text-amber-500 font-bold">
                  🚀 Play Store Updates ({Object.keys(radarUpdates).length})
                </option>
              )}
              <option value="published">
                Published ({sectionApps.filter((a) => a.status === "published").length})
              </option>
              <option value="draft">
                Draft ({sectionApps.filter((a) => a.status === "draft").length})
              </option>
              {sectionApps.some((a) => a.status === "archived") && (
                <option value="archived">
                  Archived ({sectionApps.filter((a) => a.status === "archived").length})
                </option>
              )}
            </select>
          </div>

          {/* Action Buttons: Neatly arranged on mobile, never cut off */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full xl:w-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="w-full sm:w-auto rounded-xl gap-1.5 font-bold border-border hover:bg-muted shrink-0 shadow-2xs"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={isScanningRadar}
              onClick={handleRunRadar}
              className="w-full sm:w-auto rounded-xl gap-1.5 font-bold border-cyan-500/30 bg-cyan-500/5 text-cyan-500 hover:bg-cyan-500/10 shrink-0 shadow-2xs"
            >
              <Radio className={`h-4 w-4 ${isScanningRadar ? "animate-spin text-cyan-400" : ""}`} />
              <span>{isScanningRadar ? "Scanning..." : "Play Store Radar"}</span>
              {Object.keys(radarUpdates).length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-cyan-500 text-black text-[10px] font-extrabold rounded-full">
                  {Object.keys(radarUpdates).length}
                </span>
              )}
            </Button>

            {code1Count > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelectedStatus(selectedStatus === "code_1" ? "" : "code_1")
                }
                className={`w-full sm:w-auto rounded-xl gap-1.5 font-bold shrink-0 shadow-2xs ${
                  selectedStatus === "code_1"
                    ? "border-amber-500 bg-amber-500 text-black hover:bg-amber-400"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
                }`}
              >
                <span>Code: 1</span>
                <span
                  className={`ml-0.5 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                    selectedStatus === "code_1"
                      ? "bg-black text-amber-400"
                      : "bg-amber-500 text-black"
                  }`}
                >
                  {code1Count}
                </span>
              </Button>
            )}

            <Link href="/admin/versions" prefetch={true} className="w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto rounded-xl gap-1.5 font-bold border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 shrink-0 shadow-2xs"
              >
                <Zap className="h-4 w-4" />
                <span>Fast Update</span>
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMorpheSummary(null);
                setShowMorpheModal(true);
              }}
              className="w-full sm:w-auto rounded-xl gap-1.5 font-bold border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 shrink-0 shadow-2xs"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Morphe Import</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAutoModal(true)}
              className="w-full sm:w-auto rounded-xl gap-1.5 font-bold border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shrink-0 shadow-2xs"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Auto-Create</span>
            </Button>

            <Link href="/admin/apps/new" prefetch={true} className="col-span-2 sm:col-span-1 w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto rounded-xl gap-1.5 font-semibold shrink-0">
                <PlusCircle className="h-4 w-4" />
                <span>Add New App</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Callout */}
      {typeFilter === "duplicates" && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-foreground">
                Duplicate Posts Detected ({duplicatePackages.size} packages, {displayApps.length} total posts)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The posts are grouped side-by-side by package name. Compare the version codes below and click the red trash can icon to delete older or redundant posts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTypeFilter(resolvedDefaultType)}
            className="text-xs font-bold underline shrink-0 hover:text-rose-300 transition-colors"
          >
            Show All
          </button>
        </div>
      )}

      {/* Applications Data Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Downloads</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No applications found matching criteria.
                  </td>
                </tr>
              ) : (
                displayApps.map((app) => {
                  const version = app.latest_version?.version_name || "v1.0";
                  const versionCode = app.latest_version?.version_code;
                  const size = app.latest_version?.file_size || "50 MB";
                  const isDuplicatePkg = duplicatePackages.has((app.package_name || "").trim().toLowerCase());

                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isDuplicatePkg && typeFilter === "duplicates" ? "bg-rose-500/[0.04]" : ""
                      }`}
                    >
                      {/* App Icon + Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary flex items-center justify-center font-bold text-xs text-foreground">
                            {app.icon_url && (
                              <img
                                src={app.icon_url}
                                alt={app.name}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            )}
                            <span>{app.name.slice(0, 1)}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{app.name}</span>
                              {app.is_featured && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                              {isDuplicatePkg && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  Duplicate
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                              <span>{app.developer}</span>
                              {app.package_name && (
                                <>
                                  <span className="text-muted-foreground/50">•</span>
                                  <span className="text-[10px] text-muted-foreground/80">{app.package_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Version */}
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-semibold text-foreground">{version}</span>
                          {versionCode !== undefined && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              code: {versionCode}
                            </span>
                          )}
                          {radarUpdates[app.id] && (
                            <a
                              href={`https://play.google.com/store/apps/details?id=${app.package_name}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md hover:bg-amber-500/20 transition-colors"
                              title={`Google Play has released ${radarUpdates[app.id].playStoreVersion}! Click to view on Play Store.`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Play: v{radarUpdates[app.id].playStoreVersion}
                            </a>
                          )}
                          {(versionCode === 1 || !!radarUpdates[app.id]) && (
                            <button
                              type="button"
                              disabled={startingAppId === app.id || startedModdingIds[app.id]}
                              onClick={() => handleStartModding(app)}
                              className={`mt-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                                startedModdingIds[app.id]
                                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-2xs"
                              }`}
                              title="Start Modding & Release Update"
                            >
                              {startingAppId === app.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : startedModdingIds[app.id] ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <Play className="h-3 w-3 fill-current" />
                              )}
                              <span>
                                {startingAppId === app.id
                                  ? "Starting..."
                                  : startedModdingIds[app.id]
                                  ? "In Queue"
                                  : "Start Modding"}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {size}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {app.category?.name || "General"}
                          </Badge>
                          {(app.platform === "pc" || app.category?.slug === "pc-software") ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                              💻 PC Software
                            </span>
                          ) : (app.category?.slug === "games" || app.category?.name?.toLowerCase().includes("game") || app.name.toLowerCase().includes("game") || (app.package_name && app.package_name.includes("game"))) ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              🎮 Android Game
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              📱 Android App
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            app.status === "published" ? "success" : "warning"
                          }
                          className="capitalize cursor-pointer"
                          onClick={() => handleToggleStatus(app)}
                          title="Click to toggle status"
                        >
                          {app.status}
                        </Badge>
                      </td>

                      {/* Downloads */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {formatNumber(app.downloads_count ?? 0)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/admin/apps/${app.id}/edit`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Application"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={getAppUrl(app.slug)}
                            target="_blank"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Preview Public Page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>

                          <button
                            onClick={() => handleToggleFeatured(app)}
                            className={`p-1.5 rounded-lg hover:bg-muted ${
                              app.is_featured
                                ? "text-amber-500"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Toggle Featured"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(app)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete App"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Create Quick Modal Dialog */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowAutoModal(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Auto-Generate App Post
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type any app name to auto-fetch official images, description, & specs.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Application Name or Store URL
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Spotify Mod, Subway Surfers, CapCut, Minecraft..."
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !quickLoading) {
                      e.preventDefault();
                      handleQuickCreate();
                    }
                  }}
                  disabled={quickLoading}
                  className="w-full h-11 px-4 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Package Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickType("apps")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      quickType === "apps"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <span>📱 App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickType("games")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      quickType === "games"
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <span>🎮 Game</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickType("pc")}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                      quickType === "pc"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <span>💻 PC Software</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Post Initial Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickStatus("published")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      quickStatus === "published"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Published (Live)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickStatus("draft")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      quickStatus === "draft"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <span>Draft (Review First)</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAutoModal(false);
                    router.push(
                      `/admin/apps/new?autoQuery=${encodeURIComponent(quickQuery.trim())}&type=${quickType}`
                    );
                  }}
                  disabled={quickLoading || !quickQuery.trim()}
                  className="rounded-xl flex-1 h-11 text-xs font-bold"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  <span>Open in Editor</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={quickLoading || !quickQuery.trim()}
                  className="rounded-xl flex-1 h-11 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {quickLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Creating Post...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5 text-amber-400" />
                      <span>Instant Create</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Morphe Bulk Import Modal */}
      {showMorpheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Morphe Patches Bulk Import
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Paste app names (one per line) to import from morphe-patches.software
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMorpheModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  App Names (One Per Line)
                </label>
                <textarea
                  rows={7}
                  value={morpheNamesText}
                  onChange={(e) => setMorpheNamesText(e.target.value)}
                  disabled={morpheLoading}
                  placeholder={"Slowly\nStellarium\nSync.ME\nTandem: Language exchange\nTarget\nThe Home Depot"}
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Initial Post Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMorpheStatus("draft")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      morpheStatus === "draft"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Draft (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMorpheStatus("published")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      morpheStatus === "published"
                        ? "bg-emerald-500 text-black border-emerald-500"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Published (Live)
                  </button>
                </div>
              </div>

              {morpheSummary && (
                <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs space-y-1">
                  <div className="font-bold text-emerald-400">
                    ✅ Created: {morpheSummary.createdCount} posts
                  </div>
                  {morpheSummary.skipped.length > 0 && (
                    <div className="text-amber-400">
                      ⏭️ Skipped ({morpheSummary.skipped.length}):{" "}
                      {morpheSummary.skipped.map((s) => s.query).join(", ")}
                    </div>
                  )}
                  {morpheSummary.notFound.length > 0 && (
                    <div className="text-rose-400">
                      ❌ Not found ({morpheSummary.notFound.length}):{" "}
                      {morpheSummary.notFound.join(", ")}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="button"
                onClick={handleMorpheImport}
                disabled={morpheLoading || !morpheNamesText.trim()}
                className="w-full h-11 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black"
              >
                {morpheLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    <span>Importing from Morphe Catalog...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    <span>Create Posts from Morphe</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

