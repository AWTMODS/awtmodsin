"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Application, AppCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber, getAppUrl } from "@/lib/utils";
import {
  Search,
  Filter,
  PlusCircle,
  MoreVertical,
  ExternalLink,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Star,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface AppsTableProps {
  initialApps: Application[];
  categories: AppCategory[];
  defaultStatus?: string;
}

export function AppsTable({
  initialApps,
  categories,
  defaultStatus = "",
}: AppsTableProps) {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);

  // Auto-Generate Quick Modal States
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickStatus, setQuickStatus] = useState<"published" | "draft">("published");
  const [quickLoading, setQuickLoading] = useState(false);

  const handleQuickCreate = async () => {
    const q = quickQuery.trim();
    if (!q) {
      toast.error("Please enter an application name");
      return;
    }
    setQuickLoading(true);
    try {
      const res = await fetch("/api/admin/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          createImmediately: true,
          status: quickStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.app) {
        throw new Error(data.error || "Failed to auto-create application");
      }

      setApps((prev) => [data.app, ...prev]);
      setShowAutoModal(false);
      setQuickQuery("");
      toast.success(
        `✨ Successfully created "${data.app.name}" (${quickStatus})!`,
        {
          action: {
            label: "Edit Post",
            onClick: () => router.push(`/admin/apps/${data.app.id}/edit`),
          },
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-create app");
    } finally {
      setQuickLoading(false);
    }
  };

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      !search ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.developer.toLowerCase().includes(search.toLowerCase()) ||
      app.package_name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      !selectedCategory || app.category_id === selectedCategory;

    const matchesStatus = !selectedStatus || app.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggleStatus = async (app: Application) => {
    const newStatus = app.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
        );
        toast.success(`App status changed to ${newStatus}`);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFeatured = async (app: Application) => {
    const newFeatured = !app.is_featured;
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured: newFeatured }),
      });
      if (res.ok) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === app.id ? { ...a, is_featured: newFeatured } : a
          )
        );
        toast.success(
          newFeatured ? "Marked as Featured" : "Removed from Featured"
        );
      }
    } catch {
      toast.error("Failed to update featured flag");
    }
  };

  const handleDelete = async (app: Application) => {
    if (!confirm(`Are you sure you want to permanently delete "${app.name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/apps/${app.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== app.id));
        toast.success(`Deleted ${app.name}`);
      }
    } catch {
      toast.error("Failed to delete application");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search apps by name, developer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
          >
            <option value="">All Statuses ({apps.length})</option>
            <option value="published">
              Published ({apps.filter((a) => a.status === "published").length})
            </option>
            <option value="draft">
              Draft ({apps.filter((a) => a.status === "draft").length})
            </option>
            {apps.some((a) => a.status === "archived") && (
              <option value="archived">
                Archived ({apps.filter((a) => a.status === "archived").length})
              </option>
            )}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAutoModal(true)}
            className="rounded-xl gap-1.5 font-bold border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shrink-0 shadow-2xs"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Auto-Create</span>
          </Button>

          <Link href="/admin/apps/new">
            <Button size="sm" className="rounded-xl gap-1.5 font-semibold shrink-0">
              <PlusCircle className="h-4 w-4" />
              <span>Add New App</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Applications Data Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Application</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Downloads</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No applications found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => {
                  const version = app.latest_version?.version_name || "v1.0";
                  const size = app.latest_version?.file_size || "50 MB";

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* App Icon + Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary flex items-center justify-center font-bold text-xs text-foreground">
                            {app.icon_url && (
                              <img
                                src={app.icon_url}
                                alt={app.name}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            )}
                            <span>{app.name.slice(0, 1)}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{app.name}</span>
                              {app.is_featured && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {app.developer}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Version */}
                      <td className="py-3 px-4 font-mono text-xs">{version}</td>

                      {/* Size */}
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {size}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="outline" className="text-[11px] font-normal">
                            {app.category?.name || "General"}
                          </Badge>
                          {(app.platform === "pc" || app.category?.slug === "pc-software") && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                              PC / Windows
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            app.status === "published" ? "success" : "warning"
                          }
                          className="capitalize cursor-pointer"
                          onClick={() => handleToggleStatus(app)}
                          title="Click to toggle status"
                        >
                          {app.status}
                        </Badge>
                      </td>

                      {/* Downloads */}
                      <td className="py-3 px-4 font-mono text-xs">
                        {formatNumber(app.downloads_count ?? 0)}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/admin/apps/${app.id}/edit`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Application"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>

                          <Link
                            href={getAppUrl(app.slug)}
                            target="_blank"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Preview Public Page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>

                          <button
                            onClick={() => handleToggleFeatured(app)}
                            className={`p-1.5 rounded-lg hover:bg-muted ${
                              app.is_featured
                                ? "text-amber-500"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            title="Toggle Featured"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(app)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete App"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Create Quick Modal Dialog */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowAutoModal(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Auto-Generate App Post
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type any app name to auto-fetch official images, description, & specs.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Application Name or Store URL
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Spotify Mod, Subway Surfers, CapCut, Minecraft..."
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !quickLoading) {
                      e.preventDefault();
                      handleQuickCreate();
                    }
                  }}
                  disabled={quickLoading}
                  className="w-full h-11 px-4 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Post Initial Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickStatus("published")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      quickStatus === "published"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Published (Live)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickStatus("draft")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      quickStatus === "draft"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground border-border hover:bg-secondary"
                    }`}
                  >
                    <span>Draft (Review First)</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAutoModal(false);
                    router.push(
                      `/admin/apps/new?autoQuery=${encodeURIComponent(quickQuery.trim())}`
                    );
                  }}
                  disabled={quickLoading || !quickQuery.trim()}
                  className="rounded-xl flex-1 h-11 text-xs font-bold"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  <span>Open in Editor</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleQuickCreate}
                  disabled={quickLoading || !quickQuery.trim()}
                  className="rounded-xl flex-1 h-11 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {quickLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Creating Post...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5 text-amber-400" />
                      <span>Instant Create</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

