import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCategoryBySlug, getApplications } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import type { Metadata } from "next";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: "Category Not Found" };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://awtmodsin.vercel.app";
  const canonicalUrl = `${baseUrl}/categories/${category.slug}`;
  const title = `${category.name} Modded Apps & APKs - Free Download`;
  const description =
    category.description ||
    `Download the best verified ${category.name} modded applications and games for Android at AWTMods.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "AWTMods",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const revalidate = 60;

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  const { applications } = await getApplications({
    categorySlug: category.slug,
    limit: 24,
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://awtmodsin.vercel.app";
  const categoryUrl = `${baseUrl}/categories/${category.slug}`;

  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": categoryUrl,
        url: categoryUrl,
        name: `${category.name} Apps & Games`,
        description:
          category.description ||
          `Browse verified modded Android applications in ${category.name}.`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${baseUrl}/#website`,
          name: "AWTMods",
          url: baseUrl,
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
            item: baseUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Categories",
            item: `${baseUrl}/categories`,
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

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Schema.org CollectionPage & BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/categories" className="hover:text-foreground transition-colors">
          Categories
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{category.name}</span>
      </nav>

      {/* Category Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {category.name} Apps
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
          {category.description || `Browse all verified modded Android applications in ${category.name}.`}
        </p>
      </div>

      {/* Apps Grid */}
      {applications.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-card/40">
          <h3 className="font-semibold text-lg text-foreground">No applications in this category yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            New applications are being added regularly. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {applications.map((app) => (
            <AppCard key={app.id} app={app} variant="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
