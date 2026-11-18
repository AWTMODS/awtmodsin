import { Metadata } from "next";
import { getRadarLogs } from "@/lib/radar-engine";
import { RadarLogsView } from "@/components/radar/radar-logs-view";

export const metadata: Metadata = {
  title: "Scanner & Activity Logs | Version Radar",
  description: "Detailed diagnostic logs for automated Play Store scanners and admin workflow audit trail.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RadarLogsPage() {
  const { scannerLogs, activityLogs } = await getRadarLogs();

  return (
    <div className="space-y-6">
      <RadarLogsView scannerLogs={scannerLogs} activityLogs={activityLogs} />
    </div>
  );
}
