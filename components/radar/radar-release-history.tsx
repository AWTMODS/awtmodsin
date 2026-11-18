"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  Search,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  User,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RadarRelease } from "@/lib/radar-engine";

interface RadarReleaseHistoryProps {
  initialReleases: RadarRelease[];
}

export function RadarReleaseHistory({ initialReleases }: RadarReleaseHistoryProps) {
  const [releases] = useState<RadarRelease[]>(initialReleases);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "name">("date-desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredReleases = useMemo(() => {
    return releases
      .filter((rel) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
          rel.app_name.toLowerCase().includes(q) ||
          rel.package_name.toLowerCase().includes(q) ||
          rel.released_mod_version.toLowerCase().includes(q) ||
          (rel.original_play_store_version && rel.original_play_store_version.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") {
          return new Date(b.released_at).getTime() - new Date(a.released_at).getTime();
        }
        if (sortBy === "date-asc") {
          return new Date(a.released_at).getTime() - new Date(b.released_at).getTime();
        }
        return a.app_name.localeCompare(b.app_name);
      });
  }, [releases, searchQuery, sortBy]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Download link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Archive className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Released Mods Archive
            </h1>
            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
              {releases.length} Historical Releases
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Permanent archive of all published APK mods. Released apps are automatically moved here from Active Radar.
          </p>
        </div>

        {/* Sort & Search Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search release, package..."
              className="pl-9 h-9 text-xs bg-background border-border text-white rounded-xl focus:border-amber-500"
            />
          </div>

          <div className="flex items-center rounded-xl bg-background border border-border p-0.5">
            <button
              onClick={() => setSortBy("date-desc")}
              title="Newest first"
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                sortBy === "date-desc"
                  ? "bg-card text-amber-500 font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setSortBy("name")}
              title="Sort by name"
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                sortBy === "name"
                  ? "bg-card text-amber-500 font-bold"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {/* Releases List */}
      {filteredReleases.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Archive className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No released mods found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No releases match your search query."
              : "When an app completes the modding pipeline and is marked as 'Mod Released', it will automatically appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReleases.map((rel) => {
            const releaseDate = new Date(rel.released_at).toLocaleDateString([], {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={rel.id}
                className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/40 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-3">
                  {/* Top Bar: Icon, Name & Store Link */}
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center relative">
                      {rel.icon_url ? (
                        <Image
                          src={rel.icon_url}
                          alt={rel.app_name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Sparkles className="h-5 w-5 text-amber-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={`/admin/radar/apps/${rel.radar_app_id}`}
                          className="font-bold text-sm text-white hover:text-amber-400 transition-colors truncate"
                        >
                          {rel.app_name}
                        </Link>
                        <a
                          href={`https://play.google.com/store/apps/details?id=${rel.package_name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-white shrink-0 p-1"
                          title="Open Google Play Store"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {rel.package_name}
                      </p>
                    </div>
                  </div>

                  {/* Version Transition Badge */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border text-xs font-mono">
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] uppercase font-sans text-muted-foreground block">Play Store</span>
                      <span className="text-muted-foreground font-bold truncate block">
                        v{rel.original_play_store_version || "1.0.0"}
                      </span>
                    </div>
                    <span className="text-muted-foreground font-sans">➔</span>
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] uppercase font-sans text-amber-500 block">Released Mod</span>
                      <span className="text-amber-400 font-black truncate block">
                        v{rel.released_mod_version}
                      </span>
                    </div>
                  </div>

                  {/* Changelog Preview */}
                  {rel.changelog && (
                    <div className="text-xs text-muted-foreground line-clamp-2 bg-background/50 p-2 rounded-xl border border-border/60 italic">
                      &ldquo;{rel.changelog}&rdquo;
                    </div>
                  )}

                  {/* Release Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-amber-500" />
                      {releaseDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {rel.released_by || "Admin"}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-border flex items-center gap-2">
                  {rel.download_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(rel.download_url, rel.id)}
                      className="flex-1 h-8 text-xs font-bold rounded-xl border-border bg-background text-white hover:bg-neutral-800 hover:text-amber-400 gap-1.5"
                    >
                      {copiedId === rel.id ? (
                        <>
                          <Check className="h-3 w-3 text-amber-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>
                  )}

                  <Link href={`/admin/radar/apps/${rel.radar_app_id}`} className="flex-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs font-bold rounded-xl border-border bg-background text-muted-foreground hover:text-white hover:bg-neutral-800"
                    >
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
