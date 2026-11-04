"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Application } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, PlusCircle, Inbox } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface DashboardChartsProps {
  topApps: Application[];
  totalDownloads: number;
  initialChartData?: { date: string; downloads: number }[];
}

export function DashboardCharts({
  topApps,
  totalDownloads,
  initialChartData = [],
}: DashboardChartsProps) {
  const [range, setRange] = useState<"7" | "30" | "90">("30");

  // If no chart data or 0 downloads, provide a clean neutral baseline
  const chartData =
    initialChartData.length > 0
      ? initialChartData
      : [
          { date: "Day 1", downloads: 0 },
          { date: "Day 5", downloads: 0 },
          { date: "Day 10", downloads: 0 },
          { date: "Day 15", downloads: 0 },
          { date: "Day 20", downloads: 0 },
          { date: "Day 25", downloads: 0 },
          { date: "Today", downloads: totalDownloads },
        ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Downloads Overview Chart */}
      <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Downloads Overview
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {totalDownloads.toLocaleString()}
              </span>
              {totalDownloads > 0 && (
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Realtime Active
                </span>
              )}
            </div>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary p-1 text-xs font-medium">
            <button
              onClick={() => setRange("7")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                range === "7"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setRange("30")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                range === "30"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setRange("90")}
              className={`px-3 py-1 rounded-lg transition-colors ${
                range === "90"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              90 Days
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 sm:h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="currentColor" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.6}
              />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: "1rem",
                  color: "var(--foreground)",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="downloads"
                stroke="var(--foreground)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#downloadGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Applications Leaderboard */}
      <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/70">
          <h3 className="font-bold text-base text-foreground">Top Apps</h3>
          <Link
            href="/admin/apps"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            <span>Manage</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topApps.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Inbox className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">
              No applications published yet.
            </p>
            <Link
              href="/admin/apps/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground underline"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Add First Application</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {topApps.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                    {app.icon_url ? (
                      <Image
                        src={app.icon_url}
                        alt={app.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs">
                        {app.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-foreground truncate">
                      {app.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {app.category?.name || "App"}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-xs font-bold text-foreground">
                  {formatNumber(app.downloads_count || 0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
