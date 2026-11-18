import { Metadata } from "next";
import { getRadarReleases } from "@/lib/radar-engine";
import { RadarReleaseHistory } from "@/components/radar/radar-release-history";

export const metadata: Metadata = {
  title: "Released Mods Archive | Version Radar",
  description: "Permanent archive of all released mods with version history, changelogs, and download links.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarReleasesPage() {
  const releases = await getRadarReleases();

  return (
    <div className="space-y-6">
      <RadarReleaseHistory initialReleases={releases} />
    </div>
  );
}
