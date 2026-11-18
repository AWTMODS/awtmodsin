"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ModRequest, ModRequestStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Search,
  Plus,
  ThumbsUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface RequestsBoardProps {
  initialRequests: ModRequest[];
}

export function RequestsBoard({ initialRequests }: RequestsBoardProps) {
  const [requests, setRequests] = useState<ModRequest[]>(initialRequests);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"upvotes" | "latest">("upvotes");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());

  // Form state
  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [featuresRequested, setFeaturesRequested] = useState("");
  const [requesterName, setRequesterName] = useState("");

  // Load upvoted from localStorage & sync live requests
  useEffect(() => {
    try {
      const stored = localStorage.getItem("awtmods_upvoted_requests");
      if (stored) {
        setUpvotedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore
    }

    fetch("/api/requests", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.requests) && data.requests.length > 0) {
          setRequests(data.requests);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpvote = async (id: string) => {
    if (upvotedIds.has(id)) {
      toast.info("You already upvoted this request!");
      return;
    }

    // Optimistic update
    setUpvotedIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem("awtmods_upvoted_requests", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, upvotes: (r.upvotes || 0) + 1 } : r))
    );

    try {
      const res = await fetch("/api/requests/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Upvote failed");
      toast.success("Upvote recorded!");
    } catch {
      toast.error("Failed to register upvote");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !featuresRequested.trim()) {
      toast.error("Please provide both an App Name and Requested Features.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: appName,
          package_name: packageName,
          features_requested: featuresRequested,
          requester_name: requesterName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      setRequests((prev) => [data.request, ...prev]);
      setShowSubmitModal(false);
      setAppName("");
      setPackageName("");
      setFeaturesRequested("");
      setRequesterName("");
      toast.success("Mod request submitted to the community board!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.app_name.toLowerCase().includes(q) ||
          r.features_requested.toLowerCase().includes(q) ||
          (r.package_name && r.package_name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === "upvotes") {
          return (b.upvotes || 0) - (a.upvotes || 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [requests, searchQuery, statusFilter, sortBy]);

  const getStatusBadge = (status: ModRequestStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed &amp; Released</span>
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 gap-1 text-[10px]">
            <Clock className="h-3 w-3" />
            <span>In Progress / Modding</span>
          </Badge>
        );
      case "dismissed":
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            Not Feasible
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>Under Community Review</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search, Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requested apps or features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-2xl text-xs h-11"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-3 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-11 px-3 rounded-2xl border border-border bg-card text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="upvotes">🔥 Most Upvoted</option>
            <option value="latest">⏰ Newest First</option>
          </select>

          <Button
            onClick={() => setShowSubmitModal(true)}
            className="h-11 px-5 rounded-2xl font-bold text-xs gap-1.5 shrink-0 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Request a Mod</span>
          </Button>
        </div>
      </div>

      {/* Requests Grid */}
      {filteredRequests.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
          <Sparkles className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-base font-bold text-foreground">
            No matching mod requests found
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Be the first to request an app or game you want modified!
          </p>
          <Button
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="rounded-xl mt-2 font-semibold"
          >
            Submit First Request
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const isUpvoted = upvotedIds.has(req.id);
            return (
              <div
                key={req.id}
                className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-3.5 shadow-xs hover:border-border/80 transition-all text-left flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {req.app_name}
                      </h3>
                      {req.package_name && (
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          {req.package_name}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(req.status)}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {req.features_requested}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    By <strong className="text-foreground">{req.requester_name || "Community Member"}</strong> • {formatDate(req.created_at)}
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === "completed" && req.completed_app_slug && (
                      <Link href={`/apps/${req.completed_app_slug}.html`}>
                        <Button
                          size="sm"
                          className="h-9 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold gap-1 shadow-xs"
                        >
                          <span>Get Mod</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}

                    <Button
                      size="sm"
                      variant={isUpvoted ? "default" : "outline"}
                      onClick={() => handleUpvote(req.id)}
                      className={`h-9 px-3 rounded-xl text-xs font-bold gap-1.5 transition-all ${
                        isUpvoted
                          ? "bg-amber-500 hover:bg-amber-600 text-black shadow-xs"
                          : "border-border hover:bg-secondary text-foreground"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{req.upvotes || 0}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Request Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 text-left shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 block">
                Community Board
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Request a Mod or App
              </h3>
              <p className="text-xs text-muted-foreground">
                Tell us which Android app or game you want us to mod and release next.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  App or Game Name *
                </label>
                <Input
                  required
                  placeholder="e.g. VSCO Cam, CapCut, Nova Launcher Prime"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Package Name or Play Store Link (Optional)
                </label>
                <Input
                  placeholder="e.g. com.vsco.cam or https://play.google.com/..."
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Requested Mod Features *
                </label>
                <Textarea
                  required
                  rows={3}
                  placeholder="e.g. All Pro presets unlocked, Ad-free, No watermark on video exports, 60fps unlocked..."
                  value={featuresRequested}
                  onChange={(e) => setFeaturesRequested(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Your Name / Alias (Optional)
                </label>
                <Input
                  placeholder="e.g. Alex"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  className="rounded-xl text-xs px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl text-xs font-bold px-6 shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Request</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
