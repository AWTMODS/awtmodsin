import { Metadata } from "next";
import { getRadarTrackedApps } from "@/lib/radar-engine";
import { RadarModdingQueue } from "@/components/radar/radar-modding-queue";

export const metadata: Metadata = {
  title: "Modding Queue | Version Radar",
  description: "Track apps currently in production, testing, and staging ready for release.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarModdingQueuePage() {
  const apps = await getRadarTrackedApps();

  return (
    <div className="space-y-6">
      <RadarModdingQueue initialApps={apps} />
    </div>
  );
}
