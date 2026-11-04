"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { AppCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface SearchBarClientProps {
  initialQuery?: string;
  categories: AppCategory[];
  currentCategory?: string;
}

export function SearchBarClient({
  initialQuery = "",
  categories,
  currentCategory = "",
}: SearchBarClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCat, setSelectedCat] = useState(currentCategory);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCat) params.set("category", selectedCat);
    router.push(`/search?${params.toString()}`);
  };

  const handleClear = () => {
    setQuery("");
    router.push("/search");
  };

  return (
    <form onSubmit={handleSearch} className="space-y-3">
      <div className="flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
        <Search className="h-5 w-5 text-muted-foreground ml-3 shrink-0" />
        <input
          type="text"
          placeholder="Search by app name, package, or developer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground mr-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Button type="submit" size="default" className="rounded-xl px-5 shrink-0">
          Search
        </Button>
      </div>

      {/* Category selector */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCat("")}
          className={`px-3 py-1 rounded-full border transition-colors ${
            !selectedCat
              ? "bg-primary text-primary-foreground border-transparent font-medium"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All Genres
        </button>
        {categories.slice(0, 6).map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.slug)}
            className={`px-3 py-1 rounded-full border transition-colors shrink-0 ${
              selectedCat === cat.slug
                ? "bg-primary text-primary-foreground border-transparent font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </form>
  );
}

