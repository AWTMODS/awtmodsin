import Link from "next/link";
import { getApplications } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import { Monitor, ShieldCheck, Zap, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const revalidate = 60;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://awtmodsin.vercel.app";

export const metadata: Metadata = {
  title: "PC Software & Windows Tools - Verified Downloads | AWTMods",
  description:
    "Download verified PC software, Windows tools, utilities, creative suites, and desktop applications with clean standalone installers.",
  alternates: {
    canonical: `${baseUrl}/pc-software`,
  },
  openGraph: {
    title: "PC Software & Windows Tools | AWTMods",
    description: "Download verified PC software, Windows tools, utilities, and desktop applications.",
    url: `${baseUrl}/pc-software`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PC Software & Windows Tools | AWTMods",
    description: "Download verified PC software, Windows tools, utilities, and desktop applications.",
  },
};

export default async function PcSoftwarePage() {
  const [byPlatform, byCategory] = await Promise.all([
    getApplications({ platform: "pc", limit: 50 }),
    getApplications({ categorySlug: "pc-software", limit: 50 }),
  ]);

  // Merge and deduplicate by ID
  const map = new Map();
  [...byPlatform.applications, ...byCategory.applications].forEach((a) =>
    map.set(a.id, a)
  );
  const pcApps = Array.from(map.values());

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner for PC Software */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12 mb-10 shadow-xs">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-semibold text-foreground border border-border">
            <Monitor className="h-3.5 w-3.5" />
            <span>PC & Windows Software</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            PC Software & Desktop Tools
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Download verified PC software, desktop utilities, creative suites, and productivity tools with clean installers, pre-activated builds, and offline standalone setups.
          </p>
        </div>
      </div>

      {/* Available Software Header & Grid */}
      <div>
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/70">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Available PC Software ({pcApps.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Original live software library
            </p>
          </div>
        </div>

        {pcApps.length === 0 ? (
          <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-border bg-card/40 space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground border border-border">
              <Monitor className="h-7 w-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="font-bold text-base sm:text-lg text-foreground">
                No PC software published yet
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Our library is updated regularly. PC software packages and tools added in the admin panel will appear here immediately with zero fake or dummy counts.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/report-issue">
                <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5">
                  <span>Request a PC Software</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {pcApps.map((software) => (
              <AppCard key={software.id} app={software} variant="grid" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

