"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MorpheImportButtonProps {
  onImported?: (createdApps: any[]) => void;
  className?: string;
}

/**
 * Reusable Morphe Patches bulk import button + modal.
 * Used in both the Admin Dashboard and Applications Table.
 */
export function MorpheImportButton({
  onImported,
  className = "",
}: MorpheImportButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [namesText, setNamesText] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    createdCount: number;
    skipped: { query: string; packageName: string; reason: string }[];
    notFound: string[];
  } | null>(null);

  const handleImport = async () => {
    const names = namesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      toast.error("Please enter at least one app name (one per line)");
      return;
    }

    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch("/api/admin/morphe-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import from Morphe");
      }

      if (Array.isArray(data.created) && data.created.length > 0 && onImported) {
        onImported(data.created);
      }

      setSummary({
        createdCount: data.created?.length || 0,
        skipped: data.skipped || [],
        notFound: data.notFound || [],
      });

      toast.success(
        `✨ Morphe Import: ${data.created?.length || 0} created, ${data.skipped?.length || 0} skipped, ${data.notFound?.length || 0} not found.`
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Morphe import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setSummary(null);
          setShowModal(true);
        }}
        className={`rounded-xl gap-1.5 font-bold border-cyan-500/35 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 shrink-0 shadow-2xs ${className}`}
      >
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <span>Morphe Import</span>
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Morphe Patches Bulk Import
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Paste app names (one per line) to import from morphe-patches.software
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  App Names (One Per Line)
                </label>
                <textarea
                  rows={7}
                  value={namesText}
                  onChange={(e) => setNamesText(e.target.value)}
                  disabled={loading}
                  placeholder={"Slowly\nStellarium\nSync.ME\nTandem: Language exchange\nTarget\nThe Home Depot"}
                  className="w-full p-3 text-xs sm:text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Initial Post Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("draft")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      status === "draft"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Draft (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("published")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      status === "published"
                        ? "bg-emerald-500 text-black border-emerald-500"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    Published (Live)
                  </button>
                </div>
              </div>

              {summary && (
                <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs space-y-1">
                  <div className="font-bold text-emerald-400">
                    ✅ Created: {summary.createdCount} posts
                  </div>
                  {summary.skipped.length > 0 && (
                    <div className="text-amber-400">
                      ⏭️ Skipped ({summary.skipped.length}):{" "}
                      {summary.skipped.map((s) => s.query).join(", ")}
                    </div>
                  )}
                  {summary.notFound.length > 0 && (
                    <div className="text-rose-400">
                      ❌ Not found ({summary.notFound.length}):{" "}
                      {summary.notFound.join(", ")}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="button"
                onClick={handleImport}
                disabled={loading || !namesText.trim()}
                className="w-full h-11 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    <span>Importing from Morphe Catalog...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    <span>Create Posts from Morphe</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
