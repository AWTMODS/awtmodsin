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

    // 1. Mod Features unique to each individual app
    let modFeaturesList: string[] = [];
    if (Array.isArray(app.mod_features) && app.mod_features.length > 0) {
      modFeaturesList = app.mod_features.map((f) => String(f).trim()).filter(Boolean);
    } else if (version?.release_notes) {
      modFeaturesList = version.release_notes
        .split(/\n|•|\*|;/)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter((s) => s.length > 2);
    }

    if (modFeaturesList.length === 0) {
      modFeaturesList = [
        "Premium / VIP features Unlocked",
        "Audio and visual ads blocked",
        "Background playback support",
        "Smooth optimised mod version",
      ];
    }

    const formattedModFeatures = modFeaturesList
      .slice(0, 6)
      .map((feat) => `<tg-emoji emoji-id="5445284980978644754">🟢</tg-emoji> ${escapeHtml(feat)}`)
      .join("\n");

    // 2. Play Store / Official Site Link
    const storeLink =
      app.package_name && app.package_name.includes(".") && !app.package_name.startsWith("com.awt")
        ? `https://play.google.com/store/apps/details?id=${app.package_name}`
        : appUrl;

    const channelHandle = settings.telegramChannelId || "@awtmods";

    // Prepare interactive HTML caption with animated emoji support & per-app mod features
    let caption: string;
    if (settings.telegramPostTemplate && settings.telegramPostTemplate.trim()) {
      caption = settings.telegramPostTemplate
        .replace(/{app_name}/g, escapeHtml(app.name))
        .replace(/{version}/g, escapeHtml(versionName))
        .replace(/{file_size}/g, escapeHtml(fileSize))
        .replace(/{category}/g, escapeHtml(categoryName))
        .replace(/{developer}/g, escapeHtml(developerName))
        .replace(/{store_link}/g, storeLink)
        .replace(/{mod_features}/g, formattedModFeatures)
        .replace(/{channel_handle}/g, channelHandle)
        .replace(/{release_notes}/g, escapeHtml(releaseNotes.slice(0, 400)))
        .replace(/{app_url}/g, appUrl)
        .replace(/{clean_slug}/g, escapeHtml(cleanSlug))
        .replace(/{vip_link}/g, vipDeepLink);
    } else {
      caption = [
        `<tg-emoji emoji-id="5443026723220265219">🔘</tg-emoji> <b>${escapeHtml(app.name)} [VIP]</b>`,
        `<tg-emoji emoji-id="5447644880824188382">🏷️</tg-emoji> <b>Version:</b> <code>${escapeHtml(versionName)}</code> <tg-emoji emoji-id="5445077613506757650">🔔</tg-emoji> <b>#update</b>`,
        `<tg-emoji emoji-id="5427009714745517384">▶️</tg-emoji> <a href="${storeLink}">Play Store / Official Site Link</a>`,
        ``,
        `<tg-emoji emoji-id="5465465412345678901">🔥</tg-emoji> <u><b>Features &amp; Mod Info:</b></u>`,
        formattedModFeatures,
        ``,
        `<tg-emoji emoji-id="5443026723220265219">🎉</tg-emoji> <b>Join Channel ➔</b> ${channelHandle}`,
      ].join("\n");
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "⚡ DOWNLOAD NOW (Instant VIP)",
            url: vipDeepLink,
          },
        ],
        [
          {
            text: "🌐 DOWNLOAD NOW (Free Website)",
            url: appUrl,
          },
        ],
      ],
    };

    // Helper to send photo or message with auto-fallback for custom emojis
    const sendWithFallback = async (usePhoto: boolean) => {
      let currentCaption = caption;
      let endpoint = usePhoto ? "sendPhoto" : "sendMessage";
      let payload: any = {
        chat_id: channelId,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      };

      if (usePhoto) {
        payload.photo = photoUrl;
        payload.caption = currentCaption;
      } else {
        payload.text = currentCaption;
        payload.disable_web_page_preview = false;
      }

      let res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = await res.json();

      // If Telegram rejects custom emojis (ENTITY_NOT_ALLOWED), strip them to standard emojis and retry
      if (!data.ok && (data.description?.includes("ENTITY") || data.description?.includes("custom_emoji"))) {
        const plainCaption = currentCaption.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, "$1");
        if (usePhoto) {
          payload.caption = plainCaption;
        } else {
          payload.text = plainCaption;
        }

        res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = await res.json();
      }

      return data;
    };

    // Try sending with photo first if icon is valid absolute URL
    let photoUrl = app.icon_url;
    if (photoUrl && photoUrl.startsWith("/")) {
      photoUrl = `${siteUrl}${photoUrl}`;
    }

    const isHttpUrl = photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"));

    if (isHttpUrl) {
      try {
        const photoData = await sendWithFallback(true);
        if (photoData.ok) {
          return {
            success: true,
            message: `Successfully posted ${app.name} to ${channelId}`,
            messageId: photoData.result?.message_id,
          };
        }
        console.warn("sendPhoto failed, falling back to sendMessage:", photoData.description);
      } catch (err) {
        console.warn("sendPhoto exception, falling back to sendMessage:", err);
      }
    }

    // Fallback: sendMessage
    const msgData = await sendWithFallback(false);
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
      `<tg-emoji emoji-id="5443026723220265219">🤖</tg-emoji> <b>AWTMods Telegram Bot Connected!</b>`,
      ``,
      `<tg-emoji emoji-id="5445284980978644754">✅</tg-emoji> This is an interactive test confirmation from <b>AWTMods Admin Console</b>.`,
      `<tg-emoji emoji-id="5447644880824188382">⚡</tg-emoji> Auto-poster, custom emojis, and VIP bot channels are active!`,
      `<tg-emoji emoji-id="5445077613506757650">⏰</tg-emoji> <b>Timestamp:</b> ${new Date().toISOString()}`,
    ].join("\n");

    let res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: testText,
        parse_mode: "HTML",
      }),
    });

    let data = await res.json();

    // Fallback if custom emoji tags rejected
    if (!data.ok && (data.description?.includes("ENTITY") || data.description?.includes("custom_emoji"))) {
      const plainText = testText.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, "$1");
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
          parse_mode: "HTML",
        }),
      });
      data = await res.json();
    }
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
