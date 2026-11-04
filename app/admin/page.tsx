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
  FileEdit,
  ArrowRight,
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
      getApplications({ limit: 10, sortBy: "downloads", status: "all" }),
      getCategories(),
      getReports("pending"),
      getAnalyticsChartData(30),
    ]);

  const statCards = [
    {
      title: "Published Apps",
      value: (stats.publishedApps ?? stats.totalApps).toString(),
      sub: `${stats.totalApps} total in database`,
      icon: Layers,
      href: "/admin/apps?status=published",
    },
    {
      title: "Draft Apps",
      value: (stats.draftApps ?? 0).toString(),
      sub:
        (stats.draftApps ?? 0) > 0
          ? "Pending review & publish"
          : "No unpublished drafts",
      icon: FileEdit,
      href: "/admin/apps?status=draft",
      highlight: (stats.draftApps ?? 0) > 0,
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
      href: "/admin/categories",
    },
    {
      title: "Pending Reports",
      value: reports.length.toString(),
      sub: "Issues needing review",
      icon: AlertTriangle,
      href: "/admin/reports",
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          const CardContent = (
            <div
              className={`h-full p-4 sm:p-5 rounded-3xl border bg-card shadow-xs space-y-2 transition-all hover:border-neutral-400/50 ${
                c.highlight
                  ? "border-amber-500/40 bg-amber-500/[0.04]"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">{c.title}</span>
                <Icon
                  className={`h-4 w-4 ${
                    c.highlight ? "text-amber-500" : ""
                  }`}
                />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-baseline gap-2">
                <span>{c.value}</span>
                {c.highlight && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded">
                    Action
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {c.sub}
              </div>
            </div>
          );

          if (c.href) {
            return (
              <Link key={i} href={c.href} className="block group">
                {CardContent}
              </Link>
            );
          }

          return <div key={i}>{CardContent}</div>;
        })}
      </div>

      {/* Draft Notification Banner */}
      {(stats.draftApps ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-foreground">
          <div className="flex items-center gap-3">
            <FileEdit className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">
                You have {stats.draftApps} draft {stats.draftApps === 1 ? "application" : "applications"} waiting for review
              </p>
              <p className="text-xs text-muted-foreground">
                Draft apps are unpublished and hidden from public visitors until you publish them.
              </p>
            </div>
          </div>
          <Link
            href="/admin/apps?status=draft"
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            <span>Review Drafts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Analytics Charts & Top Apps */}
      <DashboardCharts
        topApps={applications}
        totalDownloads={stats.totalDownloads}
        initialChartData={chartData}
      />
    </div>
  );
}
