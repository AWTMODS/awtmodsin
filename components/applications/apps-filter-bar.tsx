"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AppCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface AppsFilterBarProps {
  categories: AppCategory[];
  currentCategory?: string;
  currentSort?: string;
  currentSearch?: string;
}

export function AppsFilterBar({
  categories,
  currentCategory,
  currentSort = "newest",
  currentSearch = "",
}: AppsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(currentSearch);

  const applyFilters = (updates: {
    category?: string;
    sort?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();

    const category = updates.category !== undefined ? updates.category : currentCategory;
    const sort = updates.sort !== undefined ? updates.sort : currentSort;
    const searchVal = updates.search !== undefined ? updates.search : search;

    if (category) params.set("category", category);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (searchVal?.trim()) params.set("search", searchVal.trim());

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search });
  };

  const clearFilters = () => {
    setSearch("");
    router.push(pathname);
  };

  const hasActiveFilters = !!currentCategory || !!currentSearch || currentSort !== "newest";

  return (
    <div className="space-y-4">
      {/* Top search & Sort controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, package, or developer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Sort by:
          </label>
          <select
            value={currentSort}
            onChange={(e) => applyFilters({ sort: e.target.value })}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest First</option>
            <option value="downloads">Most Downloaded</option>
            <option value="alphabetical">Alphabetical (A-Z)</option>
            <option value="oldest">Oldest First</option>
          </select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground h-9 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Category Pills horizontal scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => applyFilters({ category: "" })}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !currentCategory
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => {
          const isSelected = currentCategory?.toLowerCase() === cat.slug.toLowerCase();
          return (
            <button
              key={cat.id}
              onClick={() => applyFilters({ category: cat.slug })}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

