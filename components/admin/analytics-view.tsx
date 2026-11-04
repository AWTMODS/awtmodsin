"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Application } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Download, Globe, HardDrive, BarChart2, Inbox } from "lucide-react";

const COLORS = ["#FFFFFF", "#D4D4D4", "#A3A3A3", "#737373", "#525252"];

export function AnalyticsView({
  apps,
  totalDownloads,
}: {
  apps: Application[];
  totalDownloads: number;
}) {
  const appBarData = apps.slice(0, 8).map((app) => ({
    name: app.name,
    downloads: app.downloads_count || 0,
  }));

  // Calculate actual hosting provider usage from published app mirrors
  const providerCounts: Record<string, number> = {};
  apps.forEach((app) => {
    app.latest_version?.download_sources?.forEach((src) => {
      const p = src.hosting_provider.replace("_", " ");
      providerCounts[p] = (providerCounts[p] || 0) + 1;
    });
  });

  const totalMirrorsCount = Object.values(providerCounts).reduce((a, b) => a + b, 0);

  const providerData =
    totalMirrorsCount > 0
      ? Object.entries(providerCounts).map(([name, count]) => ({
          name,
          value: Math.round((count / totalMirrorsCount) * 100),
        }))
      : [{ name: "No Active Mirrors", value: 100 }];

  return (
    <div className="space-y-8">
      {/* Top Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl border border-border bg-card space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Total Tracked Downloads
          </div>
          <div className="text-3xl font-extrabold text-foreground font-mono">
            {totalDownloads.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Verified download events
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Active Mirrors Configured
          </div>
          <div className="text-3xl font-extrabold text-foreground font-mono">
            {totalMirrorsCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Across configured hosting providers
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-border bg-card space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Applications Tracked
          </div>
          <div className="text-3xl font-extrabold text-foreground font-mono">
            {apps.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Published packages
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart: Downloads by Application */}
        <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground">
              Downloads by Application
            </h3>
            <span className="text-xs text-muted-foreground">
              Direct and external referrals
            </span>
          </div>

          {appBarData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <p className="text-xs">No application download metrics available yet.</p>
            </div>
          ) : (
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "1rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="downloads"
                    fill="var(--foreground)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Donut Chart: Hosting Provider Share */}
        <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-bold text-base text-foreground">
            Hosting Provider Distribution
          </h3>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {providerData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/70 text-xs">
            {providerData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground capitalize">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-foreground">
                  {totalMirrorsCount > 0 ? `${item.value}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
