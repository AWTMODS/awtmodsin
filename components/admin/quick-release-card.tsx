"use client";

import { useState } from "react";
import Image from "next/image";
import { Application } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Send,
  Loader2,
  AlertCircle,
  Layers,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface ParsedMirror {
  download_type: "external";
  hosting_provider: "mediafire" | "google_drive" | "dropbox" | "mega" | "telegram" | "custom" | "cloudflare_r2" | "supabase_storage";
  download_url: string;
  mirror_name: string;
  is_primary: boolean;
  is_active: boolean;
}

interface ParsedData {
  appQuery: string;
  versionName: string;
  versionCode: number;
  fileSize: string;
  downloadSources: ParsedMirror[];
  releaseNotes: string;
}

export function QuickReleaseCard({
  allApps = [],
  onUpdateSuccess,
}: {
  allApps?: Application[];
  onUpdateSuccess?: (updatedApp: Application) => void;
}) {
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Parsed states
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [matchedApp, setMatchedApp] = useState<Application | null>(null);
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");

  const handleParse = async (textToParse?: string) => {
    const raw = (textToParse ?? inputText).trim();
    if (!raw) {
      toast.error("Please enter app update text to parse");
      return;
    }

    setIsParsing(true);
    try {
      const res = await fetch("/api/admin/quick-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", text: raw }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse update text");
      }

      setParsedData(data.parsed);
      setCandidates(data.candidates || []);

      if (data.matchedApp) {
        setMatchedApp(data.matchedApp);
        setSelectedAppId(data.matchedApp.id);
      } else if (allApps.length > 0) {
        // Fallback to first app in list
        setMatchedApp(allApps[0]);
        setSelectedAppId(allApps[0].id);
      } else {
        setMatchedApp(null);
        setSelectedAppId("");
      }

      toast.success(
        `Parsed ${data.parsed.downloadSources.length} mirror link(s) for ${data.matchedApp?.name || data.parsed.appQuery || "app"}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to parse update text");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedAppId || !parsedData) {
      toast.error("Please select a target application");
      return;
    }
    if (!parsedData.versionName.trim()) {
      toast.error("Version name cannot be empty");
      return;
    }
    if (parsedData.downloadSources.length === 0) {
      toast.error("At least one download mirror URL is required");
      return;
    }

    setIsDeploying(true);
    try {
      const res = await fetch("/api/admin/quick-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy",
          payload: {
            appId: selectedAppId,
            versionName: parsedData.versionName,
            versionCode: parsedData.versionCode,
            fileSize: parsedData.fileSize,
            releaseNotes: parsedData.releaseNotes,
            downloadSources: parsedData.downloadSources,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to deploy update");
      }

      toast.success(
        `🎉 Successfully published ${parsedData.versionName} with ${parsedData.downloadSources.length} mirror(s)!`
      );

      if (onUpdateSuccess && data.app) {
        onUpdateSuccess(data.app);
      }

      // Reset
      setInputText("");
      setParsedData(null);
      setMatchedApp(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to deploy update");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAppChange = (id: string) => {
    setSelectedAppId(id);
    const found =
      candidates.find((a) => a.id === id) || allApps.find((a) => a.id === id);
    if (found) setMatchedApp(found);
  };

  const handleMirrorChange = (
    index: number,
    field: keyof ParsedMirror,
    val: any
  ) => {
    if (!parsedData) return;
    const updated = [...parsedData.downloadSources];
    if (field === "is_primary") {
      // Radio selection: only one primary
      updated.forEach((m, i) => {
        m.is_primary = i === index;
      });
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setParsedData({ ...parsedData, downloadSources: updated });
  };

  const handleRemoveMirror = (index: number) => {
    if (!parsedData) return;
    const updated = parsedData.downloadSources.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((m) => m.is_primary)) {
      updated[0].is_primary = true;
    }
    setParsedData({ ...parsedData, downloadSources: updated });
  };

  const handleAddMirror = () => {
    if (!parsedData) return;
    const newMirror: ParsedMirror = {
      download_type: "external",
      hosting_provider: "mediafire",
      download_url: "https://www.mediafire.com",
      mirror_name: "MediaFire Fast CDN",
      is_primary: parsedData.downloadSources.length === 0,
      is_active: true,
    };
    setParsedData({
      ...parsedData,
      downloadSources: [...parsedData.downloadSources, newMirror],
    });
  };

  const sampleYoutube =
    "youtube v.1.0.1 5267189 https://telegram.me/awtmods https://www.mediafire.com/file/youtube.apk";
  const samplePinterest =
    "pinterest v12.46.0 5267199 68 MB https://telegram.me/awtmods https://www.mediafire.com/file/pinterest.apk https://mega.nz/file/pin";

  return (
    <div className="rounded-3xl border border-primary/20 bg-card p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Smart Quick-Release Engine
              </h2>
              <Badge variant="secondary" className="text-[10px] uppercase font-bold text-primary">
                Multi-Mirror
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste plain text with an app name, version number, code, and 1 or more download links.
            </p>
          </div>
        </div>

        {/* Example Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setInputText(sampleYoutube);
              handleParse(sampleYoutube);
            }}
            className="px-2.5 py-1 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border text-[11px] font-medium transition-colors"
          >
            💡 Try YouTube (2 Mirrors)
          </button>
          <button
            type="button"
            onClick={() => {
              setInputText(samplePinterest);
              handleParse(samplePinterest);
            }}
            className="px-2.5 py-1 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border text-[11px] font-medium transition-colors"
          >
            💡 Try Pinterest (3 Mirrors)
          </button>
        </div>
      </div>

      {/* Input Text Box */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste release text: e.g. youtube v.1.0.1 5267189 https://telegram.me/awtmods https://www.mediafire.com/file/yt.apk"
            className="rounded-2xl resize-none pr-28 text-xs sm:text-sm font-mono border-border focus:border-primary"
          />
          <Button
            type="button"
            disabled={isParsing || !inputText.trim()}
            onClick={() => handleParse()}
            size="sm"
            className="absolute right-3 bottom-3 rounded-xl gap-1.5 font-bold shadow-xs text-xs"
          >
            {isParsing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Parse & Detect</span>
          </Button>
        </div>
      </div>

      {/* Parsed Live Preview Section */}
      {parsedData && (
        <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            {/* Target App Selector */}
            <div className="flex items-center gap-3">
              {matchedApp?.icon_url ? (
                <div className="relative h-11 w-11 rounded-xl overflow-hidden border border-border shrink-0 bg-background">
                  <Image
                    src={matchedApp.icon_url}
                    alt={matchedApp.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
              )}

              <div className="min-w-0 flex-1 max-w-full">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  Target Application
                </div>
                <div className="flex items-center gap-2 max-w-full">
                  <select
                    value={selectedAppId}
                    onChange={(e) => handleAppChange(e.target.value)}
                    className="font-bold text-xs sm:text-sm bg-background border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-none w-full max-w-[210px] sm:max-w-xs md:max-w-md truncate"
                  >
                    {candidates.length > 0 ? (
                      candidates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.slug})
                        </option>
                      ))
                    ) : (
                      allApps.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.slug})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Specs Fields */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  Version
                </span>
                <Input
                  value={parsedData.versionName}
                  onChange={(e) =>
                    setParsedData({ ...parsedData, versionName: e.target.value })
                  }
                  className="h-8 w-24 font-mono text-xs font-bold rounded-lg"
                  placeholder="v1.0.0"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  Code
                </span>
                <Input
                  type="number"
                  value={parsedData.versionCode}
                  onChange={(e) =>
                    setParsedData({
                      ...parsedData,
                      versionCode: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="h-8 w-24 font-mono text-xs rounded-lg"
                  placeholder="1"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  Size
                </span>
                <Input
                  value={parsedData.fileSize}
                  onChange={(e) =>
                    setParsedData({ ...parsedData, fileSize: e.target.value })
                  }
                  className="h-8 w-20 font-mono text-xs rounded-lg"
                  placeholder="50 MB"
                />
              </div>
            </div>
          </div>

          {/* Download Mirrors (Multiple Links Detection) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>Detected Mirrors ({parsedData.downloadSources.length})</span>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  Multi-Host Supported
                </Badge>
              </label>

              <button
                type="button"
                onClick={handleAddMirror}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Mirror</span>
              </button>
            </div>

            <div className="space-y-2">
              {parsedData.downloadSources.map((mirror, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-xl border bg-card text-xs transition-colors ${
                    mirror.is_primary ? "border-primary/40 shadow-xs" : "border-border"
                  }`}
                >
                  {/* Primary Radio */}
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="radio"
                      name="primary_mirror"
                      checked={mirror.is_primary}
                      onChange={() => handleMirrorChange(idx, "is_primary", true)}
                      className="h-3.5 w-3.5 text-primary"
                    />
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {mirror.is_primary ? "Primary Mirror" : "Backup"}
                    </span>
                  </label>

                  {/* Provider Select */}
                  <select
                    value={mirror.hosting_provider}
                    onChange={(e) =>
                      handleMirrorChange(idx, "hosting_provider", e.target.value)
                    }
                    className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none shrink-0"
                  >
                    <option value="telegram">Telegram (t.me)</option>
                    <option value="mediafire">MediaFire</option>
                    <option value="mega">Mega Cloud</option>
                    <option value="google_drive">Google Drive</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="custom">Custom / Direct</option>
                  </select>

                  {/* Mirror Label */}
                  <Input
                    value={mirror.mirror_name}
                    onChange={(e) =>
                      handleMirrorChange(idx, "mirror_name", e.target.value)
                    }
                    placeholder="Mirror Name"
                    className="h-8 text-xs font-medium rounded-lg sm:w-44 shrink-0"
                  />

                  {/* URL */}
                  <div className="flex-1 min-w-0 relative">
                    <Input
                      value={mirror.download_url}
                      onChange={(e) =>
                        handleMirrorChange(idx, "download_url", e.target.value)
                      }
                      placeholder="https://..."
                      className="h-8 text-xs font-mono rounded-lg pr-7"
                    />
                    <a
                      href={mirror.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title="Test URL"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMirror(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Remove mirror"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Release Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">
              Changelog / Release Notes
            </label>
            <Input
              value={parsedData.releaseNotes}
              onChange={(e) =>
                setParsedData({ ...parsedData, releaseNotes: e.target.value })
              }
              placeholder="e.g. Unlocked VIP features, performance fixes, and ad-free experience."
              className="h-8 text-xs rounded-lg"
            />
          </div>

          {/* Action Deploy Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setParsedData(null)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isDeploying}
              onClick={handleDeploy}
              className="rounded-xl font-bold gap-2 text-xs h-9 px-5 shadow-md"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Publishing Version...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Deploy Update Now</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
