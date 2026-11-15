import { Suspense } from "react";
import { getCategories } from "@/lib/db";
import { AddAppForm } from "@/components/admin/add-app-form";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export const metadata = {
  title: "Publish New Application | AWTMods Admin",
};

export default async function NewAppPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Link
          href="/admin/apps"
          className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Add New Application
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Fill in metadata, upload screenshots, and connect external download mirrors.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Loading application form...</span>
          </div>
        }
      >
        <AddAppForm categories={categories} />
      </Suspense>
    </div>
  );
}

