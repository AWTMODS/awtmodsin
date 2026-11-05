import {
  getSiteStats,
  getFeaturedApps,
  getCategories,
  getLatestReleases,
  getTrendingApps,
  getApplications,
  getSiteSettings,
} from "@/lib/db";
import { HeroSection } from "@/components/homepage/hero-section";
import { StatsSection } from "@/components/homepage/stats-section";
import { FeaturedSection } from "@/components/homepage/featured-section";
import { CategoriesSection } from "@/components/homepage/categories-section";
import { LatestReleasesSection } from "@/components/homepage/latest-releases-section";
import { TelegramBanner } from "@/components/homepage/telegram-banner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    stats,
    featuredApps,
    categories,
    latestReleases,
    trendingApps,
    pcByPlatform,
    pcByCat,
    settings,
  ] = await Promise.all([
    getSiteStats(),
    getFeaturedApps(),
    getCategories(),
    getLatestReleases(),
    getTrendingApps(),
    getApplications({ platform: "pc", limit: 4 }),
    getApplications({ categorySlug: "pc-software", limit: 4 }),
    getSiteSettings(),
  ]);

  const pcMap = new Map();
  [...pcByPlatform.applications, ...pcByCat.applications].forEach((a) =>
    pcMap.set(a.id, a)
  );
  const pcSoftwares = Array.from(pcMap.values());

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <HeroSection totalApps={stats.publishedApps ?? stats.totalApps} />

      {/* Featured Apps Section */}
      <FeaturedSection apps={featuredApps} />

      {/* Categories Grid */}
      <CategoriesSection categories={categories} />

      {/* Latest Releases */}
      <LatestReleasesSection
        apps={latestReleases}
        title="Latest Releases"
        subtitle="Newly added and updated apps"
        viewAllHref="/apps"
      />

      {/* PC Software Section */}
      {pcSoftwares.length > 0 && (
        <LatestReleasesSection
          apps={pcSoftwares}
          title="PC Software & Tools"
          subtitle="Verified Windows software, desktop utilities, and standalone repacks"
          viewAllHref="/pc-software"
        />
      )}

      {/* Trending Applications */}
      <LatestReleasesSection
        apps={trendingApps}
        title="Trending Applications"
        subtitle="Ranked by recorded downloads and community activity"
        viewAllHref="/apps?sort=downloads"
      />

      {/* Platform Real Statistics - Positioned directly above Telegram Banner */}
      <StatsSection stats={stats} />

      {/* Telegram Community Banner */}
      <TelegramBanner telegramUrl={settings?.telegramUrl || "https://t.me/awtmods"} />
    </div>
  );
}

