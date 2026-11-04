import { formatNumber } from "@/lib/utils";
import { Layers, Download, LayoutGrid, Clock } from "lucide-react";

interface StatsProps {
  stats?: {
    totalApps?: number;
    totalDownloads?: number;
    totalCategories?: number;
    recentUpdates?: number;
  };
}

export function StatsSection({ stats }: StatsProps) {
  const totalApps = stats?.totalApps ?? 0;
  const totalDownloads = stats?.totalDownloads ?? 250000;
  const totalCategories = stats?.totalCategories ?? 0;
  const recentUpdates = stats?.recentUpdates ?? 0;

  const statItems = [
    {
      label: "Published Apps",
      value: totalApps > 0 ? `${totalApps}+` : "0",
      sub: "Verified APKs",
      icon: Layers,
    },
    {
      label: "Total Downloads",
      value: formatNumber(totalDownloads),
      sub: "All-time installs",
      icon: Download,
    },
    {
      label: "App Categories",
      value: totalCategories.toString(),
      sub: "Active genres",
      icon: LayoutGrid,
    },
    {
      label: "Recent Updates",
      value: recentUpdates > 0 ? `${recentUpdates}+` : "0",
      sub: "Updated this month",
      icon: Clock,
    },
  ];

  return (
    <section className="py-10 border-b border-border/60 bg-secondary/30">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {statItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex flex-col p-4 sm:p-5 rounded-2xl border border-border bg-card text-left transition-all hover:border-neutral-400/40 dark:hover:border-neutral-700/60"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </span>
                  <div className="p-2 rounded-xl bg-secondary text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {item.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
