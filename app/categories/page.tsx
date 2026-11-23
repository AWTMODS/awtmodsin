import { getCategories } from "@/lib/db";
import { CategoryCard } from "@/components/categories/category-card";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import type { Metadata } from "next";

const baseUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Browse App Categories – Android Apps & Games | ${SITE_NAME}`,
  description:
    "Browse Android applications, games, and PC software organized by category: Tools, Music, Photography, Productivity, and Gaming.",
  keywords: [
    "App Categories",
    "Android Categories",
    "Android Tools",
    "Android Games",
    "AWTMods Categories",
  ],
  alternates: {
    canonical: `${baseUrl}/categories`,
  },
  openGraph: {
    title: `Application Categories | ${SITE_NAME}`,
    description: "Browse Android applications, games, and PC software organized by category.",
    url: `${baseUrl}/categories`,
    type: "website",
    siteName: SITE_NAME,
    images: [
      {
        url: `${baseUrl}/icon.png`,
        width: 512,
        height: 512,
        alt: "AWTMods Categories",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Application Categories | ${SITE_NAME}`,
    description: "Browse Android applications, games, and PC software organized by category.",
    creator: "@awtmods",
  },
};

export const revalidate = 60;

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          App Categories
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Explore curated Android applications, utilities, and tools sorted by genre.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

