import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getApplicationById, getCategories } from "@/lib/db";
import { AddAppForm } from "@/components/admin/add-app-form";

export const metadata = {
  title: "Edit Application | AWTMods Admin",
};

export default async function EditAppPage({
  params,
}: {
  params: { id: string };
}) {
  const [app, categories] = await Promise.all([
    getApplicationById(params.id),
    getCategories(),
  ]);

  if (!app) {
    notFound();
  }

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
            Edit Application
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Updating metadata, versions, and download sources for <span className="font-semibold text-foreground">{app.name}</span>
          </p>
        </div>
      </div>

      <AddAppForm categories={categories} initialApp={app} />
    </div>
  );
}
