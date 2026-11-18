import { NextResponse } from "next/server";
import {
  transitionToModdingStarted,
  transitionToModdedCompleted,
  transitionToReadyToPublish,
  transitionToModReleased,
} from "@/lib/radar-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, appId, adminName = "Admin" } = body;

    if (!appId || !action) {
      return NextResponse.json({ error: "Missing required appId or action parameter" }, { status: 400 });
    }

    switch (action) {
      case "start_modding": {
        const res = await transitionToModdingStarted({
          appId,
          adminName,
          remarks: body.remarks || "",
          internalInstructions: body.internalInstructions,
          requiredModifications: body.requiredModifications,
          knownIssues: body.knownIssues,
          testingRequirements: body.testingRequirements,
          assignedModder: body.assignedModder || "Aadith C V",
          priority: body.priority || "Medium",
        });
        if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
        return NextResponse.json({ success: true, status: "MODDING_STARTED" });
      }

      case "mark_completed": {
        const res = await transitionToModdedCompleted({
          appId,
          adminName,
          completionRemarks: body.completionRemarks,
        });
        if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
        return NextResponse.json({ success: true, status: "MODDED_COMPLETED" });
      }

      case "mark_ready": {
        if (!body.finalModVersion) {
          return NextResponse.json({ error: "Final mod version is required" }, { status: 400 });
        }
        const res = await transitionToReadyToPublish({
          appId,
          adminName,
          finalModVersion: body.finalModVersion,
          downloadUrl: body.downloadUrl,
          releaseNotes: body.releaseNotes,
        });
        if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
        return NextResponse.json({ success: true, status: "READY_TO_PUBLISH" });
      }

      case "mark_released": {
        if (!body.releasedModVersion || !body.downloadUrl) {
          return NextResponse.json({ error: "Released version and download URL are required" }, { status: 400 });
        }
        const res = await transitionToModReleased({
          appId,
          adminName,
          releasedModVersion: body.releasedModVersion,
          downloadUrl: body.downloadUrl,
          changelog: body.changelog,
          releaseRemarks: body.releaseRemarks,
        });
        if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
        return NextResponse.json({
          success: true,
          status: "MOD_RELEASED",
          archivedFromRadar: true,
          release: res.release,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown workflow action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Workflow transition failed" }, { status: 500 });
  }
}
