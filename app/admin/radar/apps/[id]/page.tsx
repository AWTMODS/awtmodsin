import { Metadata } from "next";
import Link from "next/link";
import { getRadarAppById } from "@/lib/radar-engine";
import { RadarAppDetail } from "@/components/radar/radar-app-detail";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

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
    return (
      <div className="p-8 text-center rounded-2xl bg-[#141B17] border border-[#263129] max-w-lg mx-auto my-12 space-y-4">
        <div className="h-12 w-12 rounded-full bg-[#263129] flex items-center justify-center mx-auto text-[#929B94]">
          <ShieldAlert className="h-6 w-6 text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-[#F5F7F4]">Application Not Found in Radar</h2>
        <p className="text-xs text-[#929B94] leading-relaxed">
          The requested application identifier (<code className="font-mono text-[#B6F23A]">{id}</code>) is not currently tracked in the Version Radar database.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link href="/admin/radar/apps">
            <Button size="sm" className="bg-[#B6F23A] text-[#080B0A] hover:bg-[#B6F23A]/90 font-bold text-xs rounded-xl gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Version Radar</span>
            </Button>
          </Link>
        </div>
      </div>
    );
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
