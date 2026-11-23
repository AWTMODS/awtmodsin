import type { Metadata } from "next";
import { Application, AppCategory } from "@/lib/types";
import { cleanAppSlug, getAppUrl } from "@/lib/utils";

/**
 * Authoritative canonical site URL for AWTMods
 * Uses production domain https://www.awtmods.in by default to ensure
 * zero development or staging URL leaks into Google search indexes.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL &&
  !process.env.NEXT_PUBLIC_SITE_URL.includes("vercel.app")
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : "https://www.awtmods.in";

export const SITE_NAME = "AWTMods";

export const DEFAULT_SEO = {
  title: "AWTMods – Android Apps, Games & APK Downloads",
  description:
    "Discover Android applications, utilities, games and software on AWTMods. Explore detailed app information, version updates, changelogs and available download sources.",
  keywords: [
    "AWTMods",
    "Android Apps",
    "APK Download",
    "Modded APK",
    "Android Games",
    "Android Utilities",
    "APK Versions",
    "PC Software",
    "Verified Downloads",
  ],
};

/**
 * Returns an absolute canonical URL safely
 */
export function getCanonicalUrl(path: string = "/"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

/**
 * Strips markdown and cleanup prefixes from app descriptions for SEO meta tags
 */
export function sanitizeMetaDescription(rawText: string | undefined | null, maxLength = 160): string {
  if (!rawText) return "";
  let clean = rawText
    .replace(/^\s*f(?:i|ir)st paragraph of[^\n]*/i, "")
    .replace(/<[^>]*>?/gm, " ") // strip HTML
    .replace(/[*#_`~[\]]/g, "") // strip Markdown symbols
    .replace(/https?:\/\/\S+/g, "") // strip URLs
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength - 3).trim() + "...";
  }
  return clean;
}

/**
 * Generates natural, high-intent primary and secondary search keywords for an application
 */
export function generateAppKeywords(app: Application): string[] {
  const name = app.name;
  const pkg = app.package_name;
  const cat = app.category?.name || "Utilities";
  const isPc = (app as any).platform === "pc" || app.category?.slug === "pc-software";
  const version = app.latest_version?.version_name || "";

  const keywords = new Set<string>();

  // Primary Patterns
  keywords.add(`${name} APK`);
  keywords.add(`${name} Download`);
  keywords.add(`${name} Latest Version`);
  if (version) keywords.add(`${name} ${version}`);
  if (pkg) keywords.add(pkg);

  if (isPc) {
    keywords.add(`${name} PC Download`);
    keywords.add(`${name} Windows`);
    keywords.add("PC Software");
  } else {
    keywords.add(`${name} Android`);
    keywords.add(`${name} APK Download`);
    keywords.add(`${name} Update`);
    keywords.add(`${cat} apps for Android`);
    keywords.add("Android applications");
  }

  // Developer keyword if available
  if (app.developer && app.developer !== "Aadith C V") {
    keywords.add(app.developer);
  }

  return Array.from(keywords);
}

/**
 * Builds standard Google & Social Metadata for an individual application detail page
 */
export function buildApplicationMetadata(app: Application): Metadata {
  const isPc = (app as any).platform === "pc" || app.category?.slug === "pc-software";
  const cleanSlug = cleanAppSlug(app.slug);
  const canonicalUrl = `${SITE_URL}/apps/${cleanSlug}.html`;
  const version = app.latest_version?.version_name || "Latest Version";

  // Standardized Title Pattern:
  // [Application Name] APK Download – Latest Version | AWTMods
  const title = isPc
    ? `${app.name} (${version}) Download for PC Windows | AWTMods`
    : `${app.name} (${version}) APK Download – Latest Version | AWTMods`;

  // Sanitized, high-density description
  const cleanDesc = sanitizeMetaDescription(app.short_description || app.description, 130);
  const description =
    cleanDesc.length > 30
      ? `${cleanDesc} Download ${app.name} (${version}) for ${isPc ? "PC" : "Android"} at AWTMods.`
      : `Download ${app.name} (${version}) ${isPc ? "for PC Windows" : "APK for Android"}. Explore full app information, features, and verified high-speed mirrors at AWTMods.`;

  const keywords = generateAppKeywords(app);
  const isPublished = app.status === "published";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: isPublished,
      follow: true,
      googleBot: {
        index: isPublished,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: app.icon_url || `${SITE_URL}/icon.png`,
          width: 512,
          height: 512,
          alt: `${app.name} icon`,
        },
      ],
      type: "article",
      publishedTime: app.created_at,
      modifiedTime: app.updated_at,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [app.icon_url || `${SITE_URL}/icon.png`],
      creator: "@awtmods",
    },
  };
}

