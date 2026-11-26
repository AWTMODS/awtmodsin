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

  const viewType = searchParams?.type;
  const pageTitle =
    viewType === "games"
      ? "Android Games"
      : viewType === "pc"
      ? "PC Software"
      : "Android Applications";
  const pageDescription =
    viewType === "games"
      ? "Manage all Android Games packages."
      : viewType === "pc"
      ? "Manage all PC Software packages."
      : "Manage all Android App packages.";

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {pageTitle}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          {pageDescription}
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

