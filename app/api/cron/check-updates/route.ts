import { NextResponse } from "next/server";
import { checkPlayStoreUpdates } from "@/lib/playstore-radar";
import { processDueScheduledPosts } from "@/lib/telegram-scheduler";
import { checkAndSendVipExpiryReminders } from "@/lib/telegram-vip";
import { checkCompetitorModReleases } from "@/lib/competitor-radar";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 40;

    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";

    // 1. Process Due Scheduled Channel Posts
    const scheduledRes = await processDueScheduledPosts().catch((err) => ({
      executed: 0,
      results: [],
      error: err.message,
    }));

    // 2. Process VIP Expiry Reminders (3 days prior)
    const expiryRes = await checkAndSendVipExpiryReminders(token).catch((err) => ({
      notifiedCount: 0,
      users: [],
      error: err.message,
    }));

    // 3. Competitor Mod Radar (only runs if enabled in Admin Panel)
    const competitorRes = await checkCompetitorModReleases({
      limit: 15,
      notifyTelegram: true,
    }).catch((err) => ({
      enabled: false,
      scanned: 0,
      alertsFound: 0,
      alerts: [],
      error: err.message,
    }));

    // 4. Play Store Version Radar
    const radarResult = await checkPlayStoreUpdates({
      limit,
      notifyTelegram: true,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scheduledPosts: scheduledRes,
      vipExpiryReminders: expiryRes,
      competitorRadar: competitorRes,
      playStoreRadar: radarResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Cron scan failed" }, { status: 500 });
  }
}
