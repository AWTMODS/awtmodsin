"use client";

import { useState } from "react";
import Link from "next/link";
import { RadarTrackedApp } from "@/lib/radar-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  PlusCircle,
  Play,
  CheckCircle2,
  Package,
  Rocket,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Radio,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import {
  StartModdingModal,
  MarkCompletedModal,
  ReadyToPublishModal,
  MarkReleasedModal,
} from "./radar-modals";

interface RadarAppsTableProps {
  initialApps: RadarTrackedApp[];
  defaultStatus?: string;
}

export function RadarAppsTable({ initialApps, defaultStatus = "" }: RadarAppsTableProps) {
  const [apps, setApps] = useState<RadarTrackedApp[]>(initialApps);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add App Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputPackage, setInputPackage] = useState("");
  const [inputName, setInputName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Workflow Modal States
  const [activeModalApp, setActiveModalApp] = useState<RadarTrackedApp | null>(null);
  const [modalType, setModalType] = useState<"start" | "complete" | "ready" | "release" | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/radar/apps");
      const data = await res.json();
      if (Array.isArray(data.apps)) {
        setApps(data.apps);
      }
    } catch {
      toast.error("Failed to refresh applications");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPackage.trim()) {
      toast.error("Please enter a package name or Play Store URL");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/admin/radar/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_name: inputPackage.trim(),
          app_name: inputName.trim() || undefined,
          admin_name: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add application");

      toast.success(`✨ Added "${data.app.app_name}" to Version Radar!`);
      setShowAddModal(false);
      setInputPackage("");
      setInputName("");
      await handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to add app");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from active radar tracking?`)) return;

    try {
      const res = await fetch(`/api/admin/radar/apps?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== id));
        toast.success(`Removed "${name}" from tracking.`);
      }
    } catch {
      toast.error("Failed to remove application");
    }
  };

  const filtered = apps.filter((app) => {
    const matchesSearch =
      !search ||
      app.app_name.toLowerCase().includes(search.toLowerCase()) ||
      app.package_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !selectedStatus || app.workflow_status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#929B94]" />
          <input
            type="text"
            placeholder="Search tracked apps by name or package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-11 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-white focus:outline-none"
          >
            <option value="">All Statuses ({apps.length})</option>
            <option value="UPDATE_DETECTED">🚨 Update Detected</option>
            <option value="MODDING_STARTED">🛠️ Modding Started</option>
            <option value="MODDED_COMPLETED">✅ Modded Completed</option>
            <option value="READY_TO_PUBLISH">📦 Ready to Publish</option>
            <option value="MOD_RELEASED">🚀 Mod Released</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-11 px-3.5 rounded-xl border-border bg-card hover:bg-neutral-800 text-white text-xs gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1.5 shadow-md shadow-amber-500/15"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Tracked App</span>
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/40 text-white uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-3.5 px-4 font-bold">Application</th>
                <th className="py-3.5 px-4 font-bold">Play Store Version</th>
                <th className="py-3.5 px-4 font-bold">Workflow Status</th>
                <th className="py-3.5 px-4 font-bold">Last Scan</th>
                <th className="py-3.5 px-4 font-bold text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground">
                    No tracked applications found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                    {/* App info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center font-bold text-xs text-foreground shrink-0">
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
                          <Link
                            href={`/admin/radar/apps/${app.id}`}
                            className="font-bold text-white hover:text-amber-400 transition-colors truncate block"
                          >
                            {app.app_name}
                          </Link>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                            {app.package_name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Version */}
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-white">{app.current_play_store_version}</div>
                      {app.last_detected_version && app.last_detected_version !== app.current_play_store_version && (
                        <span className="text-[10px] text-amber-400">
                          Site: {app.last_detected_version}
                        </span>
                      )}
                    </td>

                    {/* Workflow status */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase">
                        {app.workflow_status === "UPDATE_DETECTED" && (
                          <span className="text-amber-400 bg-amber-500/10 border-amber-500/20 px-2 py-0.5 rounded-full">
                            Update Detected
                          </span>
                        )}
                        {app.workflow_status === "MODDING_STARTED" && (
                          <span className="text-blue-400 bg-blue-500/10 border-blue-500/30 px-2 py-0.5 rounded-full">
                            Modding Started
                          </span>
                        )}
                        {app.workflow_status === "MODDED_COMPLETED" && (
                          <span className="text-purple-400 bg-purple-500/10 border-purple-500/30 px-2 py-0.5 rounded-full">
                            Modded Completed
                          </span>
                        )}
                        {app.workflow_status === "READY_TO_PUBLISH" && (
                          <span className="text-emerald-400 bg-emerald-500/10 border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Ready to Publish
                          </span>
                        )}
                        {app.workflow_status === "MOD_RELEASED" && (
                          <span className="text-neutral-400 bg-neutral-800 border-neutral-700 px-2 py-0.5 rounded-full">
                            Mod Released
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Last scanned */}
                    <td className="py-3 px-4 text-[11px] text-muted-foreground">
                      {formatDate(app.last_scanned_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.workflow_status === "UPDATE_DETECTED" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveModalApp(app);
                              setModalType("start");
                            }}
                            className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px]"
                          >
                            Start Modding
                          </Button>
                        )}
                        {app.workflow_status === "MODDING_STARTED" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveModalApp(app);
                              setModalType("complete");
                            }}
                            className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px]"
                          >
                            Mark Completed
                          </Button>
                        )}
                        {app.workflow_status === "MODDED_COMPLETED" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveModalApp(app);
                              setModalType("ready");
                            }}
                            className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px]"
                          >
                            Ready to Publish
                          </Button>
                        )}
                        {app.workflow_status === "READY_TO_PUBLISH" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveModalApp(app);
                              setModalType("release");
                            }}
                            className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px]"
                          >
                            Mark Released
                          </Button>
                        )}

                        <Link
                          href={`/admin/radar/apps/${app.id}`}
                          className="p-1.5 rounded-lg hover:bg-neutral-800 text-white"
                          title="Open Details & Remarks"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleRemove(app.id, app.app_name)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400"
                          title="Remove Tracking"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 text-left shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-white">Track New Android App</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddApp} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Google Play URL or Package Name <span className="text-destructive">*</span>
                </label>
                <Input
                  autoFocus
                  placeholder="e.g. com.spotify.music or Play Store link"
                  value={inputPackage}
                  onChange={(e) => setInputPackage(e.target.value)}
                  className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Custom App Name (Optional)
                </label>
                <Input
                  placeholder="Auto-detected from Play Store if empty"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="border-border bg-background text-xs text-white focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={isAdding}
                  className="rounded-xl border-border text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1.5"
                >
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>Start Tracking</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workflow Transition Modals */}
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
