"use client";

import { useState } from "react";
import { Download, AlertCircle, ExternalLink, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanionHelperProps {
  appName: string;
  packageName?: string;
  description?: string;
}

export function CompanionHelper({
  appName,
  packageName = "",
  description = "",
}: CompanionHelperProps) {
  const [downloading, setDownloading] = useState(false);

  // Check if this app needs MicroG (YouTube, ReVanced, Vanced, Instander, etc.)
  const textToCheck = `${appName} ${packageName} ${description}`.toLowerCase();
  const needsMicroG =
    textToCheck.includes("revanced") ||
    textToCheck.includes("vanced") ||
    textToCheck.includes("microg") ||
    textToCheck.includes("gmscore") ||
    (textToCheck.includes("youtube") && (textToCheck.includes("mod") || textToCheck.includes("premium")));

  if (!needsMicroG) {
    return null;
  }

  // Official verified MicroG GmsCore direct link
  const microGUrl = "https://github.com/ReVanced/GmsCore/releases/latest";

  return (
    <div className="rounded-3xl border-2 border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 mb-8 text-left shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Required Companion
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Google Login Helper
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              MicroG / ReVanced GmsCore Required for Google Account Sign-In
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              To sign in with your Google account on {appName} without root, you must have MicroG (GmsCore) installed on your device first.
            </p>
          </div>
        </div>

        <a
          href={microGUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto shrink-0"
        >
          <Button
            type="button"
            className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs gap-2 shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Download MicroG APK</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </Button>
        </a>
      </div>

      <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 text-foreground font-medium">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Install MicroG First
        </span>
        <span className="flex items-center gap-1 text-foreground font-medium">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Open {appName} &amp; Sign In
        </span>
        <span className="flex items-center gap-1 text-foreground font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Clean &amp; Open Source
        </span>
      </div>
    </div>
  );
}
