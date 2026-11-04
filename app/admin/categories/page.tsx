import { getCategories } from "@/lib/db";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata = {
  title: "Categories Management | AWTMods Admin",
};

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Categories Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Organize genres, slugs, and taxonomy for published Android packages.
        </p>
      </div>

      <CategoriesManager initialCategories={categories} />
    </div>
  );
}

