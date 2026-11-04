"use client";

import Link from "next/link";
import { Download, Layers } from "lucide-react";
import { Application } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppCardProps {
  app: Application;
  className?: string;
  variant?: "grid" | "compact" | "horizontal";
}

export function AppCard({ app, className, variant = "grid" }: AppCardProps) {
  const version = app.latest_version?.version_name || "v1.0";
  const size = app.latest_version?.file_size || "";
  const featureTag = app.category?.name || "Verified APK";

  const renderIcon = (sizeClass: string) => {
    if (app.icon_url) {
      return (
        <img
          src={app.icon_url}
          alt={app.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = "none";
          }}
        />
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center font-black text-foreground">
        {app.name.slice(0, 1)}
      </div>
    );
  };

  if (variant === "horizontal" || variant === "compact") {
    return (
      <div
        className={cn(
          "group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-border bg-card hover:border-neutral-400/50 dark:hover:border-neutral-600/50 transition-all duration-200 shadow-xs hover:shadow-md",
          className
        )}
      >
        <Link
          href={`/apps/${app.slug}`}
          className="flex items-center gap-3.5 flex-1 min-w-0"
        >
          <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-border bg-secondary shrink-0 flex items-center justify-center">
            {renderIcon("h-12 w-12")}
          </div>

          <div className="min-w-0 flex-1 pr-2">
            <h3 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-neutral-400 transition-colors">
              {app.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="truncate">{featureTag}</span>
              <span>•</span>
              <span>{version}</span>
              {size && (
                <>
                  <span>•</span>
                  <span>{size}</span>
                </>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/apps/${app.slug}`}
            className="inline-flex items-center justify-center rounded-lg h-9 w-9 hover:bg-secondary text-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">Download {app.name}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-neutral-400/50 dark:hover:border-neutral-600/50 transition-all duration-200 shadow-xs hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-border bg-secondary shrink-0 shadow-xs flex items-center justify-center">
            {renderIcon("h-14 w-14")}
          </div>
          <Badge variant="outline" className="text-[11px] font-semibold py-0.5">
            {featureTag}
          </Badge>
        </div>

        <Link href={`/apps/${app.slug}`}>
          <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-neutral-400 transition-colors">
            {app.name}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium truncate">
          {app.developer}
        </p>

        <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
          {app.short_description}
        </p>
      </div>

      <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{version}</span>
        </div>

        <Link
          href={`/apps/${app.slug}`}
          className="inline-flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 rounded-xl h-8 text-xs font-semibold px-3 gap-1.5 shadow-sm transition-all active:scale-[0.98]"
        >
          <span>Get</span>
          <Download className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
