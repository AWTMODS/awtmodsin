"use client";

import { useState, useEffect } from "react";
import { ModRequest, ModRequestStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, CheckCircle2, Clock, Trash2, ExternalLink, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export function RequestsAdminManager({
  initialRequests,
}: {
  initialRequests: ModRequest[];
}) {
  const [requests, setRequests] = useState<ModRequest[]>(initialRequests);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLiveRequests = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/requests", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch {
      // Fallback
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveRequests();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mod request?")) return;
    try {
      const res = await fetch("/api/admin/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        toast.success("Request deleted!");
      }
    } catch {
      toast.error("Failed to delete request");
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: ModRequestStatus,
    completedSlug?: string
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: newStatus,
          completedAppSlug: completedSlug,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: newStatus,
                ...(completedSlug !== undefined ? { completed_app_slug: completedSlug } : {}),
              }
            : r
        )
      );

      toast.success("Request status updated!");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <span>Active Community Submissions ({requests.length})</span>
        </h3>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchLiveRequests}
            disabled={isRefreshing}
            className="rounded-xl text-xs gap-1.5 h-8 border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Sorted by community upvote priority
          </span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border bg-card/40">
          <p className="text-xs text-muted-foreground">No mod requests submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-3 text-left shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-500/20">
                    <ThumbsUp className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        {req.app_name}
                      </h4>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {req.upvotes || 0} Upvotes
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requested by <strong className="text-foreground">{req.requester_name || "Community"}</strong> • {formatDate(req.created_at)}
                      {req.package_name && ` • ${req.package_name}`}
                    </div>
                  </div>
                </div>

                {/* Status Switcher & Delete */}
                <div className="flex items-center gap-2">
                  <select
                    value={req.status}
                    disabled={updatingId === req.id}
                    onChange={(e) =>
                      handleStatusChange(req.id, e.target.value as ModRequestStatus, req.completed_app_slug)
                    }
                    className="h-9 px-3 rounded-xl border border-border bg-secondary text-xs font-semibold text-foreground focus:outline-none"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed &amp; Released</option>
                    <option value="dismissed">Dismissed</option>
                  </select>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(req.id)}
                    className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    title="Delete Request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-secondary/50 text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground block mb-0.5">Requested Features:</strong>
                {req.features_requested}
              </div>

              {/* Completed Slug input */}
              {req.status === "completed" && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <label className="text-[11px] font-semibold text-foreground shrink-0">
                    Linked App Slug:
                  </label>
                  <Input
                    placeholder="e.g. spotify or vsco"
                    defaultValue={req.completed_app_slug || ""}
                    onBlur={(e) =>
                      handleStatusChange(req.id, "completed", e.target.value.trim())
                    }
                    className="h-8 rounded-lg text-xs font-mono max-w-xs"
                  />
                  {req.completed_app_slug && (
                    <a
                      href={`/apps/${req.completed_app_slug}.html`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      <span>View App</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
