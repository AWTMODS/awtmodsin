import { getApplications, getSiteStats } from "@/lib/db";
import { AnalyticsView } from "@/components/admin/analytics-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Download Analytics | AWTMods Admin",
};

export default async function AdminAnalyticsPage() {
  const [stats, { applications }] = await Promise.all([
    getSiteStats(),
    getApplications({
      limit: 10,
      sortBy: "downloads",
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Download Analytics
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Real-time metrics, provider distribution, and installation performance.
        </p>
      </div>

      <AnalyticsView
        apps={applications}
        totalDownloads={stats.totalDownloads}
      />
    </div>
  );
}
