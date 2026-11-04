"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [apps, setApps] = useState<Application[]>(initialApps);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);

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
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {app.category?.name || "General"}
                        </Badge>
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
    </div>
  );
}

