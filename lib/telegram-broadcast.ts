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

    // ==========================================
    // Check Broadcasting Publishing Mode
    // Mode 1 (Default): 'bot_inline' -> Direct to channel with 3 interactive buttons
    // Mode 2: 'admin_draft' -> Pre-formatted draft sent to Admin DM first
    // Mode 3: 'userbot_mtproto' -> MTProto user session with animated emojis
    // ==========================================
    const broadcastMode = settings.telegramBroadcastMode || "bot_inline";

    // Mode 2: Admin Draft Mode (Review & 1-Tap Forward)
    if (!options.force && broadcastMode === "admin_draft") {
      const adminChatId = settings.telegramAdminChatId || "1343548529";
      const draftRes = await sendDraftPreviewToAdmin(options.app, adminChatId);
      return {
        success: draftRes.success,
        message: `Draft preview sent to Admin DM for review. Forward to ${channelId} from your Telegram Premium account to display native animated emojis!`,
      };
    }

    const { app } = options;
    const version = options.version || app.latest_version || app.versions?.[0];
    const cleanSlug = cleanAppSlug(app.slug);
    const appUrl = `${siteUrl}/apps/${cleanSlug}.html`;
    const vipDeepLink = `https://t.me/${botUsername}?start=dl_${cleanSlug.slice(0, 50)}`;

    const versionName = version?.version_name || "Latest";
    const fileSize = version?.file_size || "Varies with device";
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
      .map((feat) => `<tg-emoji emoji-id="4956649845952611245">🟢</tg-emoji> ${escapeHtml(feat)}`)
      .join("\n");

    // 2. Play Store / Official Site Link
    const storeLink =
      app.package_name && app.package_name.includes(".") && !app.package_name.startsWith("com.awt")
        ? `https://play.google.com/store/apps/details?id=${app.package_name}`
        : appUrl;

    const channelHandle = settings.telegramChannelId || "@awtmods";

    const downloadPageUrl = `${siteUrl}/download/${cleanSlug}`;

    // Prepare interactive HTML caption with animated emoji support & per-app mod features
    let caption: string;
    const hasValidTemplate =
      settings.telegramPostTemplate &&
      settings.telegramPostTemplate.trim() &&
      settings.telegramPostTemplate.includes("{app_name}");

    if (hasValidTemplate) {
      caption = settings.telegramPostTemplate!
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
        .replace(/{download_url}/g, downloadPageUrl)
        .replace(/{clean_slug}/g, escapeHtml(cleanSlug))
        .replace(/{vip_link}/g, vipDeepLink);
    } else {
      caption = [
        `<tg-emoji emoji-id="4956420911310832630">👑</tg-emoji> <b>${escapeHtml(app.name)}</b> <tg-emoji emoji-id="4956739572114392015">💎</tg-emoji> <b>[VIP]</b>`,
        `<tg-emoji emoji-id="4958529074533238201">ℹ️</tg-emoji> <b>Version:</b> <code>${escapeHtml(versionName)}</code> <tg-emoji emoji-id="4956290155326473271">🔔</tg-emoji> <b>#update</b>`,
        `<tg-emoji emoji-id="4958689671950369798">🔗</tg-emoji> <a href="${storeLink}">Play Store / Official Site Link</a>`,
        ``,
        `<u><b>Features &amp; Mod Info:</b></u> <tg-emoji emoji-id="4956606007221421405">❤️‍🔥</tg-emoji>`,
        formattedModFeatures,
        ``,
        `<tg-emoji emoji-id="4958534696645428119">‼️</tg-emoji> <i>Clean &amp; 100% Virus-Free APK (Verified &amp; Safe to Install)</i>`,
        ``,
        `<tg-emoji emoji-id="4958714479681471536">⭐️</tg-emoji> <b>Join Channel ➔</b> ${channelHandle}`,
      ].join("\n");
    }

    // 1. DevUploads & external mirrors detection for channel post buttons
    const devUploadsMirror = version?.download_sources?.find(
      (s) =>
        s.download_url &&
        (s.download_url.includes("devuploads.com") ||
          s.hosting_provider === "custom" ||
          s.mirror_name?.toLowerCase().includes("devuploads"))
    ) || version?.download_sources?.find(
      (s) => s.download_url && !s.download_url.includes("t.me")
    );

    const inlineKeyboard: any[][] = [
      [
        {
          text: "⚡ DOWNLOAD NOW (Instant VIP)",
          url: vipDeepLink,
        },
      ],
      [
        {
          text: "🌐 DOWNLOAD NOW (Website)",
          url: downloadPageUrl,
        },
      ],
    ];

    const replyMarkup = { inline_keyboard: inlineKeyboard };

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

    // Mode 3: Telegram Premium Userbot (MTProto)
    if (
      broadcastMode === "userbot_mtproto" &&
      settings.telegramUserApiId &&
      settings.telegramUserApiHash &&
      settings.telegramUserSessionString
    ) {
      const ubRes = await broadcastViaUserbot(
        settings,
        channelId,
        caption,
        isHttpUrl ? photoUrl : undefined,
        {
          vipUrl: vipDeepLink,
          devUploadsUrl: devUploadsMirror?.download_url,
          websiteUrl: downloadPageUrl,
        }
      );
      if (ubRes.success) {
        return ubRes;
      }
      console.warn("Userbot broadcast failed, falling back to Bot API Mode 1:", ubRes.error);
    }

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

    // Notify update subscribers in background
    try {
      const { getSubscribersForApp } = await import("./telegram-vip");
      const subIds = await getSubscribersForApp(app.slug);
      const botUser = settings.telegramBotUsername || "awtmods_bot";
      for (const subId of subIds) {
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: subId,
            text: (
              `⚡ <b>New Update Released for ${escapeHtml(app.name)}!</b>\n\n` +
              `🏷️ <b>Version:</b> <code>${escapeHtml(versionName)}</code>\n` +
              `📦 <b>Size:</b> ${escapeHtml(fileSize)}\n\n` +
              `<i>Tap below to download the latest update now:</i>`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⚡ Direct Download", url: `https://t.me/${botUser}?start=dl_${cleanSlug.slice(0, 50)}` },
                  { text: "🌐 View on Website", url: appUrl },
                ],
              ],
            },
          }),
        }).catch(() => {});
      }
    } catch {}

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

