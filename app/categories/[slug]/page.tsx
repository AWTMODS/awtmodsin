import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCategoryBySlug, getApplications } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import { SITE_URL, SITE_NAME, buildCategoryJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: "Category Not Found" };

  const canonicalUrl = `${SITE_URL}/categories/${category.slug}`;
  const title = `${category.name} Apps & Games APK Download | ${SITE_NAME}`;
  const description =
    category.description ||
    `Browse and download verified ${category.name} applications and games for Android at AWTMods. High-speed mirrors and detailed changelogs.`;

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
      siteName: SITE_NAME,
      images: [
        {
          url: `${SITE_URL}/icon.png`,
          width: 512,
          height: 512,
          alt: `${category.name} category on AWTMods`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@awtmods",
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

  const categoryJsonLd = buildCategoryJsonLd(category);

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
