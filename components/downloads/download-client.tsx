"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  ExternalLink,
  Check,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Send,
  Zap,
  Sparkles,
  ShieldCheck,
  X,
  Info,
} from "lucide-react";
import { Application, ApplicationVersion, DownloadSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cleanAppSlug } from "@/lib/utils";
import { AdBanner } from "@/components/ads/ad-banner";

interface DownloadClientProps {
  app: Application;
  version: ApplicationVersion;
  mirrors: DownloadSource[];
  currentMirror?: DownloadSource;
  countdownSeconds: number;
  botUsername?: string;
  vipPrice?: number;
  adSettings?: {
    masterEnabled?: boolean;
    countdownAdHtml?: string;
    countdownAdEnabled?: boolean;
    mobileEnabled?: boolean;
    desktopEnabled?: boolean;
  };
}

export function DownloadClient({
  app,
  version,
  mirrors,
  currentMirror,
  countdownSeconds = 5,
  botUsername = "awtmods_bot",
  vipPrice = 20,
  adSettings,
}: DownloadClientProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const [activeMirror, setActiveMirror] = useState<DownloadSource | undefined>(currentMirror);
  const [hasStarted, setHasStarted] = useState(false);
  const [downloadInitiated, setDownloadInitiated] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);

  const cleanSlug = cleanAppSlug(app.slug);
  const telegramBotDeepLink = `https://t.me/${botUsername}?start=dl_${cleanSlug.slice(0, 50)}`;

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

  const getProviderName = (provider: string, mirrorName?: string | null) => {
    if (mirrorName && mirrorName.toLowerCase().includes("devupload")) {
      return "DevUploads Fast CDN";
    }
    if (mirrorName && mirrorName.toLowerCase().includes("exastash")) {
      return "ExaStash Cloud CDN";
    }
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
    <div className="py-6 text-center space-y-6">
      {/* ⚡ VIP Direct File Option (Telegram Bot Delivery) */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent p-5 sm:p-6 text-left shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Zap className="h-3.5 w-3.5 fill-current" />
                VIP Fast Track • ₹{vipPrice}/mo
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                Admin Verified &amp; Instant
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
              <span>Get Direct File via Telegram</span>
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Skip waiting timers, ad shorteners, and captchas. Get the direct .apk delivered straight to your Telegram chat via <strong className="text-foreground">@{botUsername}</strong> with full 5G speed!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:shrink-0">
            <a
              href={telegramBotDeepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-block"
            >
              <Button
                type="button"
                className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold text-sm gap-2 shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Get Direct File (Fast)</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </a>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVipModal(true)}
              className="h-12 px-3 rounded-2xl border-amber-500/30 text-xs font-semibold text-foreground hover:bg-amber-500/10"
              title="How VIP Works"
            >
              <Info className="h-4 w-4 text-amber-500" />
              <span className="sm:hidden ml-1">How it Works</span>
            </Button>
          </div>
        </div>

        {/* Quick Perks Strip */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>0-Second Wait</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>100% Ad-Free</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>Direct Telegram APK</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>All Catalog Apps Included</span>
          </div>
        </div>
      </div>

      {/* Modern Separator */}
      <div className="relative flex items-center justify-center my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80" />
        </div>
        <span className="relative bg-card px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Or Continue With Free Mirror (With Ads)
        </span>
      </div>

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

          {/* Interstitial Ad Slot during Countdown */}
          {adSettings?.countdownAdEnabled && (
            <AdBanner
              html={adSettings.countdownAdHtml}
              enabled={adSettings.countdownAdEnabled}
              masterEnabled={adSettings.masterEnabled}
              mobileEnabled={adSettings.mobileEnabled}
              desktopEnabled={adSettings.desktopEnabled}
              slotName="Sponsored Advertisement"
              className="max-w-md mx-auto"
            />
          )}
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
              Hosted on {activeMirror ? getProviderName(activeMirror.hosting_provider, activeMirror.mirror_name) : "External Host"} • File size: {version.file_size}
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="max-w-md mx-auto space-y-3">
            <Button
              size="lg"
              onClick={triggerDownload}
              className="w-full h-14 sm:h-16 rounded-2xl text-base sm:text-lg font-bold shadow-lg gap-2.5 hover:shadow-xl transition-all"
            >
              <Download className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>
                {downloadInitiated
                  ? "Download Again"
                  : (app as any).platform === "pc" || app.category?.slug === "pc-software"
                  ? "Download Software Now"
                  : "Download APK Now"}
              </span>
              <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 ml-1 opacity-70" />
            </Button>

            {/* Join Telegram Button */}
            <a
              href="https://t.me/awtmods"
              target="_blank"
              rel="noreferrer"
              className="block w-full"
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12 sm:h-13 rounded-2xl text-sm sm:text-base font-semibold border-border bg-secondary/50 hover:bg-secondary gap-2.5 transition-all text-foreground"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" />
                <span>Join Telegram Channel</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 ml-auto" />
              </Button>
            </a>

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
                      {mirror.mirror_name || getProviderName(mirror.hosting_provider, mirror.mirror_name)}
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
          href={`/report-issue?app=${app.slug.replace(/\.html$/i, "")}&type=broken_link&version=${version.version_name}`}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Is this download link broken or unavailable? Report here</span>
        </Link>
      </div>

      {/* VIP Explained Modal */}
      {showVipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/40 bg-card p-6 sm:p-8 text-left shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowVipModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 block">
                  AWTMods Premium Pass
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  VIP Direct Telegram Delivery
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                Get unlimited direct <strong className="text-foreground">.apk</strong> downloads delivered straight to your Telegram chat via <strong className="text-foreground">@{botUsername}</strong> without any waiting countdowns, shorteners, or captchas.
              </p>

              <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-2.5">
                <div className="font-bold text-foreground text-xs pb-1 border-b border-border">
                  ✨ What You Get with VIP (₹{vipPrice}/month):
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Zero Ads:</strong> No link shorteners, popups, or redirect loops.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>0-Second Countdown:</strong> Immediate file delivery right into your Telegram chat.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Full 5G Speeds:</strong> Direct CDN speed with 1-tap APK installation.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>All Catalog Apps:</strong> Valid for unlimited downloads across our entire library for 30 days.</span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1">
                <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>How it works:</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  1. Tap the button below to open <strong className="text-foreground">@{botUsername}</strong>.
                  <br />
                  2. The bot gives you simple UPI payment details (₹{vipPrice}/mo).
                  <br />
                  3. Send your payment screenshot in the bot.
                  <br />
                  4. Admin confirms and the bot sends your APK file instantly!
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <a
                href={telegramBotDeepLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1"
                onClick={() => setShowVipModal(false)}
              >
                <Button className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold gap-2 shadow-lg">
                  <Zap className="h-4 w-4 fill-current" />
                  <span>Open @{botUsername} in Telegram</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowVipModal(false)}
                className="h-12 rounded-2xl px-5 text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

