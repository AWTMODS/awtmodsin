import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ signature: "offline" });
    }

    const [appsRes, latestAppRes, latestVerRes] = await Promise.all([
      supabase.from("applications").select("id", { count: "exact", head: true }),
      supabase
        .from("applications")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("application_versions")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const count = appsRes.count ?? 0;
    const appUpdated = latestAppRes.data?.updated_at ?? "";
    const verCreated = latestVerRes.data?.created_at ?? "";

    return NextResponse.json(
      { signature: `${count}|${appUpdated}|${verCreated}` },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch {
    return NextResponse.json({ signature: "error" }, { status: 200 });
  }
}
