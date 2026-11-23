"use client";

import { useState, useEffect } from "react";
import {
  Smartphone,
  CheckCircle,
  Clock,
  Send,
  Trash2,
  ExternalLink,
  Copy,
  RefreshCw,
  Globe,
  Radio,
  FileText,
  Code,
  X,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface PatcherReleaseItem {
  id: string;
  version_name: string;
  version_code: number;
  release_notes: string;
  status: string;
  created_at: string;
  application?: {
    id: string;
    name: string;
    package_name: string;
    slug: string;
    icon_url: string;
  };
  download_sources?: Array<{
    id: string;
    download_url: string;
    mirror_name: string;
    is_primary: boolean;
  }>;
}

export default function PatcherAdminPage() {
  const [staged, setStaged] = useState<PatcherReleaseItem[]>([]);
  const [live, setLive] = useState<PatcherReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Form overrides mapped by version ID
  const [editUrls, setEditUrls] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [broadcastTg, setBroadcastTg] = useState<Record<string, boolean>>({});
  const [showJson, setShowJson] = useState<Record<string, boolean>>({});

  // Interactive Live JSON Editor Modal states
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [activeJsonItem, setActiveJsonItem] = useState<PatcherReleaseItem | null>(null);
  const [jsonCode, setJsonCode] = useState<string>("");
  const [jsonLoading, setJsonLoading] = useState<boolean>(false);
  const [jsonSaving, setJsonSaving] = useState<boolean>(false);
  const [isCustomJson, setIsCustomJson] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const openJsonEditor = async (item: PatcherReleaseItem) => {
    const pkg = item.application?.package_name || "";
    if (!pkg) {
      toast.error("Application has no package name configured");
      return;
    }
    setActiveJsonItem(item);
    setJsonModalOpen(true);
    setJsonLoading(true);
    setJsonError(null);
    try {
      const res = await fetch(`/api/admin/patcher/json?package=${encodeURIComponent(pkg)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setJsonCode(JSON.stringify(data.payload, null, 2));
        setIsCustomJson(Boolean(data.isCustom));
      } else {
        toast.error(data.error || "Failed to load JSON payload");
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
    } finally {
      setJsonLoading(false);
    }
  };

  const handleJsonChange = (val: string) => {
    setJsonCode(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonCode);
      setJsonCode(JSON.stringify(parsed, null, 2));
      setJsonError(null);
      toast.success("JSON formatted cleanly!");
    } catch (err: any) {
      setJsonError(err.message);
      toast.error("Cannot format invalid JSON: " + err.message);
    }
  };

  const saveCustomJson = async () => {
    if (!activeJsonItem?.application?.package_name) return;
    let parsed: any;
    try {
      parsed = JSON.parse(jsonCode);
    } catch (err: any) {
      setJsonError(err.message);
      toast.error("Please fix JSON syntax errors before saving!");
      return;
    }

    setJsonSaving(true);
    try {
      const res = await fetch("/api/admin/patcher/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_name: activeJsonItem.application.package_name,
          payload: parsed,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`🚀 Custom update JSON for ${activeJsonItem.application.name} saved live!`);
        setIsCustomJson(true);
        loadData();
      } else {
        toast.error(data.error || "Failed to save JSON");
      }
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setJsonSaving(false);
    }
  };

  const resetJsonToDefault = async () => {
    if (!activeJsonItem?.application?.package_name) return;
    if (!confirm(`Reset JSON payload for ${activeJsonItem.application.name} back to default auto-generated format?`)) return;

    setJsonSaving(true);
    try {
      const res = await fetch("/api/admin/patcher/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_name: activeJsonItem.application.package_name,
          resetToDefault: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Reset to auto-generated default successfully!");
        setIsCustomJson(false);
        const refRes = await fetch(`/api/admin/patcher/json?package=${encodeURIComponent(activeJsonItem.application.package_name)}&_t=${Date.now()}`);
        const refData = await refRes.json();
        if (refData.success) {
          setJsonCode(JSON.stringify(refData.payload, null, 2));
          setJsonError(null);
        }
        loadData();
      } else {
        toast.error(data.error || "Failed to reset JSON");
      }
    } catch (e: any) {
      toast.error("Reset failed: " + e.message);
    } finally {
      setJsonSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patcher/releases?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
      const data = await res.json();
      if (data.success) {
        setStaged(data.staged || []);
        setLive(data.live || []);

        // Initialize edit states
        const urls: Record<string, string> = {};
        const notes: Record<string, string> = {};
        const tg: Record<string, boolean> = {};

        (data.staged || []).forEach((item: PatcherReleaseItem) => {
          urls[item.id] = item.download_sources?.[0]?.download_url || "https://telegram.me/ARTWEBTECHOFFICIAL";
          notes[item.id] = item.release_notes || "Base Update\nNew Features\nFixed Bugs";
          tg[item.id] = true;
        });

        setEditUrls(urls);
        setEditNotes(notes);
        setBroadcastTg(tg);
      } else {
        toast.error(data.error || "Failed to load releases");
      }
    } catch (e: any) {
      toast.error("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePublish = async (item: PatcherReleaseItem) => {
    setPublishingId(item.id);
    try {
      const res = await fetch("/api/admin/patcher/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: item.id,
          update_url: editUrls[item.id] || "https://telegram.me/ARTWEBTECHOFFICIAL",
          release_notes: editNotes[item.id] || item.release_notes,
          broadcast_telegram: broadcastTg[item.id] ?? false,
        }),
      });

      const out = await res.json();
      if (res.ok && out.success) {
        toast.success(`🚀 Published ${item.application?.name || "App"} (v${item.version_code}) to LIVE!`);
        loadData();
      } else {
        toast.error(out.error || "Failed to publish release");
      }
    } catch (e: any) {
      toast.error("Publish failed: " + e.message);
    } finally {
      setPublishingId(null);
    }
  };

  const handleDiscard = async (item: PatcherReleaseItem) => {
    if (!confirm(`Discard staged release for ${item.application?.name || "app"} (v${item.version_code})?`)) return;
    try {
      const res = await fetch(`/api/admin/patcher/releases?id=${item.id}`, { method: "DELETE" });
      const out = await res.json();
      if (res.ok && out.success) {
        toast.success(`Discarded ${item.application?.name || "app"} (v${item.version_code})`);
        loadData();
      } else {
        toast.error(out.error || "Failed to discard draft");
      }
    } catch (e: any) {
      toast.error("Discard failed: " + e.message);
    }
  };

  const copyEndpoint = (pkg: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.awtmods.in";
    const fullUrl = `${origin}/api/update?package=${pkg}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Permanent APK update URL copied to clipboard!");
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5 rounded">
              AWTMODS
            </span>
            <h1 className="text-2xl font-black tracking-tight">Patcher Release Staging Center</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated update releases sent from your Android Patcher. Live users only receive updates once approved.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* SECTION 1: STAGED RELEASES QUEUE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">Staged Releases (Pending Approval)</h2>
            <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
              {staged.length}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          When you patch an APK in the Android Patcher app, it is held here as a draft. Upload your APK file to Telegram or DevUploads, paste the link below, and click <strong>Publish Live</strong>.
        </p>

        {staged.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/50 text-muted-foreground text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
            No staged releases waiting. Patch a new APK from your Android Patcher to queue here.
          </div>
        ) : (
          <div className="grid gap-4">
            {staged.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl border-2 border-amber-400/30 bg-card/80 backdrop-blur space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {item.application?.icon_url ? (
                      <img
                        src={item.application.icon_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold">
                        <Smartphone className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-base flex items-center gap-2">
                        {item.application?.name || "Unknown App"}
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {item.application?.package_name}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Staged {new Date(item.created_at).toLocaleTimeString()} • {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 font-mono text-xs text-amber-300">
                    <span>STAGED CODE:</span>
                    <strong className="text-sm font-black text-amber-200">v{item.version_code}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Telegram / Direct Download Link
                    </label>
                    <input
                      type="text"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                      value={editUrls[item.id] ?? ""}
                      onChange={(e) => setEditUrls({ ...editUrls, [item.id]: e.target.value })}
                      placeholder="https://t.me/ARTWEBTECHOFFICIAL/1234"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Changelog Description
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      value={editNotes[item.id] ?? ""}
                      onChange={(e) => setEditNotes({ ...editNotes, [item.id]: e.target.value })}
                      placeholder="Base Update\nNew Features\nFixed Bugs"
                    />
                  </div>
                </div>

                {/* Live JSON Payload Preview */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowJson({ ...showJson, [item.id]: !showJson[item.id] })}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition font-mono font-semibold"
                  >
                    <Code className="w-3.5 h-3.5" />
                    {showJson[item.id] ? "Hide Live JSON Payload ▲" : "Preview Injected Dalvik JSON Payload ▼"}
                  </button>

                  {showJson[item.id] && (
                    <div className="mt-2.5 p-3 rounded-lg bg-black/90 border border-neutral-800 font-mono text-xs text-emerald-400 overflow-x-auto space-y-1">
                      <div className="text-[11px] text-muted-foreground pb-1 border-b border-neutral-800">
                        GET https://www.awtmods.in/api/update?package={item.application?.package_name}
                      </div>
                      <pre className="text-xs leading-relaxed text-emerald-300">
                        {JSON.stringify(
                          [
                            {
                              Header: item.application?.name || "AWTMods App",
                              package_name: item.application?.package_name || "",
                              version_code: item.version_code,
                              force_update: true,
                              title: "Update version ",
                              description_type: 2,
                              html_formatted: false,
                              description: editNotes[item.id] || item.release_notes || "Base Update\nNew Features\nFixed Bugs",
                              update_button_text: "Update Now",
                              Update_dismiss_button_text: "Dismiss",
                              update_url: editUrls[item.id] || "https://telegram.me/ARTWEBTECHOFFICIAL",
                              auto_redirect_enabled: false,
                              auto_redirect_delay: 6,
                              show_only_update_button: true,
                            },
                          ],
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={broadcastTg[item.id] ?? true}
                      onChange={(e) => setBroadcastTg({ ...broadcastTg, [item.id]: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span>Automatically Broadcast release to Telegram channel (@ARTWEBTECHOFFICIAL)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDiscard(item)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition border border-transparent hover:border-red-500/20"
                      title="Discard this draft"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard
                    </button>

                    <button
                      onClick={() => handlePublish(item)}
                      disabled={publishingId === item.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    >
                      {publishingId === item.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          🚀 PUBLISH LIVE RELEASE
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: LIVE RELEASES */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold">Active Live Releases (Currently Served to Users)</h2>
          <span className="bg-emerald-400/10 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-400/20">
            {live.length}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          These are the active version codes served to users. Modded APKs query these permanent URLs automatically.
        </p>

        {live.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/50 text-muted-foreground text-sm">
            No live releases active.
          </div>
        ) : (
          <div className="grid gap-3">
            {live.map((item) => {
              const pkg = item.application?.package_name || "";
              const origin = typeof window !== "undefined" ? window.location.origin : "https://www.awtmods.in";
              const endpoint = `${origin}/api/update?package=${pkg}`;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {item.application?.icon_url ? (
                      <img
                        src={item.application.icon_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-400/10 text-emerald-400 flex items-center justify-center font-bold">
                        <Smartphone className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        {item.application?.name || "Unknown App"}
                        <span className="text-xs font-mono text-muted-foreground">
                          {pkg}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                        <span>Active Version:</span>
                        <strong className="text-emerald-400">v{item.version_code}</strong>
                        <span>•</span>
                        <span>Updated: {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-background border border-border px-2.5 py-1 rounded-lg text-xs font-mono text-muted-foreground max-w-xs truncate">
                      {endpoint}
                    </div>
                    <button
                      onClick={() => copyEndpoint(pkg)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="Copy Permanent URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="Test Live JSON Endpoint"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => openJsonEditor(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition shadow-xs"
                      title="Edit JSON Code for this App"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Edit JSON</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: INTERACTIVE DALVIK UPDATE JSON EDITOR */}
      {jsonModalOpen && activeJsonItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border/70 flex items-start justify-between gap-4 bg-muted/20">
              <div className="flex items-center gap-3 min-w-0">
                {activeJsonItem.application?.icon_url ? (
                  <img
                    src={activeJsonItem.application.icon_url}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover bg-muted border border-border shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold shrink-0">
                    <Code className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-extrabold text-foreground truncate">
                      Edit Update JSON — {activeJsonItem.application?.name}
                    </h3>
                    {isCustomJson ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Custom Live Override Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Auto-Generated Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Package: <b>{activeJsonItem.application?.package_name}</b></span>
                    <span>•</span>
                    <span>Active Version: <b>v{activeJsonItem.version_code}</b></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setJsonModalOpen(false)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Endpoint Information Bar */}
              <div className="p-3 rounded-xl bg-background/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Modded APK Query Endpoint (Permanent URL):
                  </span>
                  <code className="text-xs font-mono text-foreground font-semibold break-all">
                    {typeof window !== "undefined" ? window.location.origin : "https://www.awtmods.in"}
                    /api/update?package={activeJsonItem.application?.package_name}
                  </code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyEndpoint(activeJsonItem.application?.package_name || "")}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </button>
                  <a
                    href={`/api/update?package=${activeJsonItem.application?.package_name}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Test In Browser</span>
                  </a>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-amber-500" />
                    JSON Payload Source:
                  </span>
                  {jsonError ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-md">
                      <AlertCircle className="w-3 h-3" />
                      JSON Syntax Error
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                      <CheckCircle className="w-3 h-3" />
                      Valid JSON
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={formatJson}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition"
                    title="Prettify and format JSON"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Format JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(jsonCode);
                      toast.success("JSON copied to clipboard!");
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                  {isCustomJson && (
                    <button
                      type="button"
                      onClick={resetJsonToDefault}
                      disabled={jsonSaving}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-red-500/10 text-xs font-semibold text-muted-foreground hover:text-red-400 transition"
                      title="Delete custom override and restore auto-generated payload"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset to Default</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Error Callout */}
              {jsonError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="font-mono text-[11px] leading-relaxed break-all">
                    <b>Syntax Error:</b> {jsonError}
                  </div>
                </div>
              )}

              {/* Code Editor Textarea */}
              <div className="relative">
                {jsonLoading ? (
                  <div className="h-80 rounded-xl bg-background border border-border flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Loading current JSON payload...</span>
                  </div>
                ) : (
                  <textarea
                    value={jsonCode}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    spellCheck={false}
                    className="w-full h-80 font-mono text-xs p-4 bg-background border border-border rounded-xl text-emerald-400 focus:outline-none focus:ring-1 focus:ring-amber-500/60 focus:border-amber-500/60 leading-relaxed resize-y selection:bg-amber-500/30"
                    placeholder="Enter JSON payload array or object..."
                  />
                )}
              </div>

              {/* Dalvik Injector Field Reference Guide */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground space-y-1.5">
                <span className="font-bold text-foreground block">
                  💡 Injected Dalvik Payload Field Reference:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  <div>• <code>Header</code>: Name displayed in update dialog banner</div>
                  <div>• <code>version_code</code>: Target update version code (triggers update if &gt; installed)</div>
                  <div>• <code>force_update</code>: <code>true</code> = mandatory, <code>false</code> = dismissible</div>
                  <div>• <code>description</code>: Changelog / update notes shown to users</div>
                  <div>• <code>update_url</code>: Direct download mirror opened on click</div>
                  <div>• <code>update_button_text</code>: Text on update button (e.g. &quot;Update Now&quot;)</div>
                  <div>• <code>auto_redirect_enabled</code>: <code>true</code> to redirect automatically after timer</div>
                  <div>• <code>show_only_update_button</code>: <code>true</code> to hide dismiss button</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-border/70 flex items-center justify-between gap-3 bg-muted/20">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Changes take effect instantly on live modded APKs querying this endpoint.
              </span>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setJsonModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCustomJson}
                  disabled={jsonSaving || !!jsonError || jsonLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {jsonSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Live API...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save &amp; Deploy JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