/**
 * Builds Schema.org JSON-LD for an Application
 */
export function buildApplicationJsonLd(app: Application) {
  const isPc = (app as any).platform === "pc" || app.category?.slug === "pc-software";
  const cleanSlug = cleanAppSlug(app.slug);
  const canonicalUrl = `${SITE_URL}/apps/${cleanSlug}.html`;
  const latestVersion = app.latest_version || app.versions?.[0];

  const appDescription = sanitizeMetaDescription(app.short_description || app.description, 300);

  const softwareSchema: any = {
    "@type": isPc ? "SoftwareApplication" : "MobileApplication",
    "@id": `${canonicalUrl}#software`,
    name: app.name,
    headline: `${app.name} APK Download (${latestVersion?.version_name || "Latest"})`,
    description: appDescription || `${app.name} application for ${isPc ? "Windows PC" : "Android"}`,
    image: app.icon_url || `${SITE_URL}/icon.png`,
    url: canonicalUrl,
    operatingSystem: isPc
      ? "Windows 10, Windows 11"
      : app.android_requirement || "Android 7.0+",
    applicationCategory: app.category?.name || (isPc ? "UtilitiesApplication" : "MobileApplication"),
    softwareVersion: latestVersion?.version_name || "1.0.0",
    fileSize: latestVersion?.file_size || "Varies with device",
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };

  if (app.developer && app.developer.trim()) {
    softwareSchema.author = {
      "@type": "Organization",
      name: app.developer.trim(),
    };
  }

  // Only include aggregateRating when real ratings and reviews exist (satisfies Google policy)
  if (app.rating && Number(app.rating) > 0 && app.reviews_count && Number(app.reviews_count) > 0) {
    softwareSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(app.rating).toFixed(1),
      reviewCount: Number(app.reviews_count),
      bestRating: "5",
      worstRating: "1",
    };
  }

  // Breadcrumbs schema
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isPc ? "PC Software" : "Apps",
        item: `${SITE_URL}${isPc ? "/pc-software" : "/apps"}`,
      },
      ...(app.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: app.category.name,
              item: `${SITE_URL}/categories/${app.category.slug}`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: app.name,
              item: canonicalUrl,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 3,
              name: app.name,
              item: canonicalUrl,
            },
          ]),
    ],
  };

  // Structured FAQ Schema for Application
  const faqSchema = {
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: `How do I install ${app.name} APK on Android?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Download the APK file from AWTMods. Go to Android Settings > Security and enable 'Install from Unknown Sources'. Then tap the downloaded APK file and click Install.`,
        },
      },
      {
        "@type": "Question",
        name: `What Android version is required for ${app.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${app.name} requires ${app.android_requirement || "Android 7.0 or higher"}. Check your Android settings to verify compatibility.`,
        },
      },
      {
        "@type": "Question",
        name: `Is the ${app.name} APK from AWTMods safe?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes, each build on AWTMods is inspected for package integrity and malicious payloads before receiving publishing approval. SHA-256 checksums are recorded for transparency.`,
        },
      },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [softwareSchema, breadcrumbSchema, faqSchema],
  };
}

/**
 * Builds Schema.org JSON-LD for a Category Collection Page
 */
export function buildCategoryJsonLd(category: AppCategory) {
  const categoryUrl = `${SITE_URL}/categories/${category.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": categoryUrl,
        url: categoryUrl,
        name: `${category.name} Apps & Games`,
        description:
          category.description ||
          `Browse verified Android applications and games in ${category.name} at AWTMods.`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: SITE_NAME,
          url: SITE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${categoryUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Categories",
            item: `${SITE_URL}/categories`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: category.name,
            item: categoryUrl,
          },
        ],
      },
    ],
  };
}
