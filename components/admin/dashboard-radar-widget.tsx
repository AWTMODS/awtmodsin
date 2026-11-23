"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Radio, Zap, ExternalLink, RefreshCw, CheckCircle2, ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface RadarAppUpdate {
  appId: string;
  appName: string;
  slug: string;
  packageName: string;
  iconUrl?: string;
  currentModVersion: string;
  playStoreVersion: string;
  changelog?: string;
  detectedAt: string;
  isMuted?: boolean;
  workflowStatus?: string;
}

interface DashboardRadarWidgetProps {
  initialUpdates?: Record<string, RadarAppUpdate>;
  initialLastScan?: string;
}

export function DashboardRadarWidget({
  initialUpdates = {},
  initialLastScan = "",
}: DashboardRadarWidgetProps) {
  const [updates, setUpdates] = useState<Record<string, RadarAppUpdate>>(initialUpdates);
  const [lastScanAt, setLastScanAt] = useState<string>(initialLastScan);
  const [isScanning, setIsScanning] = useState(false);
  const [startingAppId, setStartingAppId] = useState<string | null>(null);

  // Helper to format scan time relatively
  const formatScanTime = (isoString?: string) => {
    if (!isoString) return "Not scanned yet";
    const ms = new Date(isoString).getTime();
    if (isNaN(ms)) return "Recently";
    const diffMins = Math.floor((Date.now() - ms) / 60000);
    const timeStr = new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffMins < 1) return `Just now (${timeStr})`;
    if (diffMins < 60) return `${diffMins}m ago (${timeStr})`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago (${timeStr})`;
    }
    return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Automated background scan executor (fast, non-blocking, no telegram flood)
  const triggerAutoScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/admin/radar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyTelegram: false, limit: 50 }),
      });
      const data = await res.json();
      if (data.success && data.radar) {
        if (data.radar.updates) {
          setUpdates(data.radar.updates);
        }
        if (data.radar.lastScanAt) {
          setLastScanAt(data.radar.lastScanAt);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsScanning(false);
    }
  };

  // Fetch live radar updates on mount & auto-scan when stale (> 20 mins)
  useEffect(() => {
    fetch("/api/admin/radar/check", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.radar?.updates) {
          setUpdates(data.radar.updates);
          const scanTime = data.radar.lastScanAt;
          if (scanTime) {
            setLastScanAt(scanTime);
            const lastMs = new Date(scanTime).getTime();
            // If older than 20 minutes, automatically trigger background scan
            if (!lastMs || Date.now() - lastMs > 20 * 60 * 1000) {
              triggerAutoScan();
            }
          } else {
            triggerAutoScan();
          }
        } else {
          triggerAutoScan();
        }
      })
      .catch(() => {});

    // Periodic automatic background check every 15 minutes while dashboard tab is open
    const interval = setInterval(() => {
      triggerAutoScan();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleScanRadar = async () => {
    setIsScanning(true);
    toast.info("📡 Scanning Google Play Store for new version releases...");
    try {
      const res = await fetch("/api/admin/radar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyTelegram: true, limit: 60 }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.updatesFound > 0) {
          toast.success(`🚀 Found ${data.updatesFound} updates! Telegram alerts dispatched.`);
        } else {
          toast.success("✅ All applications are up-to-date with Google Play!");
        }
        if (data.radar) {
          if (data.radar.updates) {
            setUpdates(data.radar.updates);
          }
          if (data.radar.lastScanAt) {
            setLastScanAt(data.radar.lastScanAt);
          }
        }
      } else {
        toast.error(data.error || "Radar scan failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan radar");
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartModding = async (app: RadarAppUpdate) => {
    setStartingAppId(app.appId);
    try {
      const targetId = app.appId.startsWith("radar-") ? app.appId : `radar-${app.appId}`;
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_modding",
          appId: targetId,
          priority: "High",
          remarks: `Modding initiated from Dashboard for ${app.appName} (${app.playStoreVersion})`,
          adminName: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start modding");

      toast.success(`🚀 Modding started for ${app.appName}! Moved to Modding Pipeline.`);
      // Immediately remove from local list so it disappears without waiting for a re-scan
      setUpdates((prev) => {
        const next = { ...prev };
        delete next[app.appId];
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to start modding");
    } finally {
      setStartingAppId(null);
    }
  };

  const updateList = Object.values(updates).filter(
    (u) => !u.isMuted && (!u.workflowStatus || u.workflowStatus === "UPDATE_DETECTED")
  );
  const hasUpdates = updateList.length > 0;

  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 transition-all shadow-xs ${
        hasUpdates
          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/[0.07] via-card to-card"
          : "border-border bg-card"
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              hasUpdates
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-500"
            }`}
          >
            <Radio className={`h-5 w-5 ${isScanning ? "animate-spin text-cyan-400" : ""}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                Play Store Version Radar
              </h3>
              {hasUpdates ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {updateList.length} Update{updateList.length === 1 ? "" : "s"} Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  All Up to Date
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>
                {isScanning ? (
                  <span className="text-cyan-500 font-semibold flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Scanning Google Play Store live...
                  </span>
                ) : (
                  `Last scanned: ${formatScanTime(lastScanAt)}`
                )}
              </span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-Scan: Active (Every 30m)
              </span>
            </div>
          </div>
        </div>

        {/* Scan Button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isScanning}
            onClick={handleScanRadar}
            className="rounded-xl px-3.5 gap-1.5 font-bold border-cyan-500/30 bg-cyan-500/5 text-cyan-500 hover:bg-cyan-500/10 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning Play Store..." : "Scan Radar"}</span>
          </Button>

          <Link href="/admin/radar">
            <Button size="sm" variant="ghost" className="rounded-xl text-xs gap-1 font-semibold text-muted-foreground hover:text-foreground">
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Updates Body */}
      {hasUpdates ? (
        <div className="pt-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">
            The following applications have a newer version released on Google Play Store:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {updateList.map((app) => (
              <div
                key={app.appId}
                className="p-3.5 rounded-2xl border border-border/80 bg-background/60 backdrop-blur-xs flex flex-col justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-border/80 bg-muted/40 shrink-0 shadow-2xs">
                        {app.iconUrl ? (
                          <img
                            src={app.iconUrl}
                            alt={app.appName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-bold text-xs text-amber-500 bg-amber-500/10">
                            {app.appName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-foreground line-clamp-1 block leading-snug" title={app.appName}>
                          {app.appName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate block mt-0.5" title={app.packageName}>
                          {app.packageName}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`https://play.google.com/store/apps/details?id=${app.packageName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground p-1 shrink-0 rounded-lg hover:bg-muted/50 transition-colors"
                      title="Open Google Play Store"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 mt-2 font-mono text-xs">
                    <span className="text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                      Site: {app.currentModVersion}
                    </span>
                    <span className="text-muted-foreground">➔</span>
                    <span className="font-bold text-amber-500 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Play: v{app.playStoreVersion}
                    </span>
                  </div>
                  {app.changelog && (
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 italic">
                      &ldquo;{app.changelog.replace(/<[^>]*>/g, "").trim()}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    disabled={startingAppId === app.appId}
                    onClick={() => handleStartModding(app)}
                    className="flex-1 text-xs font-bold py-1.5 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {startingAppId === app.appId ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{startingAppId === app.appId ? "Starting..." : "Start Modding"}</span>
                  </Button>
                  <Link
                    href={`/admin/radar/apps/${app.appId}`}
                    className="text-center text-xs font-semibold py-1.5 px-3 h-8 rounded-xl bg-muted/60 hover:bg-muted border border-border text-foreground inline-flex items-center justify-center gap-1 transition-colors"
                    title="View Details & Pipeline"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Pipeline</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>
            Radar is monitoring your active applications against Google Play Store. Any new version will be flagged here and dispatched to your Telegram Bot immediately.
          </span>
        </div>
      )}
    </div>
  );
}
