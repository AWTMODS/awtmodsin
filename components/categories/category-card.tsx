import Link from "next/link";
import {
  Users,
  Video,
  Music,
  Wrench,
  Camera,
  Gamepad2,
  MessageSquare,
  FileText,
  Film,
  BookOpen,
  Monitor,
  Laptop,
  AppWindow,
  LucideIcon,
} from "lucide-react";
import { AppCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Users,
  Video,
  Music,
  Wrench,
  Camera,
  Gamepad2,
  MessageSquare,
  FileText,
  Film,
  BookOpen,
  Monitor,
  Laptop,
};

interface CategoryCardProps {
  category: AppCategory;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const IconComponent = iconMap[category.icon] || AppWindow;

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group flex flex-col items-center justify-center p-5 rounded-2xl border border-border bg-card hover:border-neutral-400/50 dark:hover:border-neutral-600/50 hover:shadow-md transition-all text-center",
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground group-hover:scale-110 transition-transform duration-200 border border-border/80">
        <IconComponent className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h3 className="mt-3 font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
        {category.name}
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        {category.app_count || 0} {category.app_count === 1 ? "App" : "Apps"}
      </p>
    </Link>
  );
}

