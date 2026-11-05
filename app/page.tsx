import {
  getSiteStats,
  getCategories,
  getApplications,
  getSiteSettings,
} from "@/lib/db";
import { HeroSection } from "@/components/homepage/hero-section";
import { StatsSection } from "@/components/homepage/stats-section";
import { FeaturedSection } from "@/components/homepage/featured-section";
import { CategoriesSection } from "@/components/homepage/categories-section";
import { LatestReleasesSection } from "@/components/homepage/latest-releases-section";
import { TelegramBanner } from "@/components/homepage/telegram-banner";

// Edge-cached for 60 seconds (with instant on-demand revalidation on admin updates)
export const revalidate = 60;

export default async function HomePage() {
  const [
    stats,
    { applications: publishedApps },
    categories,
    settings,
  ] = await Promise.all([
    getSiteStats(),
    getApplications({ limit: 30, sortBy: "newest" }),
    getCategories(),
    getSiteSettings(),
  ]);

  const featuredApps = publishedApps.filter((a) => a.is_featured).slice(0, 4);
  const trendingApps = [...publishedApps]
    .sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0))
    .slice(0, 6);
  const latestReleases = publishedApps.slice(0, 6);
  const pcSoftwares = publishedApps
    .filter((a) => (a as any).platform === "pc" || a.category?.slug === "pc-software")
    .slice(0, 4);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://awtmodsin.vercel.app";

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "AWTMods",
        description:
          "Discover and download verified Android modded applications, premium APKs, and PC software.",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${baseUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "AWTMods",
        url: baseUrl,
        logo: `${baseUrl}/icon`,
        sameAs: [
          settings?.telegramUrl || "https://t.me/awtmods",
          settings?.instagramUrl || "https://instagram.com/awtmods",
          settings?.youtubeUrl || "https://youtube.com/@awtmods",
          settings?.twitterUrl || "https://x.com/awtmods",
        ],
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

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

