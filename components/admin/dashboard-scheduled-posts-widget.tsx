"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Send, Trash2, RefreshCw, CheckCircle2, Calendar, ExternalLink, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ScheduledPost } from "@/lib/telegram-scheduler";

interface DashboardScheduledPostsWidgetProps {
  initialPosts?: ScheduledPost[];
}

export function DashboardScheduledPostsWidget({
  initialPosts = [],
}: DashboardScheduledPostsWidgetProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDateTime, setEditDateTime] = useState("");

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Convert ISO UTC string to "YYYY-MM-DDTHH:mm" in Asia/Kolkata (IST) for datetime-local input
  const toIstInputValue = (iso: string) => {
    try {
      const d = new Date(iso);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
      const hour = get("hour") === "24" ? "00" : get("hour");
      return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
    } catch {
      return "";
    }
  };

  const handleStartEdit = (post: ScheduledPost) => {
    setEditingId(post.id);
    setEditDateTime(toIstInputValue(post.scheduledFor));
  };

  const handleSaveReschedule = async (post: ScheduledPost) => {
    if (!editDateTime) {
      toast.error("Please select a valid date and time");
      return;
    }
    const parsed = new Date(`${editDateTime}:00+05:30`);
    if (Number.isNaN(parsed.getTime())) {
      toast.error("Invalid date/time format");
      return;
    }

    setBusyId(post.id);
    try {
      const res = await fetch("/api/admin/telegram/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          postId: post.id,
          scheduledFor: parsed.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reschedule");
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
      setEditingId(null);
      toast.success(`📅 Updated schedule for ${post.appName} to ${formatIstTime(parsed.toISOString())}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule post");
    } finally {
      setBusyId(null);
    }
  };

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const recentCompleted = posts.filter((p) => p.status === "published").slice(0, 3);

  const formatIstTime = (iso: string) => {
    try {
      return (
        new Date(iso).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }) + " IST"
      );
    } catch {
      return iso;
    }
  };

  const formatCountdown = (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now();
    if (diffMs <= 0) return "Due now (next cron)";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `in ${hours}h ${remMins}m` : `in ${hours}h`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/telegram/scheduled", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch {
      toast.error("Failed to refresh scheduled posts");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAction = async (post: ScheduledPost, action: "publish_now" | "cancel") => {
    setBusyId(post.id);
    try {
      const res = await fetch("/api/admin/telegram/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
      toast.success(
        action === "publish_now"
          ? `🚀 Broadcasted ${post.appName} to Telegram!`
          : `🗑️ Cancelled scheduled post for ${post.appName}`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update scheduled post");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-foreground tracking-tight">
                Scheduled Telegram Posts
              </h3>
              {pendingPosts.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {pendingPosts.length} Queued
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/60 border border-border px-2 py-0.5 rounded-full">
                  None Pending
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Telegram channel broadcasts queued from Admin Bot replies or Scheduler.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isRefreshing}
          onClick={handleRefresh}
          className="rounded-xl px-3.5 gap-1.5 font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Pending Queue */}
      {pendingPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingPosts.map((post) => (
            <div
              key={post.id}
              className="p-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-foreground line-clamp-1" title={post.appName}>
                    {post.appName}
                  </span>
                  <Link
                    href={`/apps/${post.appSlug}.html`}
                    target="_blank"
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 shrink-0"
                    title="View on Website"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(post)}
                    className="inline-flex items-center gap-1 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md font-semibold transition-colors"
                    title="Click to edit scheduled date & time (IST)"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{formatIstTime(post.scheduledFor)}</span>
                    <Pencil className="h-2.5 w-2.5 ml-0.5 opacity-80" />
                  </button>
                  <span className="text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    {formatCountdown(post.scheduledFor)}
                  </span>
                </div>

                {editingId === post.id && (
                  <div className="mt-2 p-2.5 rounded-xl bg-background/80 border border-emerald-500/30 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Custom Date &amp; Time (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={editDateTime}
                      onChange={(e) => setEditDateTime(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        disabled={busyId === post.id}
                        onClick={() => handleSaveReschedule(post)}
                        className="flex-1 h-7 rounded-lg text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-black gap-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save Time</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === post.id}
                        onClick={() => setEditingId(null)}
                        className="h-7 px-2 rounded-lg text-[11px]"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  disabled={busyId === post.id}
                  onClick={() => handleAction(post, "publish_now")}
                  className="flex-1 h-8 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black gap-1.5"
                >
                  {busyId === post.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Post Now</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === post.id}
                  onClick={() => handleAction(post, "cancel")}
                  className="h-8 px-2.5 rounded-xl text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  title="Cancel Scheduled Post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>
            No pending Telegram broadcasts in the schedule queue. Reply to a staged APK in Telegram with a DevUploads link to schedule one.
          </span>
        </div>
      )}

      {/* Recently Published via Schedule */}
      {recentCompleted.length > 0 && (
        <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Recently Sent:</span>
          {recentCompleted.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/60"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {p.appName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
