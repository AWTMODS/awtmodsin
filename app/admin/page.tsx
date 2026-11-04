import Link from "next/link";
import {
  getApplications,
  getCategories,
  getReports,
  getSiteStats,
  getAnalyticsChartData,
} from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import {
  Layers,
  Download,
  LayoutGrid,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard | AWTMods",
};

export default async function AdminDashboardPage() {
  const [stats, { applications }, categories, reports, chartData] =
    await Promise.all([
      getSiteStats(),
      getApplications({ limit: 10, sortBy: "downloads" }),
      getCategories(),
      getReports("pending"),
      getAnalyticsChartData(30),
    ]);

  const statCards = [
    {
      title: "Published Apps",
      value: stats.totalApps.toString(),
      sub: "Active in database",
      icon: Layers,
    },
    {
      title: "Recorded Downloads",
      value: formatNumber(stats.totalDownloads),
      sub: "Verified user downloads",
      icon: Download,
    },
    {
      title: "Categories",
      value: stats.totalCategories.toString(),
      sub: "Active genres",
      icon: LayoutGrid,
    },
    {
      title: "Pending Reports",
      value: reports.length.toString(),
      sub: "Issues needing review",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your apps, versions, download mirrors and analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/apps/new">
            <Button size="sm" className="rounded-xl px-4 gap-1.5 font-semibold">
              <PlusCircle className="h-4 w-4" />
              <span>Add New App</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Real Statistics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-2 hover:border-neutral-400/40 transition-colors"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">{c.title}</span>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {c.value}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {c.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts & Top Apps */}
      <DashboardCharts
        topApps={applications}
        totalDownloads={stats.totalDownloads}
        initialChartData={chartData}
      />
    </div>
  );
}
