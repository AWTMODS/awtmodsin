import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Application } from "@/lib/types";
import { AppCard } from "@/components/applications/app-card";

interface FeaturedSectionProps {
  apps: Application[];
}

export function FeaturedSection({ apps }: FeaturedSectionProps) {
  if (!apps || apps.length === 0) return null;

  return (
    <section className="py-14 sm:py-16 border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Featured Apps
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Handpicked modded apps with premium features
            </p>
          </div>
          <Link
            href="/apps"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} variant="grid" />
          ))}
        </div>
      </div>
    </section>
  );
}
