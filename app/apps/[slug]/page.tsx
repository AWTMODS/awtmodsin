import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Download,
  CheckCircle2,
  Star,
  Layers,
  Calendar,
  Share2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Cpu,
  FileCode,
  HardDrive,
  Copy,
  ExternalLink,
  Send,
} from "lucide-react";
import { getApplicationBySlug, getApplications, getApplicationReviews } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppCard } from "@/components/applications/app-card";
import { AppIcon } from "@/components/applications/app-icon";
import { ScreenshotsGallery } from "@/components/applications/screenshots-gallery";
import { ShareButton } from "@/components/applications/share-button";
import { ReviewsSection } from "@/components/applications/reviews-section";
import { formatDate, formatNumber, getAppUrl, getDownloadUrl, cleanAppSlug } from "@/lib/utils";

interface AppDetailProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: AppDetailProps): Promise<Metadata> {
  const app = await getApplicationBySlug(params.slug);
  if (!app) return { title: "App Not Found" };

  return {
    title: `${app.name} (${app.latest_version?.version_name || "Latest"}) Download APK`,
    description: app.short_description,
    openGraph: {
      title: `${app.name} Download Modded APK | AWTMods`,
      description: app.short_description,
      images: [{ url: app.icon_url }],
    },
  };
}

