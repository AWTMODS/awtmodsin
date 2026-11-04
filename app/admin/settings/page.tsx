import { getSiteSettings } from "@/lib/db";
import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata = {
  title: "Website Settings | AWTMods Admin",
};

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Platform Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Configure branding, community channels, SEO defaults, and download countdown behaviors.
        </p>
      </div>

      <SettingsManager initialSettings={settings} />
    </div>
  );
}

