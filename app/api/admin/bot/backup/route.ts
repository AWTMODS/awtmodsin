import { NextResponse } from "next/server";
import { sendDatabaseBackupToTelegram } from "@/lib/telegram-backup";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await sendDatabaseBackupToTelegram();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      message: result.message,
      stats: result.stats,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Backup failed" }, { status: 500 });
  }
}
