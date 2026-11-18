import { Metadata } from "next";
import {
  getRadarDashboardStats,
  getRadarTrackedApps,
  getRadarReleases,
  getRadarLogs,
} from "@/lib/radar-engine";
import { RadarDashboardView } from "@/components/radar/radar-dashboard-view";

export const metadata: Metadata = {
  title: "Play Store Version Radar | AWTMods Admin",
  description: "Monitor Android applications on Google Play Store, detect version updates, and control APK modding workflow.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarDashboardPage() {
  const [stats, activeApps, releases, logs] = await Promise.all([
    getRadarDashboardStats(),
    getRadarTrackedApps({ activeOnly: true }),
    getRadarReleases(),
    getRadarLogs(),
  ]);

  return (
    <div className="space-y-6">
      <RadarDashboardView
        initialStats={stats}
        activeApps={activeApps}
        recentActivities={logs.activityLogs}
        recentReleases={releases}
      />
    </div>
  );
}