/**
 * Sends an interactive Draft Broadcast Preview to the Admin with 1-tap Approve & Edit buttons
 */
export async function sendDraftPreviewToAdmin(
  app: Application,
  adminChatId: number | string
): Promise<TelegramBroadcastResult> {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { success: false, error: "Bot token missing" };
    }

    const version = app.latest_version || app.versions?.[0];
    const cleanSlug = cleanAppSlug(app.slug);
    const siteUrl = settings.siteUrl || "https://www.awtmods.in";
    const appUrl = `${siteUrl}/apps/${cleanSlug}.html`;
    const channelId = settings.telegramChannelId || "@awtmods";
    const botUsername = settings.telegramBotUsername || "awtmods_bot";
    const vipDeepLink = `https://t.me/${botUsername}?start=dl_${cleanSlug.slice(0, 50)}`;
    const downloadPageUrl = `${siteUrl}/download/${cleanSlug}`;

    const versionName = version?.version_name || "Latest";
    const versionCode = version?.version_code || 1;
    const fileSize = version?.file_size || "Varies with device";

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
        "Smooth optimised mod version",
        "Clean & verified APK (Safe to Install)",
      ];
    }

    const formattedModFeatures = modFeaturesList
      .slice(0, 6)
      .map((feat) => `<tg-emoji emoji-id="4956649845952611245">🟢</tg-emoji> ${escapeHtml(feat)}`)
      .join("\n");

    const storeLink =
      app.package_name && app.package_name.includes(".") && !app.package_name.startsWith("com.awt")
        ? `https://play.google.com/store/apps/details?id=${app.package_name}`
        : appUrl;

    const devUploadsMirror = version?.download_sources?.find(
      (s) =>
        s.download_url &&
        (s.download_url.includes("devuploads.com") ||
          s.hosting_provider === "custom" ||
          s.mirror_name?.toLowerCase().includes("devuploads"))
    ) || version?.download_sources?.find(
      (s) => s.download_url && !s.download_url.includes("t.me")
    );

    const postDraft = [
      `<tg-emoji emoji-id="4956420911310832630">👑</tg-emoji> <b>${escapeHtml(app.name)}</b> <tg-emoji emoji-id="4956739572114392015">💎</tg-emoji> <b>[VIP]</b>`,
      `<tg-emoji emoji-id="4958529074533238201">ℹ️</tg-emoji> <b>Version:</b> <code>${escapeHtml(versionName)}</code> <tg-emoji emoji-id="4956290155326473271">🔔</tg-emoji> <b>#update</b>`,
      `<tg-emoji emoji-id="4958689671950369798">🔗</tg-emoji> <a href="${storeLink}">Play Store / Official Site Link</a>`,
      ``,
      `<u><b>Features &amp; Mod Info:</b></u> <tg-emoji emoji-id="4956606007221421405">❤️‍🔥</tg-emoji>`,
      formattedModFeatures,
      ``,
      `<tg-emoji emoji-id="4958534696645428119">‼️</tg-emoji> <i>Clean &amp; 100% Virus-Free APK (Verified &amp; Safe to Install)</i>`,
      ``,
      `<tg-emoji emoji-id="4958714479681471536">⭐️</tg-emoji> <b>Join Channel ➔</b> ${channelId}`,
    ].join("\n");

    const previewMessageText = [
      `📋 <b>CHANNEL BROADCAST DRAFT PREVIEW</b>`,
      `<i>Review how this post will look before sending to <b>${channelId}</b>:</i>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      postDraft,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔘 <b>Post Buttons to be Attached:</b>`,
      `1. ⚡ DOWNLOAD NOW (Instant VIP)`,
      `2. 🌐 DOWNLOAD NOW (Website)`,
      ``,
      `🏷️ <b>Version Code:</b> <code>${versionCode}</code> | 📦 <b>Size:</b> ${fileSize}`,
      `📌 <b>Website Status:</b> <code>${app.status === "draft" ? "📁 DRAFT (Unpublished)" : "🌐 PUBLISHED (Live)"}</code>`,
    ].join("\n");

    const isDraft = app.status === "draft";
    const websiteActionButton = isDraft
      ? { text: "🌐 Publish on Website", callback_data: `wiz_pubsite:${app.id}` }
      : { text: "📁 Save as Draft", callback_data: `wiz_draft:${app.id}` };

    const adminButtons = [
      [
        {
          text: "🚀 Approve & Broadcast Now",
          callback_data: `wiz_approve:${app.id}`,
        },
        {
          text: "⏰ Schedule Post",
          callback_data: `wiz_sched:${app.id}`,
        },
      ],
      [
        websiteActionButton,
        {
          text: isDraft ? "👀 Preview on Website" : "🌐 View Live App",
          url: appUrl,
        },
      ],
      [
        {
          text: "🔢 Edit Version Code",
          callback_data: `wiz_code:${app.id}`,
        },
        {
          text: "📦 Edit App Size",
          callback_data: `wiz_size:${app.id}`,
        },
      ],
      [
        {
          text: "🖼️ Change Logo Photo",
          callback_data: `wiz_logo:${app.id}`,
        },
        {
          text: "📝 Edit Mod Features",
          callback_data: `wiz_feat:${app.id}`,
        },
      ],
    ];

    let photoUrl = app.icon_url;
    if (photoUrl && photoUrl.startsWith("/")) {
      photoUrl = `${siteUrl}${photoUrl}`;
    }

    let sent = false;
    if (
      photoUrl &&
      (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) &&
      !photoUrl.includes("default-app.png")
    ) {
      try {
        const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminChatId,
            photo: photoUrl,
            caption: previewMessageText.slice(0, 1024),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: adminButtons },
          }),
        });
        const photoData = await photoRes.json();
        sent = photoData.ok;
      } catch (err) {
        console.warn("Draft preview photo failed:", err);
      }
    }

    if (!sent) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: previewMessageText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: adminButtons },
        }),
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error("sendDraftPreviewToAdmin error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcasts directly using an authenticated Telegram User session (MTProto via GramJS)
 * This allows a Telegram Premium user account to publish posts with 100% native animated emojis.
 */
export async function broadcastViaUserbot(
  settings: any,
  channelId: string,
  caption: string,
  photoUrl?: string,
  downloadLinks?: { vipUrl: string; devUploadsUrl?: string; websiteUrl: string }
): Promise<TelegramBroadcastResult> {
  const apiId = parseInt(settings.telegramUserApiId || "", 10);
  const apiHash = settings.telegramUserApiHash || "";
  const sessionString = settings.telegramUserSessionString || "";

  if (!apiId || !apiHash || !sessionString) {
    return {
      success: false,
      error: "Telegram Userbot API ID, API Hash, or Session String not configured in Admin Settings.",
    };
  }

  try {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");

    const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
      connectionRetries: 3,
      useWSS: false,
    });

    await client.connect();

    // In Userbot mode, append download links as clean text hyperlinks since normal user messages cannot hold inline buttons
    let fullMessage = caption;
    if (downloadLinks) {
      fullMessage += "\n\n<b>DOWNLOAD NOW:</b>\n";
      fullMessage += `⚡ <a href="${downloadLinks.vipUrl}">Instant VIP Direct Download</a>\n`;
      fullMessage += `🌐 <a href="${downloadLinks.websiteUrl}">Website Download</a>`;
    }

    let targetPeer: any = channelId;
    if (targetPeer.startsWith("@")) {
      targetPeer = targetPeer.slice(1);
    }

    let res: any;
    if (photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
      res = await client.sendMessage(targetPeer, {
        message: fullMessage,
        file: photoUrl,
        parseMode: "html",
      });
    } else {
      res = await client.sendMessage(targetPeer, {
        message: fullMessage,
        parseMode: "html",
      });
    }

    await client.disconnect();

    return {
      success: true,
      message: `Successfully posted via Telegram Premium Userbot with animated emojis to ${channelId}`,
      messageId: res?.id,
    };
  } catch (err: any) {
    console.error("broadcastViaUserbot error:", err);
    return {
      success: false,
      error: err.message || "Failed to broadcast via Telegram Userbot",
    };
  }
}
