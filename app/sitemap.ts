import { MetadataRoute } from "next";
import { getAllPublishedAppsForSitemap, getCategories } from "@/lib/db";
import { getAppUrl } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // Cache sitemap at edge for 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const [applications, categories] = await Promise.all([
    getAllPublishedAppsForSitemap(),
    getCategories(),
  ]);

  // Determine latest content timestamp for static index pages
  const latestAppDate =
    applications.length > 0 && applications[0].updated_at
      ? new Date(applications[0].updated_at)
      : new Date("2026-11-23T00:00:00Z");

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: latestAppDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/apps`,
      lastModified: latestAppDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/games`,
      lastModified: latestAppDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pc-software`,
      lastModified: latestAppDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: latestAppDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/updates`,
      lastModified: latestAppDate,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date("2026-11-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date("2026-11-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified: new Date("2026-10-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date("2026-10-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-10-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: new Date("2026-10-01T00:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic published Application routes with canonical .html URLs
  const appRoutes: MetadataRoute.Sitemap = applications.map((app) => ({
    url: `${baseUrl}${getAppUrl(app.slug)}`,
    lastModified: app.updated_at ? new Date(app.updated_at) : latestAppDate,
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  // Dynamic Category routes (only active categories with published apps)
  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((cat) => cat.is_active !== false)
    .map((cat) => ({
      url: `${baseUrl}/categories/${cat.slug}`,
      lastModified: cat.created_at ? new Date(cat.created_at) : latestAppDate,
      changeFrequency: "weekly",
      priority: 0.75,
    }));

  return [...staticRoutes, ...appRoutes, ...categoryRoutes];
}
