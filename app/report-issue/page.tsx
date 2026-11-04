import { getApplications } from "@/lib/db";
import { ReportFormClient } from "@/components/reports/report-form-client";
import { AlertTriangle, ShieldCheck, Mail } from "lucide-react";

interface ReportIssuePageProps {
  searchParams: {
    app?: string;
    type?: string;
    version?: string;
  };
}

export const metadata = {
  title: "Report Broken Link or Issue",
  description: "Report a broken APK link, outdated application version, or copyright concern.",
};

export default async function ReportIssuePage({
  searchParams,
}: ReportIssuePageProps) {
  const { applications } = await getApplications({ limit: 100 });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="space-y-3 text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-secondary text-xs font-semibold text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span>Community Feedback</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Report an Issue or Broken Link
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Help us keep AWTMods reliable. Reports are investigated and repaired by our team promptly.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-lg">
        <ReportFormClient
          applications={applications}
          initialAppSlug={searchParams.app}
          initialType={searchParams.type}
          initialVersion={searchParams.version}
        />
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        For direct DMCA copyright notifications, you can also review our{" "}
        <a href="/dmca" className="underline hover:text-foreground">
          DMCA Policy
        </a>{" "}
        or email{" "}
        <a href="mailto:awtmods@gmail.com" className="underline hover:text-foreground">
          awtmods@gmail.com
        </a>
        .
      </div>
    </div>
  );
}

