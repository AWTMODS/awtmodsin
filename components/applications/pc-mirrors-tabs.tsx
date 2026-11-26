"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Download, Monitor, Apple, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDownloadUrl } from "@/lib/utils";
import type { DownloadSource } from "@/lib/types";

interface PcMirrorsTabsProps {
  appSlug: string;
  downloadSources: DownloadSource[];
}

type OsTab = "all" | "windows" | "mac";

function classifyMirrorOs(mirror: DownloadSource): { isWin: boolean; isMac: boolean } {
  const hay = `${mirror.mirror_name || ""} ${mirror.download_url || ""}`.toLowerCase();
  const hasMac = /\b(mac|macos|osx|dmg|apple)\b/i.test(hay);
  const hasWin = /\b(win|windows|exe|msi|pc)\b/i.test(hay);

  if (hasMac && hasWin) return { isWin: true, isMac: true };
  if (hasMac) return { isWin: false, isMac: true };
  if (hasWin) return { isWin: true, isMac: false };
  return { isWin: true, isMac: false };
}

export function PcMirrorsTabs({ appSlug, downloadSources }: PcMirrorsTabsProps) {
  const { winMirrors, macMirrors } = useMemo(() => {
    const win: DownloadSource[] = [];
    const mac: DownloadSource[] = [];
    for (const m of downloadSources) {
      const { isWin, isMac } = classifyMirrorOs(m);
      if (isWin) win.push(m);
      if (isMac) mac.push(m);
    }
    return { winMirrors: win, macMirrors: mac };
  }, [downloadSources]);

  const [activeTab, setActiveTab] = useState<OsTab>(() => {
    if (winMirrors.length > 0 && macMirrors.length > 0) return "windows";
    if (macMirrors.length > 0 && winMirrors.length === 0) return "mac";
    return "all";
  });

  const visibleMirrors = useMemo(() => {
    if (activeTab === "windows") return winMirrors.length > 0 ? winMirrors : downloadSources;
    if (activeTab === "mac") return macMirrors.length > 0 ? macMirrors : downloadSources;
    return downloadSources;
  }, [activeTab, winMirrors, macMirrors, downloadSources]);

  return (
    <div className="space-y-4">
      {/* OS Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("windows")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            activeTab === "windows"
              ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Monitor className="h-3.5 w-3.5" />
          <span>Windows ({winMirrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mac")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            activeTab === "mac"
              ? "bg-neutral-200/15 text-foreground border-neutral-400/50"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Apple className="h-3.5 w-3.5" />
          <span>macOS ({macMirrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            activeTab === "all"
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>All ({downloadSources.length})</span>
        </button>
      </div>

      {/* Mirrors List */}
      <div className="space-y-3">
        {visibleMirrors.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
            No {activeTab === "mac" ? "macOS" : "Windows"} mirror added yet. Check the other tab or All Mirrors.
          </div>
        ) : (
          visibleMirrors.map((mirror, index) => {
            const mirrorLabel =
              mirror.mirror_name ||
              (mirror.download_url?.toLowerCase().includes("exastash")
                ? "ExaStash Cloud CDN"
                : mirror.download_url?.toLowerCase().includes("devupload")
                ? "DevUploads Fast Mirror"
                : `${mirror.hosting_provider.toUpperCase()} Mirror`);

            const hostLabel =
              mirror.mirror_name?.toLowerCase().includes("devupload")
                ? "DevUploads Fast CDN"
                : mirror.mirror_name?.toLowerCase().includes("exastash") ||
                  mirror.download_url?.toLowerCase().includes("exastash")
                ? "ExaStash Cloud CDN"
                : mirror.hosting_provider.replace("_", " ");

            const code =
              mirror.mirror_name?.toLowerCase().includes("devupload")
                ? "DEV"
                : mirror.mirror_name?.toLowerCase().includes("exastash") ||
                  mirror.download_url?.toLowerCase().includes("exastash")
                ? "EXA"
                : mirror.hosting_provider.slice(0, 3);

            return (
              <div
                key={mirror.id || index}
                className="flex items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-2xl border border-border bg-secondary/30 hover:border-neutral-400/50 transition-colors overflow-hidden"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-card flex items-center justify-center font-bold text-xs uppercase border border-border text-foreground">
                    {code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {mirrorLabel}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                      <span className="capitalize truncate max-w-[140px] sm:max-w-none">
                        Host: {hostLabel}
                      </span>
                      {mirror.is_primary && (
                        <Badge
                          variant="success"
                          className="text-[9px] sm:text-[10px] shrink-0 py-0 px-1.5 leading-none h-4"
                        >
                          Primary
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Link href={getDownloadUrl(appSlug, { mirrorId: mirror.id })} className="shrink-0">
                  <Button
                    size="sm"
                    className="rounded-xl px-2.5 sm:px-4 h-8 sm:h-9 gap-1 sm:gap-1.5 font-semibold text-xs shrink-0 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {activeTab === "mac"
                        ? "Download Mac"
                        : activeTab === "windows"
                        ? "Download PC"
                        : "Download"}
                    </span>
                  </Button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
