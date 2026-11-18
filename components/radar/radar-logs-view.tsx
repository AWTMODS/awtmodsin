"use client";

import { useState } from "react";
import {
  Activity,
  Terminal,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RadarScannerLog, RadarActivityLog } from "@/lib/radar-engine";

interface RadarLogsViewProps {
  scannerLogs: RadarScannerLog[];
  activityLogs: RadarActivityLog[];
}

export function RadarLogsView({ scannerLogs: initialScannerLogs, activityLogs: initialActivityLogs }: RadarLogsViewProps) {
  const [activeTab, setActiveTab] = useState<"scanner" | "activity">("scanner");
  const [scannerLogs, setScannerLogs] = useState<RadarScannerLog[]>(initialScannerLogs);
  const [activityLogs, setActivityLogs] = useState<RadarActivityLog[]>(initialActivityLogs);
  const [isScanning, setIsScanning] = useState(false);

  const handleManualScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/admin/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyTelegram: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Scan completed: Scanned ${data.scanned} apps, detected ${data.updates_detected} new updates.`);
        // Reload logs
        const statsRes = await fetch("/api/admin/radar/stats");
        const statsData = await statsRes.json();
        if (statsData.success) {
          if (statsData.scannerLogs) setScannerLogs(statsData.scannerLogs);
          if (statsData.activityLogs) setActivityLogs(statsData.activityLogs);
        }
      } else {
        toast.error(data.error || "Scanner encountered an error");
      }
    } catch {
      toast.error("Failed to execute scanner");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Terminal className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Radar Logs & Audit Trail
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time execution diagnostics for Play Store automated scanners and admin workflow operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center rounded-xl bg-background border border-border p-1">
            <button
              onClick={() => setActiveTab("scanner")}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "scanner"
                  ? "bg-card text-amber-500 shadow-xs"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Radio className="h-3 w-3" />
              <span>Scanner Runs ({scannerLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === "activity"
                  ? "bg-card text-amber-500 shadow-xs"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Activity className="h-3 w-3" />
              <span>Admin Audit ({activityLogs.length})</span>
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleManualScan}
            disabled={isScanning}
            className="h-9 px-3.5 text-xs font-black rounded-xl bg-amber-500 text-black hover:bg-amber-400 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning..." : "Execute Scan"}</span>
          </Button>
        </div>
      </div>

      {/* Tab Content: Scanner Runs */}
      {activeTab === "scanner" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Automated Scanner Execution History
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Retains up to 100 most recent scanner passes
            </span>
          </div>

          {scannerLogs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs">
              No scanner runs recorded yet. Click &quot;Execute Scan&quot; above to trigger your first run.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {scannerLogs.map((log) => {
                const date = new Date(log.executed_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                const isSuccess = log.errors_count === 0;

                return (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSuccess
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            Play Store Radar Scanner
                          </span>
                          <Badge
                            className={`text-[10px] font-mono px-1.5 py-0 ${
                              isSuccess
                                ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            Trigger: {log.trigger_type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {date}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:gap-4 font-mono text-[11px]">
                      <div className="bg-background border border-border px-2.5 py-1 rounded-lg">
                        <span className="text-muted-foreground">Apps Scanned: </span>
                        <span className="text-white font-bold">{log.scanned_count}</span>
                      </div>

                      <div className="bg-background border border-border px-2.5 py-1 rounded-lg">
                        <span className="text-muted-foreground">Updates Detected: </span>
                        <span className="text-amber-500 font-bold">{log.updates_detected}</span>
                      </div>

                      {log.errors_count > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-lg">
                          <span>Errors: </span>
                          <span className="font-bold">{log.errors_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Admin Activity Audit */}
      {activeTab === "activity" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Admin Operations & State Audit Trail
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Immutable audit history for all modding lifecycle transitions
            </span>
          </div>

          {activityLogs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs">
              No activity logs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activityLogs.map((act) => {
                const date = new Date(act.created_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={act.id}
                    className="p-4 hover:bg-muted/20 transition-colors flex items-start gap-3 text-xs"
                  >
                    <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                      <Activity className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{act.action}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground font-medium">{act.app_name}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {act.performed_by || "Admin"}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          {date}
                        </span>
                      </div>

                      {act.notes && (
                        <div className="text-[11px] text-muted-foreground mt-1 bg-background p-2 rounded-xl border border-border">
                          {act.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
