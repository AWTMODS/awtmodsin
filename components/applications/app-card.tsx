import Link from "next/link";
import Image from "next/image";
import { Download, Layers } from "lucide-react";
import { Application } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary flex items-center justify-center">
            {renderIcon("h-14 w-14")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                {app.name}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {version} {size ? `• ${size}` : ""}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/80">
                {featureTag}
              </span>
            </div>
          </div>
        </Link>

        <Link href={`/download/${app.slug}`} className="shrink-0 ml-3">
          <Button
            variant="secondary"
            size="icon"
            className="w-9 h-9 rounded-xl border border-border group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            title={`Download ${app.name}`}
            aria-label={`Download ${app.name}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between p-5 rounded-2xl border border-border bg-card hover:border-neutral-400/50 dark:hover:border-neutral-600/50 transition-all duration-200 shadow-xs hover:shadow-md",
        className
      )}
    >
      <Link href={`/apps/${app.slug}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary flex items-center justify-center">
            {renderIcon("h-16 w-16")}
          </div>
          {app.is_featured && (
            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
              Featured
            </Badge>
          )}
        </div>

        <div className="mt-4">
          <h3 className="font-semibold text-base text-foreground truncate group-hover:text-primary transition-colors">
            {app.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {version} {size ? `• ${size}` : ""}
          </p>
        </div>
      </Link>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
        <span className="inline-block text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/80">
          {featureTag}
        </span>

        <Link href={`/download/${app.slug}`}>
          <Button
            variant="secondary"
            size="icon"
            className="w-8 h-8 rounded-lg border border-border group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            title={`Download ${app.name}`}
            aria-label={`Download ${app.name}`}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
