import { formatNumber } from "@/lib/utils";
import { Layers, Download, LayoutGrid, Clock } from "lucide-react";

interface StatsProps {
  stats: {
    totalApps: number;
    totalDownloads: number;
    totalCategories: number;
    recentUpdates: number;
  };
}

export function StatsSection({ stats }: StatsProps) {
  const statItems = [
    {
      label: "Published Apps",
      value: stats.totalApps > 0 ? `${stats.totalApps}+` : "0",
      sub: "Verified APKs",
      icon: Layers,
    },
    {
      label: "Total Downloads",
      value: formatNumber(stats.totalDownloads),
      sub: "All-time installs",
      icon: Download,
    },
    {
      label: "App Categories",
      value: stats.totalCategories.toString(),
      sub: "Active genres",
      icon: LayoutGrid,
    },
    {
      label: "Recent Updates",
      value: stats.recentUpdates > 0 ? `${stats.recentUpdates}+` : "0",
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground/80" />
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {item.value}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
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
