import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRadarAppById } from "@/lib/radar-engine";
import { RadarAppDetail } from "@/components/radar/radar-app-detail";

interface RadarAppDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: RadarAppDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getRadarAppById(id);
  if (!data?.app) {
    return {
      title: "App Not Found | Version Radar",
    };
  }
  return {
    title: `${data.app.app_name} | Version Radar Hub`,
    description: `Track version changes and manage mod release pipeline for ${data.app.app_name}.`,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarAppDetailPage({ params }: RadarAppDetailPageProps) {
  const { id } = await params;
  const data = await getRadarAppById(id);

  if (!data?.app) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <RadarAppDetail
        app={data.app}
        cycle={data.cycles[0]}
        remarks={data.remarks}
        activities={data.activities}
      />
    </div>
  );
}
