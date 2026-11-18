import { getApplications, getCategories } from "@/lib/db";
import { AppsTable } from "@/components/admin/apps-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Application Management | AWTMods Admin",
};

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams?: { status?: string; category?: string; type?: string };
}) {
  const [{ applications }, categories] = await Promise.all([
    getApplications({ limit: 1000, status: "all" }),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Applications &amp; Software
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage all Android Apps, Android Games, and PC Software packages.
        </p>
      </div>

      <AppsTable
        initialApps={applications}
        categories={categories}
        defaultStatus={searchParams?.status}
        defaultType={searchParams?.type}
      />
    </div>
  );
}

