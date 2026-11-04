import { getApplications, getCategories } from "@/lib/db";
import { AppCard } from "@/components/applications/app-card";
import { SearchBarClient } from "@/components/search/search-bar-client";
import { Search } from "lucide-react";

interface SearchPageProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: "newest" | "downloads" | "alphabetical";
  };
}

export const metadata = {
  title: "Search Applications & Mods",
  description: "Search across hundreds of modded Android applications, games, and tools.",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || "";
  const category = searchParams.category || "";
  const sort = searchParams.sort || "newest";

  const [categories, { applications, total }] = await Promise.all([
    getCategories(),
    query.trim() || category
      ? getApplications({
          search: query,
          categorySlug: category,
          sortBy: sort,
          limit: 20,
        })
      : { applications: [], total: 0 },
  ]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Header */}
      <div className="max-w-2xl mx-auto text-center space-y-4 mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Search AWTMods
        </h1>
        <p className="text-sm text-muted-foreground">
          Find any modded Android application, utility, developer, or package name.
        </p>

        {/* Live Search Client */}
        <SearchBarClient
          initialQuery={query}
          categories={categories}
          currentCategory={category}
        />
      </div>

      {/* Results Section */}
      {query.trim() ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <h2 className="text-lg font-bold text-foreground">
              Search Results for &ldquo;{query}&rdquo;
            </h2>
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? "application" : "applications"} found
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-dashed border-border bg-card/40 space-y-3">
              <Search className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">
                No matching applications found
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No applications matched &ldquo;{query}&rdquo;. Check for typos, try searching by package name or developer, or browse categories.
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
      ) : (
        /* Empty Query State with Popular Suggestions */
        <div className="max-w-xl mx-auto py-12 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Popular Search Terms
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {[
                "Spotify",
                "YouTube",
                "Instagram",
                "WhatsApp",
                "Netflix",
                "CapCut",
                "Telegram",
                "Subway Surfers",
              ].map((term) => (
                <a
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="px-3.5 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  {term}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

