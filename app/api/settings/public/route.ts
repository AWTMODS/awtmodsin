import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({
      siteName: settings.siteName,
      telegramUrl: settings.telegramUrl || "https://t.me/awtmods",
      telegramPopupEnabled: settings.telegramPopupEnabled !== false,
      telegramPopupDelay: settings.telegramPopupDelay ?? 3,
      telegramPopupTitle: settings.telegramPopupTitle || "Join our Telegram",
      telegramPopupDesc:
        settings.telegramPopupDesc ||
        "Get new premium unlocked apps first, plus update alerts and support from the community.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        telegramUrl: "https://t.me/awtmods",
        telegramPopupEnabled: true,
        telegramPopupDelay: 3,
        telegramPopupTitle: "Join our Telegram",
        telegramPopupDesc:
          "Get new premium unlocked apps first, plus update alerts and support from the community.",
      },
      { status: 200 }
    );
  }
}
