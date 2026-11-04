import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppCategory } from "@/lib/types";
import { CategoryCard } from "@/components/categories/category-card";

interface CategoriesSectionProps {
  categories: AppCategory[];
}

export function CategoriesSection({ categories }: CategoriesSectionProps) {
  return (
    <section className="py-14 sm:py-16 border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Categories
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Browse apps by category
            </p>
          </div>
          <Link
            href="/categories"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {categories.slice(0, 6).map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}

