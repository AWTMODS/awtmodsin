import { getReports } from "@/lib/db";
import { ReportsManager } from "@/components/admin/reports-manager";

export const metadata = {
  title: "Reports & Issue Management | AWTMods Admin",
};

export default async function AdminReportsPage() {
  const reports = await getReports();

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Community Reports & Issues
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Review broken download links, version update requests, and user notifications.
        </p>
      </div>

      <ReportsManager initialReports={reports} />
    </div>
  );
}

