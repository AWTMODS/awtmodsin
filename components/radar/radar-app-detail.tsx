"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Clock,
  Play,
  CheckCircle2,
  FileCheck,
  Send,
  MessageSquare,
  ShieldAlert,
  Calendar,
  User,
  History,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RadarTrackedApp,
  RadarRemark,
  RadarModdingCycle,
  RadarActivityLog,
  RadarWorkflowStatus,
} from "@/lib/radar-engine";
import {
  StartModdingModal,
  MarkCompletedModal,
  ReadyToPublishModal,
  MarkReleasedModal,
} from "@/components/radar/radar-modals";

interface RadarAppDetailProps {
  app: RadarTrackedApp;
  cycle?: RadarModdingCycle;
  remarks: RadarRemark[];
  activities: RadarActivityLog[];
}

// Clean version formatter preventing duplicate "vv"
const formatCleanVersion = (val?: string) => {
  if (!val) return "v1.0.0";
  const trimmed = val.trim();
  const stripped = trimmed.replace(/^v+/i, "");
  return `v${stripped}`;
};

const formatModLabel = (val?: string, fallbackVer?: string) => {
  if (!val) return fallbackVer ? `${formatCleanVersion(fallbackVer)} VIP Mod` : "v1.0.0 VIP Mod";
  const trimmed = val.trim();
  const stripped = trimmed.replace(/^v+/i, "");
  return stripped.toLowerCase().includes("mod") ? `v${stripped}` : `v${stripped} VIP Mod`;
};

