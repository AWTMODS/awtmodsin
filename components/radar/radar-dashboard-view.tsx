"use client";

import { useState } from "react";
import Link from "next/link";
import { RadarDashboardStats, RadarTrackedApp, RadarActivityLog, RadarRelease } from "@/lib/radar-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Radio,
  RefreshCw,
  PlusCircle,
  Play,
  CheckCircle2,
  Package,
  Rocket,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Activity,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  StartModdingModal,
  MarkCompletedModal,
  ReadyToPublishModal,
  MarkReleasedModal,
} from "./radar-modals";

interface RadarDashboardViewProps {
  initialStats: RadarDashboardStats;
  activeApps: RadarTrackedApp[];
  recentActivities: RadarActivityLog[];
  recentReleases: RadarRelease[];
}

export function RadarDashboardView({
  initialStats,
  activeApps,
  recentActivities,
  recentReleases,
}: RadarDashboardViewProps) {
  const [stats, setStats] = useState<RadarDashboardStats>(initialStats);
  const [apps, setApps] = useState<RadarTrackedApp[]>(activeApps);
  const [isScanning, setIsScanning] = useState(false);

  // Workflow Modal States
  const [activeModalApp, setActiveModalApp] = useState<RadarTrackedApp | null>(null);
  const [modalType, setModalType] = useState<"start" | "complete" | "ready" | "release" | null>(null);

  const handleRefresh = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch("/api/admin/radar/stats"),
        fetch("/api/admin/radar/apps?activeOnly=true&limit=10"),
      ]);
      const sData = await sRes.json();
      const aData = await aRes.json();
      if (sData.stats) setStats(sData.stats);
      if (aData.apps) setApps(aData.apps);
    } catch {}
  };

  const handleManualScan = async () => {
    setIsScanning(true);
    toast.info("📡 Scanning Google Play Store for new version updates...");
    try {
      const res = await fetch("/api/admin/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.updatesDetected > 0) {
          toast.success(`🚀 Radar detected ${data.updatesDetected} new Play Store update(s)! Telegram alerts sent.`);
        } else {
          toast.success(`✅ Scanned ${data.totalScanned} apps. All versions up-to-date!`);
        }
        await handleRefresh();
      } else {
        toast.error(data.error || "Scanner failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Scanner error");
    } finally {
      setIsScanning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UPDATE_DETECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            UPDATE DETECTED
          </span>
        );
      case "MODDING_STARTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            MODDING STARTED
          </span>
        );
      case "MODDED_COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <CheckCircle2 className="h-3 w-3" />
            MODDED COMPLETED
          </span>
        );
      case "READY_TO_PUBLISH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Package className="h-3 w-3" />
            READY TO PUBLISH
          </span>
        );
      case "MOD_RELEASED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-neutral-800 text-neutral-300 border border-neutral-700">
            <Rocket className="h-3 w-3" />
            MOD RELEASED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Scanner Command Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Play Store Version Radar
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-extrabold border border-amber-500/20">
                LIVE
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated APK update detection &amp; manual modding release command center.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            type="button"
            onClick={handleManualScan}
            disabled={isScanning}
            className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1.5 shadow-lg shadow-amber-500/15"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning Google Play..." : "Run Radar Scan"}</span>
          </Button>

          <Link href="/admin/radar/apps">
            <Button
              type="button"
              variant="outline"
              className="h-10 px-4 rounded-xl border-border bg-card hover:bg-neutral-800 text-white font-semibold text-xs gap-1.5"
            >
              <PlusCircle className="h-4 w-4 text-amber-500" />
              <span>Track New App</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Tracked */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Tracked Apps
          </span>
          <div className="text-2xl font-black text-white">{stats.totalTracked}</div>
          <span className="text-[10px] text-muted-foreground">Monitored on Play</span>
        </div>

        {/* Active Radar */}
        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider block flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
            Active Radar
          </span>
          <div className="text-2xl font-black text-amber-500">{stats.activeRadar}</div>
          <span className="text-[10px] text-muted-foreground">In-flight mod pipeline</span>
        </div>

        {/* Update Detected */}
        <div className="p-4 rounded-2xl bg-card border border-amber-500/20 space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
            1. Updates
          </span>
          <div className="text-2xl font-black text-amber-400">{stats.newUpdatesDetected}</div>
          <span className="text-[10px] text-muted-foreground">Action Required</span>
        </div>

        {/* Modding Started */}
        <div className="p-4 rounded-2xl bg-card border border-blue-500/20 space-y-1">
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
            2. Modding
          </span>
          <div className="text-2xl font-black text-blue-400">{stats.moddingStarted}</div>
          <span className="text-[10px] text-muted-foreground">Work in Progress</span>
        </div>

        {/* Modded Completed */}
        <div className="p-4 rounded-2xl bg-card border border-purple-500/20 space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block">
            3. Completed
          </span>
          <div className="text-2xl font-black text-purple-400">{stats.moddedCompleted}</div>
          <span className="text-[10px] text-muted-foreground">Tested &amp; Built</span>
        </div>

        {/* Ready to Publish */}
        <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
            4. Ready
          </span>
          <div className="text-2xl font-black text-emerald-400">{stats.readyToPublish}</div>
          <span className="text-[10px] text-muted-foreground">Pre-release stage</span>
        </div>

        {/* Total Released Mods */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[10px] uppercase font-bold text-neutral-300 tracking-wider block">
            5. Released
          </span>
          <div className="text-2xl font-black text-neutral-300">{stats.totalReleasedMods}</div>
          <span className="text-[10px] text-muted-foreground">Archived Releases</span>
        </div>
      </div>

      {/* Main Section: Active Radar Pipeline & Quick Workflow Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Radar Apps (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Active Radar Queue</span>
                <span className="text-xs text-muted-foreground font-normal">
                  ({apps.length} pending releases)
                </span>
              </h2>
            </div>
            <Link
              href="/admin/radar/queue"
              className="text-xs font-semibold text-amber-500 hover:underline flex items-center gap-1"
            >
              <span>Open Modding Queue</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {apps.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card">
                <ShieldCheck className="h-8 w-8 text-amber-500 mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-bold text-white">All Apps Up to Date!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  No active modding jobs in progress. When Play Store updates are detected, they appear here.
                </p>
              </div>
            ) : (
              apps.map((app) => (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-neutral-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-border bg-secondary flex items-center justify-center font-bold text-sm text-foreground shrink-0">
                      {app.icon_url && (
                        <img
                          src={app.icon_url}
                          alt={app.app_name}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                      <span>{app.app_name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/radar/apps/${app.id}`}
                          className="text-sm font-bold text-white hover:text-amber-400 transition-colors truncate"
                        >
                          {app.app_name}
                        </Link>
                        {getStatusBadge(app.workflow_status)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono text-white">
                          Play Store: {app.current_play_store_version}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] font-mono">
                          {app.package_name}
                        </span>
                        {app.current_cycle?.priority && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-amber-400">
                              {app.current_cycle.priority}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Manual Workflow Transition Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {app.workflow_status === "UPDATE_DETECTED" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveModalApp(app);
                          setModalType("start");
                        }}
                        className="h-8 rounded-xl bg-amber-500 text-black font-extrabold text-xs gap-1 hover:bg-amber-400"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Start Modding</span>
                      </Button>
                    )}

                    {app.workflow_status === "MODDING_STARTED" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveModalApp(app);
                          setModalType("complete");
                        }}
                        className="h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark Completed</span>
                      </Button>
                    )}

                    {app.workflow_status === "MODDED_COMPLETED" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveModalApp(app);
                          setModalType("ready");
                        }}
                        className="h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>Ready to Publish</span>
                      </Button>
                    )}

                    {app.workflow_status === "READY_TO_PUBLISH" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveModalApp(app);
                          setModalType("release");
                        }}
                        className="h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1 shadow-md shadow-amber-500/20"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        <span>Mark Mod Released</span>
                      </Button>
                    )}

                    <Link href={`/admin/radar/apps/${app.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 rounded-xl border-border bg-card hover:bg-neutral-800 text-white text-xs"
                      >
                        Details &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Activity Audit Feed & Recent Releases */}
        <div className="space-y-6">
          {/* Recent Audit Feed */}
          <div className="p-5 rounded-3xl bg-card border border-border space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-white">Recent Admin Activity</h3>
              </div>
              <Link href="/admin/radar/logs" className="text-xs font-semibold text-muted-foreground hover:text-white">
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No recent activity logged.</p>
              ) : (
                recentActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="text-xs space-y-0.5 border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate max-w-[180px]">{act.app_name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(act.created_at)}</span>
                    </div>
                    <div className="text-[11px] text-amber-500 font-semibold">{act.action}</div>
                    {act.notes && <div className="text-[11px] text-muted-foreground truncate">{act.notes}</div>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Latest Released Mods Archive Widget */}
          <div className="p-5 rounded-3xl bg-card border border-border space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-white">Latest Released Mods</h3>
              </div>
              <Link href="/admin/radar/releases" className="text-xs font-semibold text-muted-foreground hover:text-white">
                Full History &rarr;
              </Link>
            </div>

            <div className="space-y-2.5">
              {recentReleases.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No releases archived yet.</p>
              ) : (
                recentReleases.slice(0, 4).map((rel) => (
                  <div key={rel.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border">
                    <div>
                      <div className="font-bold text-xs text-white truncate max-w-[150px]">{rel.app_name}</div>
                      <div className="text-[10px] text-amber-400 font-mono">{rel.released_mod_version}</div>
                    </div>
                    <a
                      href={rel.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs"
                      title="Open Download Link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals for Status Transitions */}
      {activeModalApp && modalType === "start" && (
        <StartModdingModal
          app={activeModalApp}
          isOpen={true}
          onClose={() => {
            setActiveModalApp(null);
            setModalType(null);
          }}
          onSuccess={handleRefresh}
        />
      )}

      {activeModalApp && modalType === "complete" && (
        <MarkCompletedModal
          app={activeModalApp}
          isOpen={true}
          onClose={() => {
            setActiveModalApp(null);
            setModalType(null);
          }}
          onSuccess={handleRefresh}
        />
      )}

      {activeModalApp && modalType === "ready" && (
        <ReadyToPublishModal
          app={activeModalApp}
          isOpen={true}
          onClose={() => {
            setActiveModalApp(null);
            setModalType(null);
          }}
          onSuccess={handleRefresh}
        />
      )}

      {activeModalApp && modalType === "release" && (
        <MarkReleasedModal
          app={activeModalApp}
          isOpen={true}
          onClose={() => {
            setActiveModalApp(null);
            setModalType(null);
          }}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
