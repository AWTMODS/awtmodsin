import { getSiteSettings } from "./db";
import { Application, ApplicationVersion } from "./types";
import { cleanAppSlug } from "./utils";

export interface TelegramBroadcastOptions {
  app: Application;
  version?: ApplicationVersion | null;
  customMessage?: string;
  force?: boolean;
}

export interface TelegramBroadcastResult {
  success: boolean;
  message?: string;
  messageId?: number;
  error?: string;
}

/**
 * Escapes HTML characters for Telegram HTML parse_mode
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Broadcasts an app update or release to the configured Telegram Channel
 */
export async function broadcastToTelegram(
  options: TelegramBroadcastOptions
): Promise<TelegramBroadcastResult> {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const channelId = settings.telegramChannelId || "@awtmods";
    const botUsername = settings.telegramBotUsername || "awtmods_bot";
    const siteUrl = settings.siteUrl || "https://www.awtmods.in";

    if (!token) {
      return {
        success: false,
        error: "Telegram Bot Token is not configured in Admin Settings.",
      };
    }

    if (!channelId) {
      return {
        success: false,
        error: "Telegram Channel ID is not configured in Admin Settings.",
      };
    }

    if (!options.force && settings.telegramAutoPostEnabled === false) {
      return {
        success: false,
        message: "Auto-posting is disabled in Admin Settings.",
      };
    }

    const { app } = options;
    const version = options.version || app.latest_version || app.versions?.[0];
    const cleanSlug = cleanAppSlug(app.slug);
    const appUrl = `${siteUrl}/apps/${cleanSlug}.html`;
    const vipDeepLink = `https://t.me/${botUsername}?start=dl_${cleanSlug.slice(0, 50)}`;

    const versionName = version?.version_name || "Latest";
    const fileSize = version?.file_size || "50 MB";
    const categoryName = app.category?.name || "Modded App";
    const developerName = app.developer || "Aadith C V";

    const releaseNotes =
      options.customMessage ||
      version?.release_notes ||
      (app.short_description || "Premium features unlocked, ad-free experience, and performance optimizations.")
        .replace(/^\s*f(?:i|ir)st paragraph of[^\n]*/i, "")
        .trim();

    // Prepare clean HTML caption
    const caption = [
      `🔥 <b>NEW MOD UPDATE RELEASED!</b> 🔥`,
      ``,
      `📱 <b>App:</b> <a href="${appUrl}">${escapeHtml(app.name)}</a>`,
      `🏷️ <b>Version:</b> <code>${escapeHtml(versionName)}</code> (${escapeHtml(fileSize)})`,
      `📂 <b>Category:</b> ${escapeHtml(categoryName)}`,
      `👨‍💻 <b>Developer:</b> ${escapeHtml(developerName)}`,
      ``,
      `✨ <b>MOD FEATURES:</b>`,
      `• ${escapeHtml(releaseNotes.slice(0, 300))}`,
      ``,
      `🛡️ <b>Status:</b> Safe &amp; Verified (Clean)`,
      `🌐 <b>Website:</b> <a href="${appUrl}">awtmods.in/apps/${escapeHtml(cleanSlug)}.html</a>`,
    ].join("\n");

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "📥 Download on Website",
            url: appUrl,
          },
        ],
        [
          {
            text: "⚡ VIP Direct File (No Ads)",
            url: vipDeepLink,
          },
        ],
      ],
    };

    // Try sending with photo first if icon is valid absolute URL
    let photoUrl = app.icon_url;
    if (photoUrl && photoUrl.startsWith("/")) {
      photoUrl = `${siteUrl}${photoUrl}`;
    }

    const isHttpUrl = photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"));

    if (isHttpUrl) {
      try {
        const photoRes = await fetch(
          `https://api.telegram.org/bot${token}/sendPhoto`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: channelId,
              photo: photoUrl,
              caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          }
        );

        const photoData = await photoRes.json();
        if (photoData.ok) {
          return {
            success: true,
            message: `Successfully posted ${app.name} to ${channelId}`,
            messageId: photoData.result?.message_id,
          };
        }
        // If sendPhoto failed (e.g. image format issue), fall through to sendMessage
        console.warn("sendPhoto failed, falling back to sendMessage:", photoData.description);
      } catch (err) {
        console.warn("sendPhoto exception, falling back to sendMessage:", err);
      }
    }

    // Fallback: sendMessage
    const msgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelId,
          text: caption,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          disable_web_page_preview: false,
        }),
      }
    );

    const msgData = await msgRes.json();
    if (!msgData.ok) {
      return {
        success: false,
        error: msgData.description || "Telegram API rejected the broadcast request.",
      };
    }

    return {
      success: true,
      message: `Successfully posted ${app.name} to ${channelId}`,
      messageId: msgData.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to broadcast to Telegram",
    };
  }
}

/**
 * Sends a test ping to verify Telegram Bot configuration
 */
export async function testTelegramConnection(
  targetChat?: string
): Promise<TelegramBroadcastResult> {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = targetChat || settings.telegramChannelId || "@awtmods";

    if (!token) {
      return {
        success: false,
        error: "Telegram Bot Token is not configured. Please save your token first.",
      };
    }

    const testText = [
      `🤖 <b>AWTMods Telegram Bot Connected!</b>`,
      ``,
      `✅ This is a test confirmation message from <b>AWTMods Admin Console</b>.`,
      `⚡ Auto-poster and VIP bot channels are active.`,
      `⏰ <b>Timestamp:</b> ${new Date().toISOString()}`,
    ].join("\n");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: testText,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return {
        success: false,
        error: data.description || "Failed to send test message to Telegram.",
      };
    }

    return {
      success: true,
      message: `Test message successfully delivered to ${chatId}!`,
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reach Telegram API",
    };
  }
}
