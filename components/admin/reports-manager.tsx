"use client";

import { useState } from "react";
import { UserReport } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Check, X, AlertTriangle, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";

export function ReportsManager({
  initialReports,
}: {
  initialReports: UserReport[];
}) {
  const [reports, setReports] = useState<UserReport[]>(initialReports);
  const [filter, setFilter] = useState<string>("all");

  const filtered = reports.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const handleUpdateStatus = async (
    id: string,
    status: "pending" | "resolved" | "dismissed"
  ) => {
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
        toast.success(`Report marked as ${status}`);
      }
    } catch {
      toast.error("Failed to update report status");
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "broken_link":
        return "Broken Download Link";
      case "outdated_version":
        return "Outdated Version";
      case "incorrect_info":
        return "Incorrect Info";
      case "dmca":
        return "DMCA Inquiry";
      case "security":
        return "Security Issue";
      default:
        return "User Feedback";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {["all", "pending", "resolved", "dismissed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
              filter === status
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {status} ({reports.filter((r) => status === "all" || r.status === status).length})
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center rounded-3xl border border-dashed border-border bg-card/40 text-muted-foreground text-sm">
            No reports in this category.
          </div>
        ) : (
          filtered.map((report) => (
            <div
              key={report.id}
              className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      report.status === "pending"
                        ? "warning"
                        : report.status === "resolved"
                        ? "success"
                        : "outline"
                    }
                    className="capitalize text-[10px]"
                  >
                    {report.status}
                  </Badge>
                  <span className="font-bold text-sm text-foreground">
                    {getTypeLabel(report.report_type)}
                  </span>
                  {report.application_name && (
                    <span className="text-xs text-muted-foreground">
                      on <strong className="text-foreground">{report.application_name}</strong>
                    </span>
                  )}
                </div>

                <span className="text-xs text-muted-foreground">
                  {formatDate(report.created_at)}
                </span>
              </div>

              <p className="text-sm text-muted-foreground bg-secondary/50 p-3.5 rounded-2xl border border-border/80">
                {report.message}
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Sender: {report.email || "Anonymous Visitor"}</span>
                </div>

                <div className="flex items-center gap-2">
                  {report.status !== "resolved" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleUpdateStatus(report.id, "resolved")}
                      className="rounded-xl gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Mark Resolved</span>
                    </Button>
                  )}
                  {report.status !== "dismissed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUpdateStatus(report.id, "dismissed")}
                      className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

