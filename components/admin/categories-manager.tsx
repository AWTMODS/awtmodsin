"use client";

import { useState } from "react";
import { AppCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: AppCategory[];
}) {
  const [categories, setCategories] = useState<AppCategory[]>(initialCategories);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("AppWindow");

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCategory: AppCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: description.trim(),
      icon: icon.trim() || "AppWindow",
      sort_order: categories.length + 1,
      is_active: true,
      app_count: 0,
      created_at: new Date().toISOString(),
    };

    setCategories((prev) => [...prev, newCategory]);
    setName("");
    setSlug("");
    setDescription("");
    toast.success(`Category "${newCategory.name}" created!`);
  };

  const handleDelete = (id: string, catName: string) => {
    if (!confirm(`Delete category "${catName}"?`)) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success(`Category deleted`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Categories List */}
      <div className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
          Active Categories ({categories.length})
        </h3>

        <div className="divide-y divide-border/60">
          {categories.map((c) => (
            <div
              key={c.id}
              className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {c.name}
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    /{c.slug}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.description || "No description"}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">
                  {c.app_count || 0} apps
                </span>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Delete category"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Category Form */}
      <div className="lg:col-span-4 rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4 h-fit">
        <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
          Create New Category
        </h3>

        <form onSubmit={handleAddCategory} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Category Name
            </label>
            <Input
              placeholder="e.g. Social, Games"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
              }}
              required
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Slug
            </label>
            <Input
              placeholder="e.g. music-audio"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Icon Key (Lucide)
            </label>
            <Input
              placeholder="e.g. Music, Camera, Gamepad2"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Description
            </label>
            <Input
              placeholder="Brief description for SEO and category page"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <Button type="submit" size="default" className="w-full rounded-xl font-bold gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

