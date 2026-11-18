"use client";

import { useState } from "react";
import { RadarTrackedApp, RadarPriority } from "@/lib/radar-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Play,
  CheckCircle2,
  Package,
  Rocket,
  AlertTriangle,
  Loader2,
  FileCode,
  ShieldCheck,
  User,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface ModalProps {
  app: RadarTrackedApp;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 1. Start Modding Modal with Remarks System
 */
export function StartModdingModal({ app, isOpen, onClose, onSuccess }: ModalProps) {
  const [priority, setPriority] = useState<RadarPriority>("High");
  const [assignedModder, setAssignedModder] = useState("Aadith C V");
  const [remarks, setRemarks] = useState(
    "Waiting for latest clean APK base.\nVerify login and cloud sync compatibility.\nInvestigate unlocked premium features.\nRun installation tests on Android 14/15."
  );
  const [internalInstructions, setInternalInstructions] = useState(
    "1. Decompile with apktool.\n2. Patch signature verification & license check.\n3. Remove ads and analytics SDKs.\n4. Re-align and sign with custom release key."
  );
  const [testingRequirements, setTestingRequirements] = useState(
    "• Test on ARM64 and armeabi-v7a\n• Test on Android 12, 13, 14, 15\n• Verify zero crashes on cold launch"
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      toast.error("Please provide initial modding remarks or instructions");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_modding",
          appId: app.id,
          priority,
          assignedModder,
          remarks: remarks.trim(),
          internalInstructions: internalInstructions.trim(),
          testingRequirements: testingRequirements.trim(),
          adminName: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start modding");

      toast.success(`🚀 Modding started for ${app.app_name}! Telegram alert dispatched.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update workflow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card text-left shadow-2xl overflow-hidden my-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <Play className="h-5 w-5 fill-current" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                Workflow Transition: Step 1 ➔ 2
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Start Modding — {app.app_name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RadarPriority)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority 🔥</option>
                <option value="Critical">Critical Priority 🚨</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Assigned Modder
              </label>
              <input
                type="text"
                value={assignedModder}
                onChange={(e) => setAssignedModder(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Internal Modding Remarks <span className="text-destructive">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Private notes preserved in Supabase. Never displayed publicly. Supports multiline notes.
            </p>
            <Textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-xl border-border bg-background text-xs font-mono text-white focus:border-amber-500"
              placeholder="Enter remarks, login requirements, premium patch notes..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Internal Instructions &amp; Required Modifications
            </label>
            <Textarea
              rows={3}
              value={internalInstructions}
              onChange={(e) => setInternalInstructions(e.target.value)}
              className="w-full rounded-xl border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Testing &amp; Verification Requirements
            </label>
            <Textarea
              rows={2}
              value={testingRequirements}
              onChange={(e) => setTestingRequirements(e.target.value)}
              className="w-full rounded-xl border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border-border text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-amber-500 text-black font-extrabold hover:bg-amber-400 text-xs gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              <span>Confirm &amp; Start Modding</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 2. Mark Modded Completed Modal
 */
export function MarkCompletedModal({ app, isOpen, onClose, onSuccess }: ModalProps) {
  const [completionRemarks, setCompletionRemarks] = useState(
    "All premium features unlocked successfully. Passed signature verification and test installation."
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_completed",
          appId: app.id,
          completionRemarks: completionRemarks.trim(),
          adminName: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as completed");

      toast.success(`✅ ${app.app_name} marked as Modded Completed!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card text-left shadow-2xl overflow-hidden my-auto animate-in zoom-in-95">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Workflow Transition: Step 2 ➔ 3
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Mark Modded Completed
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            This confirms that the APK modifications are built, tested, and ready for deployment staging.
            The app stays in Active Radar until final release.
          </p>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Completion Remarks &amp; Validation Notes
            </label>
            <Textarea
              rows={3}
              value={completionRemarks}
              onChange={(e) => setCompletionRemarks(e.target.value)}
              className="w-full rounded-xl border-border bg-background text-xs font-mono text-white focus:border-emerald-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl border-border text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Mark Completed</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 3. Ready to Publish Modal
 */
export function ReadyToPublishModal({ app, isOpen, onClose, onSuccess }: ModalProps) {
  const targetVer = app.current_play_store_version || "v1.0.0";
  const [finalModVersion, setFinalModVersion] = useState(`${targetVer} (Premium Unlocked)`);
  const [downloadUrl, setDownloadUrl] = useState(`https://www.awtmods.in/apps/${app.package_name}.html`);
  const [releaseNotes, setReleaseNotes] = useState(
    "• Clean VIP ad-free interface\n• Premium subscription unlocked\n• Safe anti-ban bypass verified"
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalModVersion.trim()) {
      toast.error("Please enter the final mod version");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_ready",
          appId: app.id,
          finalModVersion: finalModVersion.trim(),
          downloadUrl: downloadUrl.trim(),
          releaseNotes: releaseNotes.trim(),
          adminName: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark ready");

      toast.success(`📦 ${app.app_name} is now Ready to Publish!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card text-left shadow-2xl overflow-hidden my-auto animate-in zoom-in-95">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                Workflow Transition: Step 3 ➔ 4
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Move to Ready to Publish Queue
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Final Mod Version Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={finalModVersion}
              onChange={(e) => setFinalModVersion(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Staging / Download URL
            </label>
            <Input
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Release Notes / Changelog
            </label>
            <Textarea
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl border-border text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              <span>Mark Ready to Publish</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 4. Mark Mod Released Modal (MANDATORY AUTOMATIC RADAR REMOVAL)
 */
export function MarkReleasedModal({ app, isOpen, onClose, onSuccess }: ModalProps) {
  const targetVer = app.current_cycle?.mod_version || `${app.current_play_store_version} VIP Mod`;
  const [releasedModVersion, setReleasedModVersion] = useState(targetVer);
  const [downloadUrl, setDownloadUrl] = useState(
    app.current_cycle?.download_url || `https://www.awtmods.in/download/${app.package_name}`
  );
  const [changelog, setChangelog] = useState(
    app.current_cycle?.changelog || "• Full VIP Mod package\n• Zero ads & direct high-speed download\n• Fully verified on Android 15"
  );
  const [releaseRemarks, setReleaseRemarks] = useState("Released to live catalog & Telegram @awtmods channel.");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasedModVersion.trim() || !downloadUrl.trim()) {
      toast.error("Released version and public download URL are mandatory");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/radar/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_released",
          appId: app.id,
          releasedModVersion: releasedModVersion.trim(),
          downloadUrl: downloadUrl.trim(),
          changelog: changelog.trim(),
          releaseRemarks: releaseRemarks.trim(),
          adminName: "Aadith C V",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as released");

      toast.success(
        `🎉 ${app.app_name} (${releasedModVersion}) officially released and archived from Active Radar!`,
        { duration: 5000 }
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to release mod");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-card text-left shadow-2xl overflow-hidden my-auto animate-in zoom-in-95">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">
                Final Step ➔ MOD_RELEASED
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Publish &amp; Archive Release
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
            <div className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Mandatory Automated Workflow Action</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Upon confirmation, this application is marked <strong>MOD_RELEASED</strong> and automatically removed from Active Radar and all modding queues. It will be permanently archived in <strong>Release History</strong>.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Released Mod Version <span className="text-destructive">*</span>
            </label>
            <Input
              value={releasedModVersion}
              onChange={(e) => setReleasedModVersion(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Public Download URL <span className="text-destructive">*</span>
            </label>
            <Input
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Release Changelog
            </label>
            <Textarea
              rows={2}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              className="border-border bg-background text-xs font-mono text-white focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1">
              Release Remarks (Optional)
            </label>
            <Input
              value={releaseRemarks}
              onChange={(e) => setReleaseRemarks(e.target.value)}
              className="border-border bg-background text-xs text-white focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl border-border text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1.5 shadow-lg shadow-amber-500/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              <span>Mark Released &amp; Archive from Radar</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
