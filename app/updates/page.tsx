import Link from "next/link";
import { getRecentlyUpdated } from "@/lib/db";
import { formatDate, getAppUrl, getDownloadUrl } from "@/lib/utils";
import { Download, RefreshCw, Calendar, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppIcon } from "@/components/applications/app-icon";

export const metadata = {
  title: "Latest Application Updates & Changelogs",
  description: "Recent updates, changelogs and new versions for Android modded applications.",
};

export default async function UpdatesPage() {
  const updatedApps = await getRecentlyUpdated();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-secondary text-xs font-semibold text-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Real-time Releases</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Latest Application Updates
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Track newly published versions, security patches, and changelogs.
        </p>
      </div>

      {/* Updates Stream */}
      {updatedApps.length === 0 ? (
        <div className="max-w-2xl py-16 text-center rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
          <Inbox className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">
            No updates recorded yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            New updates and changelogs will appear here as new versions are published.
          </p>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {updatedApps.map((app) => {
            const latestVersion = app.latest_version || app.versions?.[0];
            const prevVersion = app.versions?.[1];

            return (
              <div
                key={app.id}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm hover:border-neutral-400/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                  <div className="flex items-center gap-4">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-secondary flex items-center justify-center font-bold text-base text-foreground">
                      <AppIcon src={app.icon_url} alt={app.name} />
                    </div>
                    <div>
                      <Link
                        href={getAppUrl(app.slug)}
                        className="text-lg font-bold text-foreground hover:underline"
                      >
                        {app.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{app.developer}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(app.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <Badge variant="default" className="font-mono text-xs">
                        {latestVersion?.version_name || "Latest"}
                      </Badge>
                      {prevVersion && (
                        <span className="text-[11px] text-muted-foreground block">
                          prev: {prevVersion.version_name}
                        </span>
                      )}
                    </div>

                    <Link href={getDownloadUrl(app.slug)}>
                      <Button size="sm" className="rounded-xl px-4 gap-1.5 font-semibold">
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Changelog text */}
                <div className="pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                    Changelog & Release Notes:
                  </h4>
                  <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/80 text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed font-sans">
                    {latestVersion?.release_notes || "• Performance enhancements and bug fixes."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
