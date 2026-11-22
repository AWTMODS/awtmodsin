import { NextResponse } from "next/server";
import { getApplicationByPackage, getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public endpoint queried by Dalvik Update DEX in modded APKs
// Example: https://www.awtmods.in/api/update?package=com.appostrophe.scrl
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pkg = searchParams.get("package") || searchParams.get("pkg") || "";
  const cleanPackage = pkg.trim().toLowerCase();

  if (!cleanPackage) {
    return NextResponse.json(
      { error: "Missing required query parameter: package" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    const app = await getApplicationByPackage(cleanPackage);

    if (!app) {
      // Check fallback in application_versions directly
      const supabase = getDbClient();
      if (supabase) {
        const { data: directApp } = await supabase
          .from("applications")
          .select(`
            name, package_name,
            versions:application_versions(
              version_code, version_name, release_notes, status, is_latest,
              download_sources(download_url, is_primary, is_active)
            )
          `)
          .ilike("package_name", cleanPackage)
          .maybeSingle();

        if (directApp && directApp.versions && directApp.versions.length > 0) {
          const published = directApp.versions
            .filter((v: any) => v.status === "published")
            .sort((a: any, b: any) => (b.version_code || 0) - (a.version_code || 0))[0] || directApp.versions[0];

          const sources = published.download_sources || [];
          const primarySource = sources.find((s: any) => s.is_primary && s.is_active) || sources[0];
          const downloadUrl = primarySource?.download_url || "https://telegram.me/ARTWEBTECHOFFICIAL";

          return NextResponse.json([
            {
              Header: directApp.name,
              package_name: directApp.package_name,
              version_code: published.version_code || 1,
              force_update: true,
              title: "Update version ",
              description_type: 2,
              html_formatted: false,
              description: published.release_notes || "Base Update\nNew Features\nFixed Bugs",
              update_button_text: "Update Now",
              Update_dismiss_button_text: "Dismiss",
              update_url: downloadUrl,
              auto_redirect_enabled: false,
              auto_redirect_delay: 6,
              show_only_update_button: true,
            }
          ], {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache, no-store, must-revalidate",
            }
          });
        }
      }

      return NextResponse.json(
        { error: `No active release found for package: ${cleanPackage}` },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Filter published versions only
    const versions = app.versions || [];
    const publishedVersions = versions.filter((v) => v.status === "published");
    const activeVersion =
      publishedVersions.find((v) => v.is_latest) ||
      publishedVersions.sort((a, b) => (b.version_code || 0) - (a.version_code || 0))[0] ||
      app.latest_version;

    if (!activeVersion) {
      return NextResponse.json(
        { error: `App is currently staged in draft. No published release active.` },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const sources = activeVersion.download_sources || [];
    const primarySource = sources.find((s) => s.is_primary && s.is_active) || sources[0];
    const downloadUrl = primarySource?.download_url || "https://telegram.me/ARTWEBTECHOFFICIAL";

    const payload = [
      {
        Header: app.name,
        package_name: app.package_name,
        version_code: activeVersion.version_code,
        force_update: true,
        title: "Update version ",
        description_type: 2,
        html_formatted: false,
        description: activeVersion.release_notes || "Base Update\nNew Features\nFixed Bugs",
        update_button_text: "Update Now",
        Update_dismiss_button_text: "Dismiss",
        update_url: downloadUrl,
        auto_redirect_enabled: false,
        auto_redirect_delay: 6,
        show_only_update_button: true,
      },
    ];

    return NextResponse.json(payload, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Public update route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
