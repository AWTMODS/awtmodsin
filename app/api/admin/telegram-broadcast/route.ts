import { NextResponse } from "next/server";
import { getApplicationById } from "@/lib/db";
import { broadcastToTelegram, testTelegramConnection } from "@/lib/telegram-broadcast";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action = "test", appId, targetChat, force = true } = body;

    if (action === "test") {
      const result = await testTelegramConnection(targetChat);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === "broadcast") {
      if (!appId) {
        return NextResponse.json({ error: "App ID is required for broadcast" }, { status: 400 });
      }

      const app = await getApplicationById(appId);
      if (!app) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const result = await broadcastToTelegram({
        app,
        force,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || result.message }, { status: 400 });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Broadcast error" }, { status: 500 });
  }
}
