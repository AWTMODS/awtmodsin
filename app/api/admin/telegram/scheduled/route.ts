import { NextResponse } from "next/server";
import {
  getScheduledPosts,
  saveScheduledPosts,
  cancelScheduledPost,
} from "@/lib/telegram-scheduler";
import { getApplicationById, getSiteSettings } from "@/lib/db";
import { broadcastToTelegram } from "@/lib/telegram-broadcast";
import { getSubscribersForApp } from "@/lib/telegram-vip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const posts = await getScheduledPosts();
    return NextResponse.json({ success: true, posts });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load scheduled posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, postId, appId, scheduledFor } = body as {
      action: "publish_now" | "cancel" | "reschedule";
      postId?: string;
      appId?: string;
      scheduledFor?: string;
    };

    if (!action || (!postId && !appId)) {
      return NextResponse.json({ error: "Missing action or target id" }, { status: 400 });
    }

    const posts = await getScheduledPosts();
    const target = posts.find(
      (p) => (postId && p.id === postId) || (appId && p.appId === appId && p.status === "pending")
    );

    if (!target) {
      return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
    }

    if (action === "reschedule") {
      if (!scheduledFor) {
        return NextResponse.json({ error: "Missing scheduledFor date/time" }, { status: 400 });
      }
      const parsed = new Date(scheduledFor);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledFor date/time" }, { status: 400 });
      }
      const nextIso = parsed.toISOString();
      const updated = posts.map((p) =>
        p.id === target.id ? { ...p, scheduledFor: nextIso } : p
      );
      await saveScheduledPosts(updated);
      return NextResponse.json({ success: true, posts: updated });
    }

    if (action === "cancel") {
      const updated = posts.map((p) =>
        p.id === target.id ? { ...p, status: "cancelled" as const } : p
      );
      await saveScheduledPosts(updated);
      return NextResponse.json({ success: true, posts: updated });
    }

    if (action === "publish_now") {
      const app = await getApplicationById(target.appId);
      if (!app) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      const broadcastRes = await broadcastToTelegram({
        app: { ...app, status: "published" },
        force: true,
      });

      if (!broadcastRes.success) {
        return NextResponse.json(
          { error: broadcastRes.error || "Telegram broadcast failed" },
          { status: 500 }
        );
      }

      const updated = posts.map((p) =>
        p.id === target.id ? { ...p, status: "published" as const } : p
      );
      await saveScheduledPosts(updated);

      // Notify community subscribers
      try {
        const settings = await getSiteSettings();
        const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const subscriberIds = await getSubscribersForApp(app.slug);
          const version = app.latest_version || app.versions?.[0];
          const siteUrl = settings.siteUrl || "https://www.awtmods.in";
          const appUrl = `${siteUrl}/apps/${app.slug.replace(/\.html$/, "")}.html`;
          for (const subId of subscriberIds) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: subId,
                text: (
                  `⚡ <b>Update Alert: ${app.name} is Live!</b>\n\n` +
                  `🏷️ <b>Version:</b> <code>${version?.version_name || "Latest"}</code>\n` +
                  `📦 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
                  `🔗 <a href="${appUrl}">Download Latest Release</a>`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }
      } catch {}

      return NextResponse.json({ success: true, posts: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}
