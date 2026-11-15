import { NextResponse } from "next/server";
import { getSiteSettings, getApplicationBySlug, getApplicationById } from "@/lib/db";
import { isUserVip, recordUserInteraction, activateUserVip } from "@/lib/telegram-vip";
import { broadcastToTelegram } from "@/lib/telegram-broadcast";
import {
  parseApkReleaseInfo,
  matchApplicationByApk,
  executeAutoApkRelease,
} from "@/lib/telegram-auto-release";

export async function POST(req: Request) {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = settings.telegramAdminChatId
      ? parseInt(settings.telegramAdminChatId, 10)
      : 1343548529;
    const vipPrice = settings.telegramVipPrice || 20;

    if (!token) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 400 });
    }

    const body = await req.json();

    // ==========================================
    // 1. Handle Callback Queries
    // ==========================================
    if (body.callback_query) {
      const cq = body.callback_query;
      const data = cq.data || "";
      const fromId = cq.from?.id;

      // Ensure only Admin can trigger admin callback actions
      if (fromId === adminChatId) {
        const isColon = data.includes(":");
        const [action, ...rest] = isColon ? data.split(":") : data.split("_");

        // Action: VIP Approve / Reject
        if (action === "approve" || action === "reject") {
          const targetUserId = parseInt(rest[0], 10);

          if (action === "approve") {
            await activateUserVip(targetUserId, 30);

            await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message?.message_id,
                caption: `${cq.message?.caption || ""}\n\n✅ <b>APPROVED BY ADMIN!</b> User VIP active for 30 days.`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: targetUserId,
                text: (
                  `🎉 <b>Payment Verified! Your VIP Pass is now ACTIVE for 30 Days!</b>\n\n` +
                  `⚡ You now have unlimited direct APK downloads with zero ads.\n` +
                  `Whenever you download from <a href="https://www.awtmods.in">AWTMods.in</a>, tap the VIP button to get direct files instantly!`
                ),
                parse_mode: "HTML",
                disable_web_page_preview: false,
              }),
            }).catch(() => {});
          } else if (action === "reject") {
            await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message?.message_id,
                caption: `${cq.message?.caption || ""}\n\n❌ <b>REJECTED BY ADMIN.</b>`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: targetUserId,
                text: `❌ <b>Payment verification was not approved.</b>\nPlease ensure you sent the correct ₹${vipPrice} screenshot, or contact admin @AadithCV for help.`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }

        // Action: Broadcast to Channel
        if (action === "broadcast") {
          const appId = rest.join("_");
          const app = await getApplicationById(appId);
          if (app) {
            await broadcastToTelegram({ app }).catch((err) =>
              console.warn("Broadcast callback err:", err)
            );

            await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message?.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "✅ Broadcast Sent to Channel!", callback_data: "none" },
                      {
                        text: "🌐 View on Website",
                        url: `${settings.siteUrl || "https://www.awtmods.in"}/apps/${app.slug}.html`,
                      },
                    ],
                  ],
                },
              }),
            }).catch(() => {});
          }
        }

        // Action: Auto-Create New App
        if (action === "newapp" || action === "create") {
          const rawName = rest[0] || "New App";
          const versionName = rest[1] || "v1";
          const versionCode = parseInt(rest[2], 10) || 0;

          const { executeAutoCreateApp } = await import("@/lib/telegram-auto-release");
          const createResult = await executeAutoCreateApp({
            rawName,
            versionName,
            versionCode,
            fileSize: "50 MB",
          });

          if (createResult.success && createResult.app) {
            const app = createResult.app;
            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const appUrl = `${siteUrl}/apps/${app.slug}.html`;

            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message?.message_id,
                text: (
                  `🎉 <b>${app.name} Created &amp; Published to Website!</b>\n\n` +
                  `🏷️ <b>Version:</b> <code>${versionName}</code> (Version Code: <code>${app.latest_version?.version_code || 1}</code>)\n` +
                  `🌐 <b>Live on:</b> <a href="${appUrl}">${app.name} on AWTMods.in</a>\n` +
                  `⚡ Website cache cleared instantly!`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "🚀 Broadcast to Channel", callback_data: `broadcast_${app.id}` },
                      { text: "🌐 View on Website", url: appUrl },
                    ],
                  ],
                },
              }),
            }).catch(() => {});
          }
        }

        // Action: Pick Existing App Disambiguation
        if (action === "pick") {
          const appId = rest[0];
          const versionName = rest[1] || "v1";
          const versionCode = parseInt(rest[2], 10) || 0;

          const app = await getApplicationById(appId);
          if (app) {
            const releaseRes = await executeAutoApkRelease({
              appId,
              versionName,
              versionCode,
              fileSize: "50 MB",
            });

            if (releaseRes.success) {
              const siteUrl = settings.siteUrl || "https://www.awtmods.in";
              const appUrl = `${siteUrl}/apps/${app.slug}.html`;

              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message?.message_id,
                  text: (
                    `✅ <b>${app.name} Auto-Updated to ${versionName}!</b>\n\n` +
                    `🏷️ <b>Version Code:</b> <code>${releaseRes.app?.latest_version?.version_code || 1}</code>\n` +
                    `🌐 <b>Live on:</b> <a href="${appUrl}">${app.name}</a> (Cache Cleared!)`
                  ),
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "🚀 Broadcast to Channel", callback_data: `broadcast_${app.id}` },
                        {
                          text: "🌐 View on Website",
                          url: appUrl,
                        },
                      ],
                    ],
                  },
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // Stop Telegram spinner
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id }),
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    // ==========================================
    // 2. Handle Messages & Channel Posts
    // ==========================================
    const message =
      body.message ||
      body.channel_post ||
      body.edited_message ||
      body.edited_channel_post;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const isChannel = message.chat.type === "channel";
    const user = message.from;
    const text = (message.text || "").trim();
    const caption = (message.caption || message.text || "").trim();
    const photo = message.photo;
    const doc = message.document;

    // Security check: is the message from Admin or Admin's private storage channel?
    const isAuthorized =
      user?.id === adminChatId ||
      chatId === adminChatId ||
      isChannel ||
      String(chatId) === String(settings.telegramPrivateChannelId) ||
      String(chatId) === String(settings.telegramChannelId);

    // ==========================================================
    // 3. AUTOMATIC APK RELEASE & FORWARD DETECTOR (NO MANUAL ADMIN)
    // ==========================================================
    const hasApkDoc =
      doc &&
      (doc.file_name?.toLowerCase().endsWith(".apk") ||
        doc.mime_type?.includes("android") ||
        doc.file_name?.toLowerCase().includes(".apk"));

    const hasApkText =
      caption.toLowerCase().includes(".apk") &&
      (caption.includes("http://") || caption.includes("https://"));

    if (isAuthorized && (hasApkDoc || hasApkText)) {
      const rawFileName =
        doc?.file_name ||
        caption.match(/([a-zA-Z0-9_\-\.]+\.apk)/i)?.[1] ||
        "app.apk";
      const fileSizeBytes = doc?.file_size || 0;
      const parsed = parseApkReleaseInfo(rawFileName, caption, fileSizeBytes);

      // Derive Telegram message link for direct VIP downloads
      let telegramMessageLink = "";
      const privateChannelId =
        settings.telegramPrivateChannelId || "-1004449242945";

      if (isChannel) {
        const cleanChan = String(chatId).replace(/^-100/, "").replace(/^-/, "");
        telegramMessageLink = `https://t.me/c/${cleanChan}/${message.message_id}`;
      } else if (hasApkDoc && !isChannel) {
        // Automatically copy file into private storage channel so VIP users can fetch it
        try {
          const copyRes = await fetch(
            `https://api.telegram.org/bot${token}/copyMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: privateChannelId,
                from_chat_id: chatId,
                message_id: message.message_id,
              }),
            }
          );
          const copyData = await copyRes.json();
          if (copyData.ok && copyData.result?.message_id) {
            const cleanChan = String(privateChannelId)
              .replace(/^-100/, "")
              .replace(/^-/, "");
            telegramMessageLink = `https://t.me/c/${cleanChan}/${copyData.result.message_id}`;
          }
        } catch (copyErr) {
          console.warn("Auto copyMessage to storage channel error:", copyErr);
        }
      }

      // Match the application in Supabase
      const { matchedApp, candidates } = await matchApplicationByApk(
        rawFileName,
        caption
      );

      const replyChatId = isChannel ? adminChatId : chatId;

      if (matchedApp) {
        // Execute the automated release
        const releaseRes = await executeAutoApkRelease({
          appId: matchedApp.id,
          versionName: parsed.versionName,
          versionCode: parsed.versionCode,
          fileSize: parsed.fileSize,
          releaseNotes: parsed.releaseNotes,
          externalUrls: parsed.externalUrls,
          telegramMessageLink,
        });

        if (releaseRes.success) {
          const siteUrl = settings.siteUrl || "https://www.awtmods.in";
          const appUrl = `${siteUrl}/apps/${matchedApp.slug}.html`;

          const mirrorsList = parsed.externalUrls.map(
            (u) =>
              `• <b>${u.mirrorName}:</b> <a href="${u.url}">${u.url.slice(0, 32)}...</a>`
          );
          if (telegramMessageLink) {
            mirrorsList.push(
              `• <b>Telegram VIP Direct:</b> Linked (Msg #${message.message_id})`
            );
          }

          const successText = [
            `🎉 <b>${matchedApp.name} Auto-Updated to ${parsed.versionName}!</b>`,
            ``,
            `📱 <b>App:</b> <a href="${appUrl}">${matchedApp.name}</a>`,
            `🏷️ <b>Version:</b> <code>${parsed.versionName}</code> (Version Code: <code>${releaseRes.app?.latest_version?.version_code || parsed.versionCode}</code>)`,
            `📦 <b>File Size:</b> ${parsed.fileSize}`,
            `🌐 <b>Website Status:</b> Live on AWTMods.in (Cache Instantly Cleared)`,
            ``,
            `🔗 <b>Download Mirrors Linked:</b>`,
            mirrorsList.join("\n") || "• Default Telegram Mirror",
            ``,
            `<i>Tap below to broadcast this update directly to @${settings.telegramChannelId?.replace(/^@/, "") || "awtmods"}!</i>`,
          ].join("\n");

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: replyChatId,
              text: successText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🚀 Broadcast to Channel",
                      callback_data: `broadcast_${matchedApp.id}`,
                    },
                    {
                      text: "🌐 View on Website",
                      url: appUrl,
                    },
                  ],
                ],
              },
            }),
          });

          return NextResponse.json({
            ok: true,
            released: true,
            app: matchedApp.name,
          });
        }
      } else if (candidates.length > 0) {
        // Clean candidate name (strip _v1, -v1.0 from app name)
        const cleanAppName =
          rawFileName
            .replace(/\.apk$/i, "")
            .replace(/[-_.]v[0-9]+.*$/i, "")
            .replace(/[-_.][0-9]+(?:\.[0-9]+)+.*$/i, "")
            .replace(/[-_.]+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .trim() || rawFileName.replace(/\.apk$/i, "");

        // Send disambiguation buttons to Admin
        const candidateButtons: any[][] = candidates.slice(0, 4).map((c) => [
          {
            text: `📱 Link to: ${c.name}`,
            callback_data: `pick:${c.id}:${parsed.versionName}:${parsed.versionCode || 0}`,
          },
        ]);

        candidateButtons.push([
          {
            text: `➕ Auto-Create "${cleanAppName}" on Website`,
            callback_data: `create:${cleanAppName.replace(/\s+/g, "-")}:${parsed.versionName}:${parsed.versionCode || 0}`,
          },
        ]);

        const codeInfo =
          parsed.versionCode > 0
            ? `(Code: <code>${parsed.versionCode}</code>)`
            : `<i>(Code: Auto Next / Ask Admin)</i>`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: replyChatId,
            text: (
              `❓ <b>Which application should this update be linked to?</b>\n\n` +
              `📁 <b>File:</b> <code>${rawFileName}</code>\n` +
              `🏷️ <b>Version:</b> <code>${parsed.versionName}</code> ${codeInfo}\n` +
              `📦 <b>Size:</b> ${parsed.fileSize}\n\n` +
              `Found ${candidates.length} matching candidate(s):`
            ),
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: candidateButtons },
          }),
        });

        return NextResponse.json({ ok: true, pendingPick: true });
      } else {
        const cleanAppName =
          rawFileName
            .replace(/\.apk$/i, "")
            .replace(/[-_.]v[0-9]+.*$/i, "")
            .replace(/[-_.][0-9]+(?:\.[0-9]+)+.*$/i, "")
            .replace(/[-_.]+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .trim() || rawFileName.replace(/\.apk$/i, "");

        const codeInfo =
          parsed.versionCode > 0
            ? `(Code: <code>${parsed.versionCode}</code>)`
            : `<i>(Code: Initial v1)</i>`;

        // No candidates found in database -> prompt to auto-create
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: replyChatId,
            text: (
              `⚠️ <b>App Not Found in Catalog</b>\n\n` +
              `📁 <b>File:</b> <code>${rawFileName}</code>\n` +
              `🏷️ <b>Version:</b> <code>${parsed.versionName}</code> ${codeInfo}\n` +
              `📦 <b>Size:</b> ${parsed.fileSize}\n\n` +
              `No existing app matches "<b>${cleanAppName}</b>" in the catalog.\n\n` +
              `Would you like to automatically create it as a new app?`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `➕ Auto-Create "${cleanAppName}" on Website`,
                    callback_data: `create:${cleanAppName.replace(/\s+/g, "-")}:${parsed.versionName}:${parsed.versionCode || 0}`,
                  },
                ],
              ],
            },
          }),
        });

        return NextResponse.json({ ok: true, notFound: true });
      }
    }

    // Check if user sent custom animated emojis to inspect their IDs
    if (message.entities && Array.isArray(message.entities)) {
      const customEmojiEntities = message.entities.filter(
        (e: any) => e.type === "custom_emoji" && e.custom_emoji_id
      );
      if (customEmojiEntities.length > 0 && !text.startsWith("/start")) {
        const detectedList = customEmojiEntities.map((e: any, index: number) => {
          const emojiChar = text.slice(e.offset, e.offset + e.length) || "✨";
          return `${index + 1}. ${emojiChar} ID: <code>${e.custom_emoji_id}</code>\n   Tag: <code>&lt;tg-emoji emoji-id="${e.custom_emoji_id}"&gt;${emojiChar}&lt;/tg-emoji&gt;</code>`;
        });

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `✨ <b>Custom Animated Emojis Extracted!</b>\n\n` +
              `Found ${customEmojiEntities.length} animated emoji(s):\n\n` +
              detectedList.join("\n\n") +
              `\n\n<i>You can copy these tags and paste them directly into your channel post templates in /admin/bot!</i>`
            ),
            parse_mode: "HTML",
          }),
        });
        return NextResponse.json({ ok: true });
      }
    }

    // Check if user is asking for /start
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const rawArg = parts[1] || "";
      const targetApp = rawArg.startsWith("dl_") ? rawArg.replace("dl_", "") : null;

      if (user) {
        await recordUserInteraction(user.id, {
          username: user.username,
          fullName: [user.first_name, user.last_name].filter(Boolean).join(" "),
          pendingApp: targetApp,
        });
      }

      const vipStatus = user ? await isUserVip(user.id) : { isVip: false };

      if (vipStatus.isVip) {
        if (!targetApp) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: (
                `👑 <b>Welcome Back, VIP Member!</b>\n\n` +
                `✨ Your VIP pass is active until: <code>${vipStatus.expiresAt?.slice(0, 10)}</code>\n\n` +
                `Browse our 95+ apps on <a href="https://www.awtmods.in">AWTMods.in</a> and tap "Get Direct File" on any app to receive it instantly here!`
              ),
              parse_mode: "HTML",
            }),
          });
          return NextResponse.json({ ok: true });
        }

        // Look up the exact app in the database
        const app = await getApplicationBySlug(targetApp);
        if (!app) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: (
                `❌ <b>File Not Found</b>\n\n` +
                `Sorry, we could not find an application matching "<b>${targetApp}</b>" in the AWTMods catalog.\n\n` +
                `🔍 Browse all available apps at <a href="https://www.awtmods.in">AWTMods.in</a> or submit a request on our Mod Board!`
              ),
              parse_mode: "HTML",
            }),
          });
          return NextResponse.json({ ok: true });
        }

        const version = app.latest_version || app.versions?.[0];
        const tgSource = version?.download_sources?.find(
          (s) => s.hosting_provider === "telegram" || s.download_url?.includes("t.me")
        );

        if (tgSource?.download_url) {
          const match = tgSource.download_url.match(/\/([0-9]+)$/);
          const messageId = match ? parseInt(match[1], 10) : null;
          const privateChannel = settings.telegramPrivateChannelId || settings.telegramChannelId;

          let copied = false;
          if (messageId && privateChannel) {
            try {
              const copyRes = await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  from_chat_id: privateChannel,
                  message_id: messageId,
                }),
              });
              const copyJson = await copyRes.json();
              copied = copyJson.ok;
            } catch (err) {
              console.warn("copyMessage err:", err);
            }
          }

          if (!copied) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: (
                  `⚡ <b>VIP Direct Download</b>\n\n` +
                  `📦 <b>App:</b> ${app.name}\n` +
                  `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n\n` +
                  `🔗 <a href="${tgSource.download_url}">Tap here to download directly from Telegram</a>`
                ),
                parse_mode: "HTML",
              }),
            });
          }
          return NextResponse.json({ ok: true });
        }

        // If app is in database, but direct Telegram file is not uploaded yet
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `⚠️ <b>Direct Telegram File Pending Upload</b>\n\n` +
              `The direct APK package for <b>${app.name} (${version?.version_name || "Latest"})</b> is currently being prepared and will be uploaded to Telegram shortly!\n\n` +
              `🌐 In the meantime, you can download it via the website mirror:\n` +
              `🔗 <a href="https://www.awtmods.in/apps/${app.slug}.html">Download ${app.name} on AWTMods.in</a>\n\n` +
              `💬 You can also message Admin @AadithCV for priority file delivery!`
            ),
            parse_mode: "HTML",
          }),
        });
        return NextResponse.json({ ok: true });
      }

      // If NOT VIP: Send Payment instructions with Auto-Generated UPI QR Code
      const appText = targetApp ? ` for <b>${targetApp.toUpperCase()}</b>` : "";
      const upiId = settings.telegramUpiId || "awtmods@upi";
      const upiName = settings.telegramUpiName || "AWTMods VIP";
      const upiNote = targetApp ? `VIP-${targetApp.slice(0, 15)}` : "AWTMods VIP";

      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${vipPrice}&cu=INR&tn=${encodeURIComponent(upiNote)}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(upiUri)}`;

      const paymentMsg = (
        `⚡ <b>AWTMods Direct File VIP Pass</b>\n\n` +
        `Get instant, ad-free direct APK downloads${appText} delivered straight to your chat at full 5G speed!\n\n` +
        `✨ <b>VIP BENEFITS:</b>\n` +
        `• 🚫 Zero Ads &amp; Zero Link Shorteners\n` +
        `• ⚡ Instant direct 1-tap APK installation\n` +
        `• 📦 Unlimited access across all 95+ apps for 30 days\n` +
        `• 🛡️ Direct Admin verification &amp; fast support\n\n` +
        `💰 <b>Price:</b> ₹${vipPrice} / 30 Days\n` +
        `📱 <b>Payee UPI ID:</b> <code>${upiId}</code>\n` +
        `👤 <b>Name:</b> ${upiName}\n\n` +
        `📲 <b>Scan the QR Code above</b> with GPay, PhonePe, or Paytm.\n` +
        `📸 <i>After paying, reply with your <b>Payment Screenshot</b> or UTR reference number right here!</i>`
      );

      // Try sending with QR Photo first
      let sentPhoto = false;
      try {
        const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: qrCodeUrl,
            caption: paymentMsg,
            parse_mode: "HTML",
          }),
        });
        const photoJson = await photoRes.json();
        sentPhoto = photoJson.ok;
      } catch (err) {
        console.warn("sendPhoto QR failed:", err);
      }

      // Fallback to text message if photo delivery failed
      if (!sentPhoto) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: paymentMsg,
            parse_mode: "HTML",
          }),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // 4. Handle Payment Screenshot Submission
    if (photo && photo.length > 0) {
      const bestPhoto = photo[photo.length - 1];
      const captionText = (message.caption || "").trim();

      if (user) {
        await recordUserInteraction(user.id, {
          username: user.username,
          fullName: [user.first_name, user.last_name].filter(Boolean).join(" "),
        });
      }

      const adminNotification = (
        `💳 <b>NEW VIP PAYMENT SUBMISSION!</b>\n\n` +
        `👤 <b>User:</b> ${user?.first_name || "Anonymous"} (@${user?.username || "no_username"})\n` +
        `🆔 <b>User ID:</b> <code>${user?.id}</code>\n` +
        `📝 <b>Caption/UTR:</b> ${captionText || "None"}\n\n` +
        `💰 Amount expected: ₹${vipPrice}\n\n` +
        `<i>Verify the screenshot above and tap Approve to activate 30-day VIP pass immediately.</i>`
      );

      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          photo: bestPhoto.file_id,
          caption: adminNotification,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Approve VIP (30 Days)", callback_data: `approve_${user?.id}` },
                { text: "❌ Reject", callback_data: `reject_${user?.id}` },
              ],
            ],
          },
        }),
      });

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: (
            `📸 <b>Payment Screenshot Received!</b>\n\n` +
            `Your payment has been sent to Admin for fast verification.\n` +
            `You will receive an instant confirmation message as soon as it's verified (usually within 5-15 minutes).`
          ),
          parse_mode: "HTML",
        }),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
