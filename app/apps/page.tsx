import { Suspense } from "react";
import { getApplications, getCategories } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppsFilterBar } from "@/components/applications/apps-filter-bar";

interface AppsPageProps {
  searchParams: {
    category?: string;
    search?: string;
    sort?: "newest" | "oldest" | "downloads" | "alphabetical";
    page?: string;
  };
}

export const metadata = {
  title: "All Modded Applications & APKs",
  description: "Browse our complete catalog of modded Android applications, games, and tools.",
};

export default async function AppsPage({ searchParams }: AppsPageProps) {
  const currentPage = parseInt(searchParams.page || "1", 10);
  const pageSize = 12;
  const offset = (currentPage - 1) * pageSize;

  const [categories, { applications, total }] = await Promise.all([
    getCategories(),
    getApplications({
      categorySlug: searchParams.category,
      search: searchParams.search,
      sortBy: searchParams.sort || "newest",
      limit: pageSize,
      offset,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          All Applications
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Discover {total} verified Android applications, utilities, and unlocked APKs.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <AppsFilterBar
        categories={categories}
        currentCategory={searchParams.category}
        currentSort={searchParams.sort || "newest"}
        currentSearch={searchParams.search}
      />

      {/* Applications Grid */}
      {applications.length === 0 ? (
        <div className="my-16 text-center rounded-3xl border border-dashed border-border p-12 bg-card/40">
          <div className="mx-auto h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4">
            ?
          </div>
          <h3 className="text-lg font-bold text-foreground">No applications found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            We couldn't find any applications matching your search or filters. Try adjusting your query or resetting filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 my-8">
          {applications.map((app) => (
            <AppCard key={app.id} app={app} variant="grid" />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1;
            const isCurrent = pageNum === currentPage;
            const params = new URLSearchParams();
            if (searchParams.category) params.set("category", searchParams.category);
            if (searchParams.sort) params.set("sort", searchParams.sort);
            if (searchParams.search) params.set("search", searchParams.search);
            params.set("page", pageNum.toString());

            return (
              <a
                key={pageNum}
                href={`/apps?${params.toString()}`}
                className={`h-10 w-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {pageNum}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

