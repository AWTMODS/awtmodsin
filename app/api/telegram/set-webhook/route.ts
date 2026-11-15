import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const siteUrl = settings.siteUrl || "https://www.awtmods.in";

    if (!token) {
      return NextResponse.json(
        { error: "Telegram Bot Token is not configured. Please enter and save your token first." },
        { status: 400 }
      );
    }

    const webhookUrl = `${siteUrl}/api/telegram/webhook`;

    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
    );

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: data.description || "Failed to set Telegram webhook" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Webhook successfully activated! @${settings.telegramBotUsername || "awtmods_bot"} is now running 24/7 on Vercel with zero VPS!`,
      webhookUrl,
      telegramResponse: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Webhook registration failed" },
      { status: 500 }
    );
  }
}