export function RadarAppDetail({
  app: initialApp,
  cycle: initialCycle,
  remarks: initialRemarks,
  activities: initialActivities,
}: RadarAppDetailProps) {
  const router = useRouter();
  const [app, setApp] = useState<RadarTrackedApp>(initialApp);
  const [cycle, setCycle] = useState<RadarModdingCycle | undefined>(initialCycle);
  const [remarks, setRemarks] = useState<RadarRemark[]>(initialRemarks);
  const [activities, setActivities] = useState<RadarActivityLog[]>(initialActivities);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    "start" | "completed" | "ready" | "release" | null
  >(null);

  // New Remark state
  const [newRemarkText, setNewRemarkText] = useState("");
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);

  // Helper for workflow status badge
  const getStatusBadge = (status: RadarWorkflowStatus) => {
    switch (status) {
      case "UPDATE_DETECTED":
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs py-1 px-3 font-bold">
            Update Detected
          </Badge>
        );
      case "MODDING_STARTED":
        return (
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs py-1 px-3 font-bold">
            Modding Started
          </Badge>
        );
      case "MODDED_COMPLETED":
        return (
          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs py-1 px-3 font-bold">
            Modded Completed
          </Badge>
        );
      case "READY_TO_PUBLISH":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs py-1 px-3 font-bold">
            Ready to Publish
          </Badge>
        );
      case "MOD_RELEASED":
        return (
          <Badge className="bg-[#B6F23A]/15 text-[#B6F23A] border-[#B6F23A]/30 text-xs py-1 px-3 font-bold">
            Mod Released
          </Badge>
        );
      default:
        return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  // Add new remark handler
  const handleAddRemark = async () => {
    if (!newRemarkText.trim()) {
      toast.error("Please enter a remark note");
      return;
    }
    setIsSubmittingRemark(true);
    try {
      const res = await fetch("/api/admin/radar/remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          cycleId: cycle?.id,
          remarks: newRemarkText.trim(),
          adminName: "Admin",
        }),
      });
      const data = await res.json();
      if (data.success && data.remark) {
        toast.success("Internal remark added");
        setRemarks([data.remark, ...remarks]);
        setNewRemarkText("");
        router.refresh();
      } else {
        toast.error(data.error || "Failed to add remark");
      }
    } catch {
      toast.error("Network error while adding remark");
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/radar/apps"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#929B94] hover:text-[#F5F7F4] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Version Radar</span>
        </Link>

        <div className="flex items-center gap-2">
          {getStatusBadge(app.workflow_status)}
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Sections A, B & C */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION A: APP INFORMATION */}
          <div className="p-5 rounded-2xl bg-[#141B17] border border-[#263129] space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#080B0A] border border-[#263129] overflow-hidden shrink-0 flex items-center justify-center relative">
                {app.icon_url ? (
                  <Image
                    src={app.icon_url}
                    alt={app.app_name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <Sparkles className="h-8 w-8 text-[#B6F23A]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-xl font-black text-[#F5F7F4] truncate">
                    {app.app_name}
                  </h1>
                  <a
                    href={`https://play.google.com/store/apps/details?id=${app.package_name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#B6F23A] bg-[#B6F23A]/10 border border-[#B6F23A]/20 px-2.5 py-1 rounded-xl font-bold hover:bg-[#B6F23A]/20 transition-colors"
                  >
                    <span>Play Store</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-xs font-mono text-[#929B94] mt-1 truncate">
                  {app.package_name}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#929B94]">
                  <span>
                    Last scanned:{" "}
                    {app.last_scanned_at
                      ? new Date(app.last_scanned_at).toLocaleString()
                      : "Recently"}
                  </span>
                  <span>•</span>
                  <span>Tracking: {app.is_active_tracking ? "Active" : "Archived"}</span>
                </div>
              </div>
            </div>

            {/* Version Transition Ribbon */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#263129]">
              <div className="p-3 rounded-xl bg-[#080B0A] border border-[#263129]">
                <span className="text-[11px] font-sans text-[#929B94] block">
                  Current Website / Mod Version
                </span>
                <span className="text-sm font-mono font-bold text-[#F5F7F4]">
                  {formatCleanVersion(app.last_detected_version || "1.0.0")}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#080B0A] border border-[#263129]">
                <span className="text-[11px] font-sans text-amber-400 block font-bold">
                  Play Store Version (Detected)
                </span>
                <span className="text-sm font-mono font-black text-amber-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  {formatCleanVersion(app.current_play_store_version)}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B: MODDING WORKFLOW ACTION PANEL */}
          <div className="p-5 rounded-2xl bg-[#141B17] border border-[#263129] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[#F5F7F4] uppercase tracking-wider">
                  Admin Modding Pipeline Control
                </h2>
                <p className="text-xs text-[#929B94] mt-0.5">
                  Step-by-step admin action control (Only clicking advances stages)
                </p>
              </div>
              <Badge className="bg-[#263129] text-[#F5F7F4] text-xs">
                Priority: {cycle?.priority || "Medium"}
              </Badge>
            </div>

            {/* Active Workflow Buttons with Stage Highlighting */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {/* Button 1: Start Modding */}
              <Button
                size="sm"
                onClick={() => setActiveModal("start")}
                className={`h-10 text-xs rounded-xl transition-all ${
                  app.workflow_status === "UPDATE_DETECTED"
                    ? "bg-[#B6F23A] text-[#080B0A] hover:bg-[#B6F23A]/90 font-black shadow-md ring-2 ring-[#B6F23A]/30"
                    : "variant-outline border-[#263129] bg-[#080B0A] text-[#929B94] hover:text-[#F5F7F4] font-medium"
                }`}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                <span>Start Modding</span>
              </Button>

              {/* Button 2: Mod Completed */}
              <Button
                size="sm"
                onClick={() => setActiveModal("completed")}
                disabled={app.workflow_status === "UPDATE_DETECTED"}
                className={`h-10 text-xs rounded-xl transition-all ${
                  app.workflow_status === "MODDING_STARTED"
                    ? "bg-purple-600 text-white hover:bg-purple-500 font-black shadow-md ring-2 ring-purple-500/30"
                    : app.workflow_status === "UPDATE_DETECTED"
                    ? "border-[#263129] bg-[#080B0A] text-[#929B94]/40 cursor-not-allowed border"
                    : "border-[#263129] bg-[#080B0A] text-[#929B94] hover:text-[#F5F7F4] font-medium border"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                <span>Mod Completed</span>
              </Button>

              {/* Button 3: Ready to Publish */}
              <Button
                size="sm"
                onClick={() => setActiveModal("ready")}
                disabled={app.workflow_status === "UPDATE_DETECTED" || app.workflow_status === "MODDING_STARTED"}
                className={`h-10 text-xs rounded-xl transition-all ${
                  app.workflow_status === "MODDED_COMPLETED"
                    ? "bg-amber-500 text-[#080B0A] hover:bg-amber-400 font-black shadow-md ring-2 ring-amber-500/30"
                    : app.workflow_status === "UPDATE_DETECTED" || app.workflow_status === "MODDING_STARTED"
                    ? "border-[#263129] bg-[#080B0A] text-[#929B94]/40 cursor-not-allowed border"
                    : "border-[#263129] bg-[#080B0A] text-[#929B94] hover:text-[#F5F7F4] font-medium border"
                }`}
              >
                <FileCheck className="h-3.5 w-3.5 mr-1" />
                <span>Ready to Publish</span>
              </Button>

              {/* Button 4: Release Mod */}
              <Button
                size="sm"
                onClick={() => setActiveModal("release")}
                disabled={app.workflow_status !== "READY_TO_PUBLISH"}
                className={`h-10 text-xs rounded-xl transition-all ${
                  app.workflow_status === "READY_TO_PUBLISH"
                    ? "bg-[#B6F23A] text-[#080B0A] hover:bg-[#B6F23A]/90 font-black shadow-md ring-2 ring-[#B6F23A]/30"
                    : "border-[#263129] bg-[#080B0A] text-[#929B94]/40 cursor-not-allowed border"
                }`}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                <span>Release Mod</span>
              </Button>
            </div>

            {/* Current Cycle Details */}
            {cycle && (
              <div className="p-3.5 rounded-xl bg-[#080B0A] border border-[#263129] space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[#929B94]">
                  <span>
                    Assigned Modder:{" "}
                    <strong className="text-[#F5F7F4]">{cycle.assigned_modder || "Aadith C V"}</strong>
                  </span>
                  <span>
                    Started:{" "}
                    <strong className="text-[#F5F7F4]">
                      {cycle.modding_started_at
                        ? new Date(cycle.modding_started_at).toLocaleDateString()
                        : (app.workflow_status === "UPDATE_DETECTED" ? "Pending (Not Started)" : "In Progress")}
                    </strong>
                  </span>
                </div>
                {cycle.testing_requirements && (
                  <div className="pt-2 border-t border-[#263129]/60 text-[#929B94]">
                    <span className="text-[#B6F23A] font-bold">Testing Requirements: </span>
                    {cycle.testing_requirements}
                  </div>
                )}
                {cycle.changelog && (
                  <div className="pt-2 border-t border-[#263129]/60 text-[#929B94] italic">
                    <span className="text-amber-400 font-bold not-italic">Play Store Changelog: </span>
                    &ldquo;{cycle.changelog.replace(/<[^>]*>/g, "").trim()}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION C: REMARKS SYSTEM (MULTILINE, TIMESTAMPS, PRIVATE) */}
          <div className="p-5 rounded-2xl bg-[#141B17] border border-[#263129] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#080B0A] border border-[#263129] flex items-center justify-center text-[#B6F23A]">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#F5F7F4]">
                    Internal Modding Remarks
                  </h3>
                  <p className="text-[11px] text-[#929B94] flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5 text-[#B6F23A]" />
                    Private admin & modder instructions (never displayed publicly)
                  </p>
                </div>
              </div>
              <Badge className="bg-[#080B0A] text-[#929B94] border-[#263129] text-xs">
                {remarks.length} Notes
              </Badge>
            </div>

            {/* Add New Remark Form */}
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={newRemarkText}
                onChange={(e) => setNewRemarkText(e.target.value)}
                placeholder="Write internal note, bug analysis, testing checklist, or mod instructions..."
                className="bg-[#080B0A] border-[#263129] text-[#F5F7F4] rounded-xl text-xs focus:border-[#B6F23A] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddRemark}
                  disabled={isSubmittingRemark || !newRemarkText.trim()}
                  className="h-8 px-3 text-xs font-bold rounded-xl bg-[#B6F23A] text-[#080B0A] hover:bg-[#B6F23A]/90 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isSubmittingRemark ? "Saving..." : "Add Remark"}</span>
                </Button>
              </div>
            </div>

            {/* Remarks Timeline */}
            <div className="pt-2 space-y-3">
              {remarks.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#929B94] rounded-xl bg-[#080B0A] border border-[#263129]">
                  No remarks entered yet. Use the field above to add instructions for the modding team.
                </div>
              ) : (
                remarks.map((rem) => {
                  const dateStr = new Date(rem.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={rem.id}
                      className="p-3.5 rounded-xl bg-[#080B0A] border border-[#263129] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#929B94]">
                        <span className="flex items-center gap-1 font-bold text-[#F5F7F4]">
                          <User className="h-3 w-3 text-[#B6F23A]" />
                          {rem.admin_name || "Admin"}
                        </span>
                        <span className="font-mono">{dateStr}</span>
                      </div>
                      <p className="text-[#F5F7F4] whitespace-pre-wrap leading-relaxed">
                        {rem.remarks}
                      </p>
                      {rem.internal_instructions && (
                        <p className="text-[11px] text-[#929B94] pt-1 border-t border-[#263129]">
                          <strong>Instructions:</strong> {rem.internal_instructions}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Sections D & E */}
        <div className="space-y-6">
          {/* SECTION D: VERSION & RELEASE HISTORY */}
          <div className="p-5 rounded-2xl bg-[#141B17] border border-[#263129] space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#B6F23A]" />
              <h3 className="text-sm font-black text-[#F5F7F4] uppercase tracking-wider">
                Version Overview
              </h3>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-[#080B0A] border border-[#263129] text-xs space-y-1">
                <span className="text-[10px] uppercase font-mono text-[#929B94]">Target Mod Version</span>
                <p className="font-bold font-mono text-[#B6F23A]">
                  {formatModLabel(cycle?.mod_version, app.current_play_store_version)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#080B0A] border border-[#263129] text-xs space-y-1">
                <span className="text-[10px] uppercase font-mono text-amber-400">Play Store Version Detected</span>
                <p className="font-bold font-mono text-amber-400">
                  {formatCleanVersion(app.current_play_store_version)}
                </p>
              </div>

              <Link
                href="/admin/radar/releases"
                className="w-full mt-2 inline-flex items-center justify-center h-8 text-xs font-bold rounded-xl bg-[#080B0A] border border-[#263129] text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#263129] transition-colors"
              >
                Browse All Releases
              </Link>
            </div>
          </div>

          {/* SECTION E: ACTIVITY AUDIT TRAIL */}
          <div className="p-5 rounded-2xl bg-[#141B17] border border-[#263129] space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#B6F23A]" />
              <h3 className="text-sm font-black text-[#F5F7F4] uppercase tracking-wider">
                Activity Audit Trail
              </h3>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-[#929B94]">No audit entries yet.</p>
            ) : (
              <div className="divide-y divide-[#263129] text-xs">
                {activities.slice(0, 8).map((act) => (
                  <div key={act.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#F5F7F4]">{act.action}</span>
                      <span className="text-[#929B94] font-mono">
                        {new Date(act.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#929B94] font-mono">
                      By {act.performed_by || "Admin"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WORKFLOW MODALS */}
      <StartModdingModal
        app={app}
        isOpen={activeModal === "start"}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          router.refresh();
        }}
      />

      <MarkCompletedModal
        app={app}
        isOpen={activeModal === "completed"}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          router.refresh();
        }}
      />

      <ReadyToPublishModal
        app={app}
        isOpen={activeModal === "ready"}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          router.refresh();
        }}
      />

      <MarkReleasedModal
        app={app}
        isOpen={activeModal === "release"}
        onClose={() => setActiveModal(null)}
        onSuccess={() => {
          setActiveModal(null);
          toast.success(`${app.app_name} released! Automatically archived to Release History.`);
          router.push("/admin/radar/releases");
        }}
      />
    </div>
  );
}
