import { getModRequests } from "@/lib/db";
import { RequestsAdminManager } from "@/components/admin/requests-admin-manager";

export const metadata = {
  title: "Mod Requests | AWTMods Admin",
};

export default async function AdminRequestsPage() {
  const requests = await getModRequests();

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Mod Requests Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Review community-submitted mod requests, manage development status, and link completed releases.
        </p>
      </div>

      <RequestsAdminManager initialRequests={requests} />
    </div>
  );
}
