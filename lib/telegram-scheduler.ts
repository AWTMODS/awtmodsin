import { getDbClient, getApplicationById, getSiteSettings, invalidateDbCache } from "./db";
import { broadcastToTelegram } from "./telegram-broadcast";
import { getSubscribersForApp } from "./telegram-vip";

export interface ScheduledPost {
  id: string;
  appId: string;
  appName: string;
  appSlug: string;
  scheduledFor: string; // ISO String
  scheduledBy: number | string;
  createdAt: string;
  status: "pending" | "published" | "cancelled";
}

/**
 * Retrieves all scheduled posts from Supabase site_settings
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "telegram_scheduled_posts")
        .single();

      if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
        return data.setting_value as ScheduledPost[];
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

/**
 * Saves the full list of scheduled posts
 */
export async function saveScheduledPosts(posts: ScheduledPost[]): Promise<boolean> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_scheduled_posts", setting_value: posts },
          { onConflict: "setting_key" }
        );
      return !error;
    } catch (err) {
      console.error("saveScheduledPosts error:", err);
    }
  }
  return false;
}

/**
 * Queues an application post for future broadcast
 */
export async function scheduleAppPost(
  appId: string,
  scheduledForIso: string,
  adminChatId: number | string
): Promise<{ success: boolean; post?: ScheduledPost; error?: string }> {
  try {
    const app = await getApplicationById(appId);
    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const posts = await getScheduledPosts();
    // Remove any existing pending schedule for this app
    const filtered = posts.filter((p) => p.appId !== appId || p.status !== "pending");

    const newPost: ScheduledPost = {
      id: `sched_${app.id}_${Date.now()}`,
      appId: app.id,
      appName: app.name,
      appSlug: app.slug,
      scheduledFor: scheduledForIso,
      scheduledBy: adminChatId,
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    filtered.unshift(newPost);
    await saveScheduledPosts(filtered);

    return { success: true, post: newPost };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to schedule post" };
  }
}

/**
 * Cancels a pending scheduled post
 */
export async function cancelScheduledPost(appId: string): Promise<boolean> {
  const posts = await getScheduledPosts();
  const updated = posts.map((p) => (p.appId === appId && p.status === "pending" ? { ...p, status: "cancelled" as const } : p));
  return await saveScheduledPosts(updated);
}

/**
 * Checks and executes any scheduled posts whose time has arrived
 */
export async function processDueScheduledPosts(): Promise<{
  executed: number;
  results: { appName: string; success: boolean; error?: string }[];
}> {
  const posts = await getScheduledPosts();
  const now = Date.now();
  const duePosts = posts.filter((p) => p.status === "pending" && new Date(p.scheduledFor).getTime() <= now);

  if (duePosts.length === 0) {
    return { executed: 0, results: [] };
  }

  const settings = await getSiteSettings();
  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = settings.telegramAdminChatId || 1343548529;

  const results: { appName: string; success: boolean; error?: string }[] = [];
  const updatedPosts = [...posts];

  for (const post of duePosts) {
    try {
      const app = await getApplicationById(post.appId);
      if (!app) {
        results.push({ appName: post.appName, success: false, error: "App not found" });
        continue;
      }

      // Publish on website if currently draft
      const supabase = getDbClient();
      if (supabase && app.status === "draft") {
        await supabase
          .from("applications")
          .update({ status: "published" })
          .eq("id", app.id);
      }

      // Broadcast to Telegram Channel
      const broadcastRes = await broadcastToTelegram({
        app: { ...app, status: "published" },
      });

      if (broadcastRes.success) {
        // Mark post as published
        const targetIndex = updatedPosts.findIndex((p) => p.id === post.id);
        if (targetIndex >= 0) {
          updatedPosts[targetIndex] = { ...updatedPosts[targetIndex], status: "published" };
        }

        // Notify subscribers of update
        if (token) {
          const subscriberIds = await getSubscribersForApp(app.slug);
          const version = app.latest_version || app.versions?.[0];
          const siteUrl = settings.siteUrl || "https://www.awtmods.in";
          const appUrl = `${siteUrl}/apps/${app.slug.replace(/\.html$/, "")}.html`;

          for (const subId of subscriberIds) {
            try {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: subId,
                  text: (
                    `⚡ <b>Update Alert: ${app.name} is Live!</b>\n\n` +
                    `🏷️ <b>Version:</b> <code>${version?.version_name || "Latest"}</code>\n` +
                    `📦 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
                    `<i>Your subscribed app has just been updated. Tap below to download:</i>`
                  ),
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "⚡ Direct Download", url: `https://t.me/${settings.telegramBotUsername || "awtmods_bot"}?start=dl_${app.slug.replace(/\.html$/, "")}` },
                        { text: "🌐 View on Website", url: appUrl },
                      ],
                    ],
                  },
                }),
              });
            } catch {}
          }
        }

        // Send confirmation alert to admin
        if (token && adminChatId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: (
                `⏰ <b>Scheduled Post Broadcasted!</b>\n\n` +
                `📦 <b>App:</b> ${app.name}\n` +
                `🏷️ <b>Version:</b> <code>${app.latest_version?.version_name || "Latest"}</code>\n` +
                `📢 <b>Channel:</b> ${settings.telegramChannelId || "@awtmods"}\n` +
                `🌐 Status updated to <b>Published</b> on website!`
              ),
              parse_mode: "HTML",
            }),
          }).catch(() => {});
        }

        results.push({ appName: app.name, success: true });
      } else {
        results.push({ appName: app.name, success: false, error: broadcastRes.error });
      }
    } catch (err: any) {
      results.push({ appName: post.appName, success: false, error: err.message });
    }
  }

  await saveScheduledPosts(updatedPosts);
  invalidateDbCache();

  return {
    executed: results.filter((r) => r.success).length,
    results,
  };
}
