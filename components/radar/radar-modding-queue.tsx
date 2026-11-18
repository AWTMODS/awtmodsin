"use client";

import { useState } from "react";
import Link from "next/link";
import { RadarTrackedApp } from "@/lib/radar-engine";
import { Button } from "@/components/ui/button";
import {
  Play,
  CheckCircle2,
  Package,
  Rocket,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Flame,
  User,
  Clock,
  Layers,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  StartModdingModal,
  MarkCompletedModal,
  ReadyToPublishModal,
  MarkReleasedModal,
} from "./radar-modals";

interface RadarModdingQueueProps {
  initialApps: RadarTrackedApp[];
}

export function RadarModdingQueue({ initialApps }: RadarModdingQueueProps) {
  const [apps, setApps] = useState<RadarTrackedApp[]>(initialApps);
  const [activeTab, setActiveTab] = useState<"ALL" | "MODDING_STARTED" | "MODDED_COMPLETED" | "READY_TO_PUBLISH">("ALL");

  // Workflow Modal States
  const [activeModalApp, setActiveModalApp] = useState<RadarTrackedApp | null>(null);
  const [modalType, setModalType] = useState<"start" | "complete" | "ready" | "release" | null>(null);

  const handleRefresh = async () => {
    try {
      const res = await fetch("/api/admin/radar/apps?activeOnly=true");
      const data = await res.json();
      if (Array.isArray(data.apps)) setApps(data.apps);
    } catch {}
  };

  const queueApps = apps.filter(
    (a) =>
      a.workflow_status === "MODDING_STARTED" ||
      a.workflow_status === "MODDED_COMPLETED" ||
      a.workflow_status === "READY_TO_PUBLISH"
  );

  const filtered = queueApps.filter((a) => {
    if (activeTab === "ALL") return true;
    return a.workflow_status === activeTab;
  });

  const startedCount = queueApps.filter((a) => a.workflow_status === "MODDING_STARTED").length;
  const completedCount = queueApps.filter((a) => a.workflow_status === "MODDED_COMPLETED").length;
  const readyCount = queueApps.filter((a) => a.workflow_status === "READY_TO_PUBLISH").length;

  return (
    <div className="space-y-6">
      {/* Top Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-card border border-border overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "ALL"
              ? "bg-amber-500 text-black shadow-md shadow-amber-500/15"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <span>All Processing</span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/20 text-[10px]">
            {queueApps.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MODDING_STARTED")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "MODDING_STARTED"
              ? "bg-muted text-blue-400 border border-blue-500/40 shadow-xs"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Modding Started</span>
          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px]">
            {startedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MODDED_COMPLETED")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "MODDED_COMPLETED"
              ? "bg-muted text-purple-400 border border-purple-500/40 shadow-xs"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Modded Completed</span>
          <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[10px]">
            {completedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("READY_TO_PUBLISH")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "READY_TO_PUBLISH"
              ? "bg-muted text-emerald-400 border border-emerald-500/40 shadow-xs"
              : "text-muted-foreground hover:text-white"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Ready to Publish</span>
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px]">
            {readyCount}
          </span>
        </button>
      </div>

      {/* Queue Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl border border-dashed border-border bg-card">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-bold text-white">No applications in this queue</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Select another status filter or start modding an app from Version Radar.
            </p>
          </div>
        ) : (
          filtered.map((app) => (
            <div
              key={app.id}
              className="p-5 rounded-3xl bg-card border border-border hover:border-neutral-700 transition-all space-y-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-12 w-12 rounded-2xl overflow-hidden border border-border bg-background shrink-0">
                    {app.icon_url && (
                      <img
                        src={app.icon_url}
                        alt={app.app_name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/radar/apps/${app.id}`}
                      className="font-bold text-sm text-white hover:text-amber-400 transition-colors truncate block"
                    >
                      {app.app_name}
                    </Link>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {app.package_name}
                    </div>
                  </div>
                </div>

                {/* Priority Badge */}
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                    app.current_cycle?.priority === "Critical"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : app.current_cycle?.priority === "High"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700"
                  }`}
                >
                  {app.current_cycle?.priority || "Medium"} Priority
                </span>
              </div>

              {/* Version & Modder Info Strip */}
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-2xl bg-muted/30 border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Target Version</span>
                  <span className="font-mono text-white font-bold">{app.current_play_store_version}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Assigned Modder</span>
                  <span className="text-white truncate block flex items-center gap-1">
                    <User className="h-3 w-3 text-amber-500" />
                    <span>{app.current_cycle?.assigned_modder || "Aadith C V"}</span>
                  </span>
                </div>
              </div>

              {/* Remarks Preview */}
              {app.latest_remarks && app.latest_remarks.length > 0 && (
                <div className="p-3 rounded-2xl bg-background border border-border space-y-1">
                  <div className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>Latest Internal Note ({app.latest_remarks.length})</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono line-clamp-2">
                    {app.latest_remarks[0].remarks}
                  </p>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-border">
                <Link
                  href={`/admin/radar/apps/${app.id}`}
                  className="text-xs font-semibold text-muted-foreground hover:text-white flex items-center gap-1"
                >
                  <span>Open Full Details</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>

                <div className="flex items-center gap-2">
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
                      <span>Release &amp; Archive</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Workflow Modals */}
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
