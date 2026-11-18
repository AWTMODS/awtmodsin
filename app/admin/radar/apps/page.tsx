import { Metadata } from "next";
import { getRadarTrackedApps } from "@/lib/radar-engine";
import { RadarAppsTable } from "@/components/radar/radar-apps-table";

export const metadata: Metadata = {
  title: "Tracked Applications | Version Radar",
  description: "Manage tracked Android packages, monitor store versions, and initiate modding cycles.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarAppsPage() {
  const apps = await getRadarTrackedApps();

  return (
    <div className="space-y-6">
      <RadarAppsTable initialApps={apps} />
    </div>
  );
}
