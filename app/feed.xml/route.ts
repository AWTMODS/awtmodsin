import { NextResponse } from "next/server";
import { getApplications, getSiteSettings } from "@/lib/db";
import { cleanAppSlug } from "@/lib/utils";

export const revalidate = 300; // Cache for 5 minutes

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  try {
    const [appsResult, settings] = await Promise.all([
      getApplications({ limit: 40 }),
      getSiteSettings(),
    ]);

    const siteUrl = settings.siteUrl || "https://www.awtmods.in";
    const siteTitle = settings.siteName || "AWTMods";
    const siteDesc =
      settings.siteDescription ||
      "Download Modded Apps, Premium APKs, and Open Source Tools with Direct CDN Mirrors.";

    const nowRfc822 = new Date().toUTCString();

    const itemsXml = appsResult.applications
      .map((app) => {
        const cleanSlug = cleanAppSlug(app.slug);
        const appUrl = `${siteUrl}/apps/${cleanSlug}.html`;
        const ver = app.latest_version?.version_name || "Latest";
        const title = `${escapeXml(app.name)} (${escapeXml(ver)}) Mod APK Download`;
        const pubDate = app.updated_at
          ? new Date(app.updated_at).toUTCString()
          : nowRfc822;

        const rawDesc = (app.short_description || app.description || "")
          .replace(/^\s*f(?:i|ir)st paragraph of[^\n]*/i, "")
          .slice(0, 300);

        const category = escapeXml(app.category?.name || "Android Apps");
        let iconUrl = app.icon_url;
        if (iconUrl && iconUrl.startsWith("/")) {
          iconUrl = `${siteUrl}${iconUrl}`;
        }

        return `    <item>
      <title>${title}</title>
      <link>${appUrl}</link>
      <guid isPermaLink="true">${appUrl}</guid>
      <description>${escapeXml(rawDesc)}</description>
      <category>${category}</category>
      <pubDate>${pubDate}</pubDate>
      ${iconUrl ? `<enclosure url="${escapeXml(iconUrl)}" type="image/png" length="0" />` : ""}
    </item>`;
      })
      .join("\n");

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)} — Modded Apps &amp; Premium APKs</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>en-us</language>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(rssXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Error generating RSS feed: ${err.message}`, {
      status: 500,
    });
  }
}
