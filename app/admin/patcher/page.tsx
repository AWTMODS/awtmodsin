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
  FileText
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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/patcher/releases");
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
                      title="Test JSON"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
