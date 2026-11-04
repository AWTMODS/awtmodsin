"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Download, ExternalLink, Check, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { Application, ApplicationVersion, DownloadSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DownloadClientProps {
  app: Application;
  version: ApplicationVersion;
  mirrors: DownloadSource[];
  currentMirror?: DownloadSource;
  countdownSeconds: number;
}

export function DownloadClient({
  app,
  version,
  mirrors,
  currentMirror,
  countdownSeconds = 5,
}: DownloadClientProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const [activeMirror, setActiveMirror] = useState<DownloadSource | undefined>(currentMirror);
  const [hasStarted, setHasStarted] = useState(false);
  const [downloadInitiated, setDownloadInitiated] = useState(false);

  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setHasStarted(true);
    }
  }, [secondsLeft]);

  const triggerDownload = async () => {
    if (!activeMirror) return;
    setDownloadInitiated(true);

    // Call download record API
    try {
      await fetch("/api/downloads/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: app.id,
          version_id: version.id,
          download_source_id: activeMirror.id,
          event_type: "initiated",
        }),
      });
    } catch {
      // Non-blocking
    }

    // Open download URL
    if (activeMirror.download_url) {
      window.open(activeMirror.download_url, "_blank", "noopener,noreferrer");
    }
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      mediafire: "MediaFire",
      google_drive: "Google Drive",
      dropbox: "Dropbox",
      mega: "MEGA",
      telegram: "Telegram Channel",
      custom: "External Server",
      cloudflare_r2: "Direct APK",
      supabase_storage: "Direct APK",
    };
    return names[provider] || provider;
  };

  return (
    <div className="py-8 text-center space-y-6">
      {/* Countdown or Ready State */}
      {!hasStarted ? (
        <div className="space-y-4">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-muted">
            <span className="text-3xl font-extrabold text-foreground font-mono">
              {secondsLeft}
            </span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              Preparing Your Download Link...
            </h2>
            <p className="text-xs text-muted-foreground">
              Checking mirrors and security signatures for {app.name} {version.version_name}
            </p>
          </div>
          <button
            onClick={() => setSecondsLeft(0)}
            className="text-xs text-muted-foreground underline hover:text-foreground pt-2"
          >
            Skip countdown
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <Check className="h-3.5 w-3.5" />
              <span>Link is ready to download</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Download {app.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Hosted on {activeMirror ? getProviderName(activeMirror.hosting_provider) : "External Host"} • File size: {version.file_size}
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="max-w-md mx-auto space-y-3">
            <Button
              size="lg"
              onClick={triggerDownload}
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg gap-2"
            >
              <Download className="h-5 w-5" />
              <span>
                {downloadInitiated ? "Download Again" : "Download APK Now"}
              </span>
              <ExternalLink className="h-4 w-4 ml-1 opacity-70" />
            </Button>

            {downloadInitiated && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                ✓ Download requested! The download provider should open in a new tab.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Alternative Mirrors Selector */}
      {mirrors.length > 1 && (
        <div className="pt-6 border-t border-border/60 text-left">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-3">
            Select Alternate Download Mirror
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {mirrors.map((mirror) => {
              const isSelected = activeMirror?.id === mirror.id;
              return (
                <button
                  key={mirror.id}
                  onClick={() => {
                    setActiveMirror(mirror);
                    setDownloadInitiated(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all text-left ${
                    isSelected
                      ? "border-primary bg-secondary/80 font-bold"
                      : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {mirror.mirror_name || getProviderName(mirror.hosting_provider)}
                    </span>
                    {mirror.is_primary && (
                      <Badge variant="outline" className="text-[9px] py-0">
                        Primary
                      </Badge>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-foreground shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Broken Link trigger */}
      <div className="pt-4">
        <Link
          href={`/report-issue?app=${app.slug}&type=broken_link&version=${version.version_name}`}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Is this download link broken or unavailable? Report here</span>
        </Link>
      </div>
    </div>
  );
}

