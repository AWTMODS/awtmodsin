import {
  getSiteStats,
  getFeaturedApps,
  getCategories,
  getLatestReleases,
  getTrendingApps,
  getSiteSettings,
} from "@/lib/db";
import { HeroSection } from "@/components/homepage/hero-section";
import { StatsSection } from "@/components/homepage/stats-section";
import { FeaturedSection } from "@/components/homepage/featured-section";
import { CategoriesSection } from "@/components/homepage/categories-section";
import { LatestReleasesSection } from "@/components/homepage/latest-releases-section";
import { TelegramBanner } from "@/components/homepage/telegram-banner";

export const revalidate = 60; // ISR cache revalidation

export default async function HomePage() {
  const [stats, featuredApps, categories, latestReleases, trendingApps, settings] =
    await Promise.all([
      getSiteStats(),
      getFeaturedApps(),
      getCategories(),
      getLatestReleases(),
      getTrendingApps(),
      getSiteSettings(),
    ]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <HeroSection totalApps={stats.totalApps} />

      {/* Platform Real Statistics */}
      <StatsSection stats={stats} />

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

      {/* Trending Applications */}
      <LatestReleasesSection
        apps={trendingApps}
        title="Trending Applications"
        subtitle="Ranked by recorded downloads and community activity"
        viewAllHref="/apps?sort=downloads"
      />

      {/* Telegram Community Banner */}
      <TelegramBanner telegramUrl={settings.telegramUrl} />
    </div>
  );
}

