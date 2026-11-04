import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Application } from "@/lib/types";
import { AppCard } from "@/components/applications/app-card";

interface LatestReleasesProps {
  apps: Application[];
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
}

export function LatestReleasesSection({
  apps,
  title = "Latest Releases",
  subtitle = "Newly added and updated apps",
  viewAllHref = "/apps",
}: LatestReleasesProps) {
  if (!apps || apps.length === 0) return null;

  return (
    <section className="py-14 sm:py-16 border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Link
            href={viewAllHref}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} variant="horizontal" />
          ))}
        </div>
      </div>
    </section>
  );
}
