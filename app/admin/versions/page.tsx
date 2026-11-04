import { getApplications } from "@/lib/db";
import { VersionsManager } from "@/components/admin/versions-manager";

export const metadata = {
  title: "Version Management | AWTMods Admin",
};

export default async function AdminVersionsPage() {
  const { applications } = await getApplications({ limit: 100 });

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Version Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Deploy version updates, release notes, and preserve historical version archives.
        </p>
      </div>

      <VersionsManager initialApps={applications} />
    </div>
  );
}

