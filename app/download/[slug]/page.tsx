import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getApplicationBySlug, getSiteSettings } from "@/lib/db";
import { DownloadClient } from "@/components/downloads/download-client";
import { ShieldCheck, HardDrive, Cpu, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { AppIcon } from "@/components/applications/app-icon";

interface DownloadPageProps {
  params: {
    slug: string;
  };
  searchParams: {
    version?: string;
    mirror?: string;
  };
}

export async function generateMetadata({ params }: DownloadPageProps) {
  const app = await getApplicationBySlug(params.slug);
  if (!app) return { title: "Download App" };

  return {
    title: `Downloading ${app.name} (${app.latest_version?.version_name || "Latest"})`,
    description: `Preparing your secure download for ${app.name} APK.`,
  };
}

export default async function DownloadPage({
  params,
  searchParams,
}: DownloadPageProps) {
  const [app, settings] = await Promise.all([
    getApplicationBySlug(params.slug),
    getSiteSettings(),
  ]);

  if (!app || app.status !== "published") {
    notFound();
  }

  // Find target version
  const selectedVersion =
    (searchParams.version
      ? app.versions?.find((v) => v.id === searchParams.version)
      : null) ||
    app.latest_version ||
    app.versions?.[0];

  if (!selectedVersion) {
    return (
      <div className="container mx-auto max-w-xl py-20 text-center px-4">
        <h1 className="text-2xl font-bold">No Downloadable Version Found</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This application currently does not have an active public version release.
        </p>
        <Link href={`/apps/${app.slug}`} className="mt-6 inline-block underline">
          Return to app page
        </Link>
      </div>
    );
  }

  // Find target mirror
  const mirrors = selectedVersion.download_sources || [];
  const selectedMirror =
    (searchParams.mirror ? mirrors.find((m) => m.id === searchParams.mirror) : null) ||
    mirrors.find((m) => m.is_primary) ||
    mirrors[0];

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={`/apps/${app.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to {app.name}</span>
      </Link>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-lg">
        {/* App Mini Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-border/70">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border shadow-xs bg-secondary flex items-center justify-center font-bold text-lg text-foreground">
            <AppIcon src={app.icon_url} alt={app.name} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {app.name}
              </h1>
              <CheckCircle2 className="h-4 w-4 text-emerald-500 fill-emerald-500/10" />
            </div>
            <p className="text-xs text-muted-foreground">
              {app.developer} • {selectedVersion.version_name} ({selectedVersion.file_size})
            </p>
          </div>
        </div>

        {/* Interactive Client Countdown & Download Controller */}
        <DownloadClient
          app={app}
          version={selectedVersion}
          mirrors={mirrors}
          currentMirror={selectedMirror}
          countdownSeconds={settings.countdownSeconds || 5}
        />

        {/* Installation Guidelines & Security Specs */}
        <div className="mt-10 pt-8 border-t border-border/70 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">Verified Package</span>
              SHA-256 integrity checksum available. Tested safe without intrusive spyware.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <HardDrive className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground block">How to Install</span>
              Enable &ldquo;Install from Unknown Sources&rdquo; in Android settings if prompted.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

