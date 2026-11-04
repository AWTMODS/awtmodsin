import { getApplications, getCategories } from "@/lib/db";
import { AppsTable } from "@/components/admin/apps-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Application Management | AWTMods Admin",
};

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams?: { status?: string; category?: string };
}) {
  const [{ applications }, categories] = await Promise.all([
    getApplications({ limit: 100, status: "all" }),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Applications
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage all published and draft Android application packages.
        </p>
      </div>

      <AppsTable
        initialApps={applications}
        categories={categories}
        defaultStatus={searchParams?.status}
      />
    </div>
  );
}