export default async function AppDetailPage({ params }: AppDetailProps) {
  const rawSlug = params.slug;
  const app = await getApplicationBySlug(rawSlug);

  if (!app) {
    notFound();
  }

  // Canonical .html redirect: if accessed without .html or with legacy slug, redirect to /apps/{cleanSlug}.html
  const canonicalSlug = `${cleanAppSlug(app.slug)}.html`;
  if (rawSlug !== canonicalSlug) {
    redirect(`/apps/${canonicalSlug}`);
  }

  // Get related applications from same category and app reviews
  const [{ applications: relatedApps }, reviews] = await Promise.all([
    getApplications({
      categorySlug: app.category?.slug,
      limit: 5,
    }),
    getApplicationReviews(app.id),
  ]);

  const filteredRelated = relatedApps.filter((a) => a.id !== app.id).slice(0, 4);

  const latestVersion = app.latest_version || app.versions?.[0];
  const versionHistory = app.versions || [];
  const downloadSources = latestVersion?.download_sources || [];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <Link href="/apps" className="hover:text-foreground transition-colors">
          Apps
        </Link>
        {app.category && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link
              href={`/categories/${app.category.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {app.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium truncate">{app.name}</span>
      </nav>

      {/* Main App Hero Header Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm mb-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* App Info & Icon */}
          <div className="flex items-start sm:items-center gap-5">
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-border shadow-sm bg-secondary flex items-center justify-center font-bold text-2xl text-foreground">
              <AppIcon src={app.icon_url} alt={app.name} />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {app.name}
                </h1>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/10 shrink-0" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {app.developer}
              </p>

              {/* Version & Specs Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" className="font-mono text-xs">
                  {latestVersion?.version_name || "v1.0.0"}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {latestVersion?.file_size || "50 MB"}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {app.android_requirement}
                </Badge>
              </div>

              {/* Security Features Tagline */}
              <p className="text-xs text-muted-foreground pt-1 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Safe & Verified • No Ads • Premium Unlocked</span>
              </p>
            </div>
          </div>

          {/* Download APK Action Button */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link href={getDownloadUrl(app.slug)} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-2xl px-8 sm:px-10 h-14 sm:h-[54px] font-bold gap-2.5 text-base sm:text-lg shadow-md hover:shadow-lg transition-all"
              >
                <Download className="h-5 w-5 sm:h-6 sm:w-6" />
                <span>Download APK</span>
              </Button>
            </Link>
            <a
              href="https://t.me/awtmods"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 sm:h-[54px] px-6 rounded-2xl gap-2 font-semibold border-border bg-secondary/30 hover:bg-secondary text-foreground transition-colors"
                title="Join Telegram Channel"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5 text-sky-400" />
                <span>Join Telegram</span>
              </Button>
            </a>
            <ShareButton appName={app.name} className="h-14 sm:h-[54px] px-6 rounded-2xl" />
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 mt-6 border-t border-border/70">
          <a
            href="#reviews"
            className="flex items-center gap-3 group hover:opacity-85 transition-all cursor-pointer"
            title="Click to view or write reviews"
          >
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border group-hover:border-amber-500/50 transition-colors">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-1">
                <span>
                  {app.rating && Number(app.rating) > 0
                    ? `${Number(app.rating).toFixed(1)} ★`
                    : "0.0 ★"}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground group-hover:text-foreground group-hover:underline transition-colors">
                {app.reviews_count && Number(app.reviews_count) > 0
                  ? `(${formatNumber(app.reviews_count)} Reviews)`
                  : "(0 Reviews)"}
              </div>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Download className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                {formatNumber(app.downloads_count ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">Downloads</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Layers className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                {app.category?.name || "Application"}
              </div>
              <div className="text-[11px] text-muted-foreground">Category</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
              <Calendar className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                {formatDate(app.updated_at)}
              </div>
              <div className="text-[11px] text-muted-foreground">Last Updated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Screenshots Gallery Section */}
      {app.screenshots && app.screenshots.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Screenshots & Preview
          </h2>
          <ScreenshotsGallery screenshots={app.screenshots} appName={app.name} />
        </div>
      )}

      {/* Content Columns: About & Info Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left Column: About, Features, What's New, Versions */}
        <div className="lg:col-span-8 space-y-8">
          {/* About Section */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              About This App
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {app.description}
            </p>

            {/* Features Checklist (2 columns) */}
            {((app.mod_features && app.mod_features.length > 0) || !app.mod_features) && (
              <div className="pt-4 border-t border-border/70">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  Mod Features Unlocked
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {(app.mod_features && app.mod_features.length > 0
                    ? app.mod_features
                    : [
                        "Premium Unlocked",
                        "Ad-Free Clean Experience",
                        "Verified Safe APK Build",
                        "Optimized & Battery Efficient",
                      ]
                  ).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-foreground font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What's New Box */}
            {latestVersion?.release_notes && (
              <div className="mt-6 rounded-2xl border border-border bg-secondary/50 p-5 space-y-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>What's New ({latestVersion.version_name})</span>
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {latestVersion.release_notes}
                </p>
              </div>
            )}

            {/* Safety Disclaimer Warning Box */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Important Safety Notice</span>
                This is a modified Android application. While tested and verified for stability and malware-free operation, use responsibly on personal devices.
              </div>
            </div>
          </div>

          {/* Download Mirrors Section */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                Download Mirrors ({downloadSources.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Multiple reliable mirrors
              </span>
            </div>

            <div className="space-y-3">
              {downloadSources.map((mirror, index) => (
                <div
                  key={mirror.id || index}
                  className="flex items-center justify-between p-4 rounded-2xl border border-border bg-secondary/30 hover:border-neutral-400/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center font-bold text-xs uppercase border border-border">
                      {mirror.hosting_provider.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <span>{mirror.mirror_name || `${mirror.hosting_provider.toUpperCase()} Mirror`}</span>
                        {mirror.is_primary && (
                          <Badge variant="success" className="text-[10px]">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        Host: {mirror.hosting_provider.replace("_", " ")}
                      </div>
                    </div>
                  </div>

                  <Link href={getDownloadUrl(app.slug, { mirrorId: mirror.id })}>
                    <Button size="sm" className="rounded-xl px-4 gap-1.5 font-semibold">
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Version History Table */}
          {versionHistory.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
              <h2 className="text-xl font-bold text-foreground">
                Version History
              </h2>
              <div className="divide-y divide-border/60">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {ver.version_name}
                        </span>
                        {ver.is_latest && (
                          <Badge variant="outline" className="text-[10px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Released: {formatDate(ver.created_at)} • Size: {ver.file_size}
                      </div>
                    </div>

                    <Link href={getDownloadUrl(app.slug, { versionId: ver.id })}>
                      <Button variant="secondary" size="sm" className="rounded-xl gap-1 text-xs">
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Reviews & Ratings Section */}
          <ReviewsSection
            applicationId={app.id}
            appName={app.name}
            initialReviews={reviews}
            currentRating={Number(app.rating) || 0}
            currentReviewsCount={app.reviews_count || 0}
          />
        </div>

        {/* Right Column: App Information Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-bold text-base text-foreground pb-2 border-b border-border/70">
              App Information
            </h3>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Version
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {latestVersion?.version_name || "v1.0.0"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  File Size
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {latestVersion?.file_size || "50 MB"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Requires
                </span>
                <span className="font-semibold text-foreground">
                  {app.android_requirement}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Category
                </span>
                <span className="font-semibold text-foreground">
                  {app.category?.name || "Apps"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Developer
                </span>
                <span className="font-semibold text-foreground">
                  {app.developer}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Architecture
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {latestVersion?.architecture || "arm64-v8a"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Package</span>
                <span className="font-semibold text-foreground font-mono text-[11px] truncate max-w-[160px]">
                  {app.package_name}
                </span>
              </div>

              {latestVersion?.sha256 && (
                <div className="pt-2">
                  <span className="text-muted-foreground text-[11px] block mb-1">
                    SHA-256 Checksum
                  </span>
                  <div className="p-2 rounded-xl bg-secondary font-mono text-[10px] break-all border border-border select-all">
                    {latestVersion.sha256}
                  </div>
                </div>
              )}
            </div>

            {/* Broken Link Report link */}
            <div className="pt-4 border-t border-border/70 text-center">
              <Link
                href={`/report-issue?app=${cleanAppSlug(app.slug)}&type=broken_link`}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Report broken link or issue</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Related Applications Section */}
      {filteredRelated.length > 0 && (
        <div className="pt-8 border-t border-border/60">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Related Applications
            </h2>
            <Link
              href="/apps"
              className="text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredRelated.map((related) => (
              <AppCard key={related.id} app={related} variant="grid" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

