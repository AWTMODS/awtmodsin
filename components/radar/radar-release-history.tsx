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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#141B17] border border-[#263129]">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#B6F23A]/10 border border-[#B6F23A]/20 flex items-center justify-center text-[#B6F23A]">
              <Archive className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black text-[#F5F7F4] tracking-tight">
              Released Mods Archive
            </h1>
            <Badge className="bg-[#B6F23A]/10 text-[#B6F23A] border-[#B6F23A]/30 text-xs">
              {releases.length} Historical Releases
            </Badge>
          </div>
          <p className="text-xs text-[#929B94] mt-1">
            Permanent archive of all published APK mods. Released apps are automatically moved here from Active Radar.
          </p>
        </div>

        {/* Sort & Search Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#929B94]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search release, package..."
              className="pl-9 h-9 text-xs bg-[#080B0A] border-[#263129] text-[#F5F7F4] rounded-xl focus:border-[#B6F23A]"
            />
          </div>

          <div className="flex items-center rounded-xl bg-[#080B0A] border border-[#263129] p-0.5">
            <button
              onClick={() => setSortBy("date-desc")}
              title="Newest first"
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                sortBy === "date-desc"
                  ? "bg-[#141B17] text-[#B6F23A]"
                  : "text-[#929B94] hover:text-[#F5F7F4]"
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setSortBy("name")}
              title="Sort by name"
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                sortBy === "name"
                  ? "bg-[#141B17] text-[#B6F23A]"
                  : "text-[#929B94] hover:text-[#F5F7F4]"
              }`}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {/* Releases List */}
      {filteredReleases.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#141B17] border border-[#263129] space-y-3">
          <div className="h-12 w-12 rounded-full bg-[#263129]/40 flex items-center justify-center mx-auto text-[#929B94]">
            <Archive className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-[#F5F7F4]">No released mods found</h3>
          <p className="text-xs text-[#929B94] max-w-sm mx-auto">
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
                className="p-4 rounded-2xl bg-[#141B17] border border-[#263129] hover:border-[#B6F23A]/40 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-3">
                  {/* Top Bar: Icon, Name & Store Link */}
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-[#080B0A] border border-[#263129] overflow-hidden shrink-0 flex items-center justify-center relative">
                      {rel.icon_url ? (
                        <Image
                          src={rel.icon_url}
                          alt={rel.app_name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Sparkles className="h-5 w-5 text-[#B6F23A]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={`/admin/radar/apps/${rel.radar_app_id}`}
                          className="font-bold text-sm text-[#F5F7F4] hover:text-[#B6F23A] transition-colors truncate"
                        >
                          {rel.app_name}
                        </Link>
                        <a
                          href={`https://play.google.com/store/apps/details?id=${rel.package_name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#929B94] hover:text-[#F5F7F4] shrink-0 p-1"
                          title="Open Google Play Store"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-[11px] font-mono text-[#929B94] truncate">
                        {rel.package_name}
                      </p>
                    </div>
                  </div>

                  {/* Version Transition Badge */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#080B0A] border border-[#263129] text-xs font-mono">
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] uppercase font-sans text-[#929B94] block">Play Store</span>
                      <span className="text-[#929B94] font-bold truncate block">
                        v{rel.original_play_store_version || "1.0.0"}
                      </span>
                    </div>
                    <span className="text-[#929B94] font-sans">➔</span>
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] uppercase font-sans text-[#B6F23A] block">Released Mod</span>
                      <span className="text-[#B6F23A] font-black truncate block">
                        v{rel.released_mod_version}
                      </span>
                    </div>
                  </div>

                  {/* Changelog Preview */}
                  {rel.changelog && (
                    <div className="text-xs text-[#929B94] line-clamp-2 bg-[#080B0A]/40 p-2 rounded-xl border border-[#263129]/60 italic">
                      &ldquo;{rel.changelog}&rdquo;
                    </div>
                  )}

                  {/* Release Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#929B94]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#B6F23A]" />
                      {releaseDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {rel.released_by || "Admin"}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-[#263129] flex items-center gap-2">
                  {rel.download_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(rel.download_url, rel.id)}
                      className="flex-1 h-8 text-xs font-bold rounded-xl border-[#263129] bg-[#080B0A] text-[#F5F7F4] hover:bg-[#263129] hover:text-[#B6F23A] gap-1.5"
                    >
                      {copiedId === rel.id ? (
                        <>
                          <Check className="h-3 w-3 text-[#B6F23A]" />
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
                      className="w-full h-8 text-xs font-bold rounded-xl border-[#263129] bg-[#080B0A] text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#263129]"
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
