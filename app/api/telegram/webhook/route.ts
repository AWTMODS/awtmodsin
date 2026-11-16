import { NextResponse } from "next/server";
import { getSiteSettings, getApplicationBySlug, getApplicationById, getDbClient, invalidateDbCache } from "@/lib/db";
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
        if (action === "broadcast" || action === "wiz_approve") {
          const appId = rest[0] || rest.join("_");
          const app = await getApplicationById(appId);
          if (app) {
            const bRes = await broadcastToTelegram({ app, force: true }).catch((err) =>
              console.warn("Broadcast callback err:", err)
            );

            const channelId = settings.telegramChannelId || "@awtmods";
            const channelClean = channelId.replace(/^@/, "");
            const postLink = bRes?.messageId
              ? `https://t.me/${channelClean}/${bRes.messageId}`
              : `https://t.me/${channelClean}`;

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `🎉 <b>POST APPROVED &amp; BROADCAST LIVE!</b>\n\n` +
                  `📱 <b>App:</b> ${app.name}\n` +
                  `📢 <b>Channel:</b> ${channelId}\n\n` +
                  `✅ <i>The post with your custom animated emojis, logo, and DevUploads mirror is live!</i>`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "📢 View Post on Telegram", url: postLink },
                      {
                        text: "🌐 View Live App",
                        url: `${settings.siteUrl || "https://www.awtmods.in"}/apps/${app.slug}.html`,
                      },
                    ],
                  ],
                },
              }),
            }).catch(() => {});
          }
        }

        // Action: Wizard Edit Version Code Prompt
        if (action === "wiz_code") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_version_code", appId, appName: app.name },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `🔢 <b>Edit Version Code for ${app.name}</b>\n\n` +
                  `Current Version Code: <code>${app.latest_version?.version_code || 1}</code>\n\n` +
                  `Please reply with the new Version Code integer (e.g. <code>18</code> or <code>105</code>):`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }

        // Action: Wizard Edit Logo Prompt
        if (action === "wiz_logo") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_logo", appId, appName: app.name },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `🖼️ <b>Upload New App Logo for ${app.name}</b>\n\n` +
                  `Please send or forward any square image/photo right here to set as the official logo:`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }

        // Action: Wizard Edit Mod Features Prompt
        if (action === "wiz_feat") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_features", appId, appName: app.name },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `📝 <b>Edit Mod Features for ${app.name}</b>\n\n` +
                  `Reply with your custom features (one per line, e.g.):\n\n` +
                  `<code>• Premium VIP Unlocked\n• Audio and visual ads blocked\n• Background playback support\n• Unlimited shuffle unlocked</code>`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }

        // Action: Auto-Create New App
        if (action === "newapp" || action === "create") {
          const { executeAutoCreateApp, getPendingApkRelease } = await import("@/lib/telegram-auto-release");
          const pending = await getPendingApkRelease(rest[0]);

          const rawName = pending?.cleanAppName || pending?.rawFileName || rest[0] || "New App";
          const versionName = pending?.versionName || rest[1] || "v1";
          const versionCode = pending?.versionCode || parseInt(rest[2], 10) || 0;
          const fileSize = pending?.fileSize || "50 MB";
          const externalUrls = pending?.externalUrls || [];
          const telegramMessageLink = pending?.telegramMessageLink || undefined;
          const fileId = pending?.fileId || undefined;
          const releaseNotes = pending?.releaseNotes || undefined;

          const createResult = await executeAutoCreateApp({
            rawName,
            versionName,
            versionCode,
            fileSize,
            externalUrls,
            telegramMessageLink,
            fileId,
            releaseNotes,
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
                  `📦 <b>Size:</b> ${fileSize}\n` +
                  `🌐 <b>Live on:</b> <a href="${appUrl}">${app.name} on AWTMods.in</a>\n` +
                  `⚡ Generating Channel Draft Preview below...`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            // Send Interactive Draft Preview with 1-Tap Approve button
            const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
            await sendDraftPreviewToAdmin(app, adminChatId).catch(() => {});
          }
        }

        // Action: Clone Template from Existing App
        if (action === "clone") {
          const { executeCloneApplication, getPendingApkRelease } = await import("@/lib/telegram-auto-release");
          const pending = await getPendingApkRelease(rest[0]);

          const sourceAppId = pending ? rest[1] : rest[0];
          const rawName = pending?.cleanAppName || pending?.rawFileName || rest[1] || "New App";
          const versionName = pending?.versionName || rest[2] || "v1";
          const versionCode = pending?.versionCode || parseInt(rest[3], 10) || 0;
          const fileSize = pending?.fileSize || "50 MB";
          const externalUrls = pending?.externalUrls || [];
          const telegramMessageLink = pending?.telegramMessageLink || undefined;
          const fileId = pending?.fileId || undefined;
          const releaseNotes = pending?.releaseNotes || undefined;

          const cloneResult = await executeCloneApplication({
            sourceAppId,
            rawName,
            versionName,
            versionCode,
            fileSize,
            externalUrls,
            telegramMessageLink,
            fileId,
            releaseNotes,
          });

          if (cloneResult.success && cloneResult.app) {
            const app = cloneResult.app;
            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const appUrl = `${siteUrl}/apps/${app.slug}.html`;

            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message?.message_id,
                text: (
                  `🎉 <b>${app.name} Cloned &amp; Published to Website!</b>\n\n` +
                  `🏷️ <b>Version:</b> <code>${versionName}</code> (Version Code: <code>${app.latest_version?.version_code || 1}</code>)\n` +
                  `📦 <b>Size:</b> ${fileSize}\n` +
                  `🎨 <b>Features &amp; Logo:</b> Inherited from template\n` +
                  `🌐 <b>Live at:</b> <a href="${appUrl}">${app.name} on AWTMods.in</a>\n` +
                  `⚡ Generating Channel Draft Preview below...`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            // Send Interactive Draft Preview with 1-Tap Approve button
            const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
            await sendDraftPreviewToAdmin(app, adminChatId).catch(() => {});
          }
        }

        // Action: Pick Existing App Disambiguation
        if (action === "pick") {
          const { executeAutoApkRelease, getPendingApkRelease } = await import("@/lib/telegram-auto-release");
          const pending = await getPendingApkRelease(rest[0]);

          const appId = pending ? rest[1] : rest[0];
          const versionName = pending?.versionName || rest[1] || "v1";
          const versionCode = pending?.versionCode || parseInt(rest[2], 10) || 0;
          const fileSize = pending?.fileSize || "50 MB";
          const externalUrls = pending?.externalUrls || [];
          const telegramMessageLink = pending?.telegramMessageLink || undefined;
          const fileId = pending?.fileId || undefined;
          const releaseNotes = pending?.releaseNotes || undefined;

          const app = await getApplicationById(appId);
          if (app) {
            const releaseRes = await executeAutoApkRelease({
              appId,
              versionName,
              versionCode,
              fileSize,
              externalUrls,
              telegramMessageLink,
              fileId,
              releaseNotes,
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
                    `📦 <b>Size:</b> ${fileSize}\n` +
                    `🌐 <b>Live on:</b> <a href="${appUrl}">${app.name}</a> (Cache Cleared!)\n` +
                    `⚡ Generating Channel Draft Preview below...`
                  ),
                  parse_mode: "HTML",
                }),
              }).catch(() => {});

              // Send Interactive Draft Preview with 1-Tap Approve button
              const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
              await sendDraftPreviewToAdmin(releaseRes.app || app, adminChatId).catch(() => {});
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
    // 2.5 INTERACTIVE ADMIN WIZARD INPUT HANDLER
    // ==========================================================
    const supabase = getDbClient();
    if (supabase && (chatId === adminChatId || user?.id === adminChatId) && !doc) {
      const { data: wizData } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", `admin_wizard_${adminChatId}`)
        .maybeSingle();

      const wiz = wizData?.setting_value;
      if (wiz && wiz.appId && wiz.step) {
        // Step 1: Version Code input
        if (wiz.step === "waiting_for_version_code" && text) {
          const newCode = parseInt(text.replace(/[^0-9]/g, ""), 10);
          if (newCode > 0) {
            const app = await getApplicationById(wiz.appId);
            const ver = app?.latest_version || app?.versions?.[0];
            if (ver?.id) {
              await supabase
                .from("application_versions")
                .update({ version_code: newCode })
                .eq("id", ver.id);
              await supabase
                .from("site_settings")
                .delete()
                .eq("setting_key", `admin_wizard_${adminChatId}`);
              invalidateDbCache();
              const updatedApp = await getApplicationById(wiz.appId);
              if (updatedApp) {
                const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: `✅ <b>Version Code updated to <code>${newCode}</code>!</b>\nHere is your updated Channel Broadcast Preview:`,
                    parse_mode: "HTML",
                  }),
                });
                await sendDraftPreviewToAdmin(updatedApp, adminChatId);
                return NextResponse.json({ ok: true, wizardUpdated: "version_code" });
              }
            }
          }
        }

        // Step 2: Logo photo input
        if (wiz.step === "waiting_for_logo" && photo && photo.length > 0) {
          const bestPhoto = photo[photo.length - 1];
          const fileRes = await fetch(
            `https://api.telegram.org/bot${token}/getFile?file_id=${bestPhoto.file_id}`
          );
          const fileJson = await fileRes.json();
          if (fileJson.ok && fileJson.result?.file_path) {
            const newLogoUrl = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
            await supabase
              .from("applications")
              .update({ icon_url: newLogoUrl })
              .eq("id", wiz.appId);
            await supabase
              .from("site_settings")
              .delete()
              .eq("setting_key", `admin_wizard_${adminChatId}`);
            invalidateDbCache();
            const updatedApp = await getApplicationById(wiz.appId);
            if (updatedApp) {
              const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  text: `✅ <b>Official App Logo Updated!</b>\nHere is your updated Channel Broadcast Preview:`,
                  parse_mode: "HTML",
                }),
              });
              await sendDraftPreviewToAdmin(updatedApp, adminChatId);
              return NextResponse.json({ ok: true, wizardUpdated: "logo" });
            }
          }
        }

        // Step 3: Mod Features input
        if (wiz.step === "waiting_for_features" && text) {
          const rawLines = text
            .split("\n")
            .map((s: string) => s.trim().replace(/^[-•*🟢✅]\s*/, ""))
            .filter((s: string) => s.length > 1);
          if (rawLines.length > 0) {
            await supabase
              .from("applications")
              .update({ mod_features: rawLines })
              .eq("id", wiz.appId);
            await supabase
              .from("site_settings")
              .delete()
              .eq("setting_key", `admin_wizard_${adminChatId}`);
            invalidateDbCache();
            const updatedApp = await getApplicationById(wiz.appId);
            if (updatedApp) {
              const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  text: `✅ <b>Mod Features Updated! (${rawLines.length} features)</b>\nHere is your updated Channel Broadcast Preview:`,
                  parse_mode: "HTML",
                }),
              });
              await sendDraftPreviewToAdmin(updatedApp, adminChatId);
              return NextResponse.json({ ok: true, wizardUpdated: "features" });
            }
          }
        }
      }
    }

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

    // ==========================================================
    // 2.8 GOOGLE PLAY STORE LINK AUTO-POST GENERATOR
    // ==========================================================
    const playStoreMatch = (text || caption || "").match(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/i);
    if (isAuthorized && playStoreMatch && !hasApkDoc) {
      const { scrapeAndCreateFromPlayStore } = await import("@/lib/playstore-auto-poster");
      const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");

      // Notify admin immediately that scraping has started
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔍 <b>Google Play link detected!</b>\n<i>Scraping official icon, title, genre, and generating mod post...</i>`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});

      const result = await scrapeAndCreateFromPlayStore(playStoreMatch[0]);

      if (result.success && result.app) {
        // Send draft preview to admin
        await sendDraftPreviewToAdmin(result.app, adminChatId);
        return NextResponse.json({ ok: true, playStoreAutoCreated: result.app.name });
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ <b>Failed to fetch from Google Play Store:</b>\n<code>${result.error || "Unknown error"}</code>`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: false, error: result.error });
      }
    }

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
          fileId: doc?.file_id,
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

          // Also generate and send the visual Draft Preview with 1-tap Approve & Edit buttons
          const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
          await sendDraftPreviewToAdmin(releaseRes.app || matchedApp, adminChatId).catch((err) =>
            console.warn("Draft preview after matched release err:", err)
          );

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

        // Persist pending metadata so callback queries preserve file_id & external mirrors
        const { savePendingApkRelease } = await import("@/lib/telegram-auto-release");
        const pendingKey = await savePendingApkRelease({
          rawFileName,
          cleanAppName,
          versionName: parsed.versionName,
          versionCode: parsed.versionCode,
          fileSize: parsed.fileSize,
          fileId: doc?.file_id || null,
          telegramMessageLink: telegramMessageLink || null,
          externalUrls: parsed.externalUrls || [],
          releaseNotes: parsed.releaseNotes || "",
          sourceChatId: chatId,
          sourceMessageId: message.message_id,
        });

        // Send disambiguation buttons to Admin
        const candidateButtons: any[][] = [];
        candidates.slice(0, 3).forEach((c) => {
          candidateButtons.push([
            {
              text: `📱 Update: ${c.name}`,
              callback_data: `pick:${pendingKey}:${c.id}`,
            },
          ]);
          candidateButtons.push([
            {
              text: `📋 Clone Template from: ${c.name}`,
              callback_data: `clone:${pendingKey}:${c.id}`,
            },
          ]);
        });

        // Dedicated 1-Tap Clone from AWT Instagram if not already listed
        const hasAwtInsta = candidates.some(
          (c) => c.id === "9976c40c-b6ff-44d9-a43d-412c5cd899a4" || c.slug === "awt-instagram"
        );
        if (!hasAwtInsta) {
          candidateButtons.push([
            {
              text: `📋 1-Tap Clone from: AWT Instagram`,
              callback_data: `clone:${pendingKey}:9976c40c-b6ff-44d9-a43d-412c5cd899a4`,
            },
          ]);
        }

        candidateButtons.push([
          {
            text: `➕ Auto-Create "${cleanAppName}" on Website`,
            callback_data: `create:${pendingKey}`,
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

        const { savePendingApkRelease } = await import("@/lib/telegram-auto-release");
        const pendingKey = await savePendingApkRelease({
          rawFileName,
          cleanAppName,
          versionName: parsed.versionName,
          versionCode: parsed.versionCode,
          fileSize: parsed.fileSize,
          fileId: doc?.file_id || null,
          telegramMessageLink: telegramMessageLink || null,
          externalUrls: parsed.externalUrls || [],
          releaseNotes: parsed.releaseNotes || "",
          sourceChatId: chatId,
          sourceMessageId: message.message_id,
        });

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
                    text: `📋 1-Tap Clone from: AWT Instagram`,
                    callback_data: `clone:${pendingKey}:9976c40c-b6ff-44d9-a43d-412c5cd899a4`,
                  },
                ],
                [
                  {
                    text: `➕ Auto-Create "${cleanAppName}" on Website`,
                    callback_data: `create:${pendingKey}`,
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

        let fileSent = false;

        // 1. Send Document directly into chat via Telegram file_id (instant & guaranteed APK delivery)
        if (tgSource?.storage_key) {
          try {
            const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                document: tgSource.storage_key,
                caption: (
                  `⚡ <b>VIP Direct Download Delivered!</b>\n\n` +
                  `📦 <b>App:</b> ${app.name}\n` +
                  `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n` +
                  `📊 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
                  `👑 <i>Thank you for being an AWTMods VIP Member! Tap above to install directly to your device.</i>`
                ),
                parse_mode: "HTML",
              }),
            });
            const docJson = await docRes.json();
            fileSent = docJson.ok;
          } catch (err) {
            console.warn("sendDocument by file_id error:", err);
          }
        }

        // 2. If storage_key wasn't set or sendDocument failed, try copyMessage from storage channel
        if (!fileSent && tgSource?.download_url) {
          const cMatch = tgSource.download_url.match(/t\.me\/c\/([0-9]+)\/([0-9]+)/);
          const pubMatch = tgSource.download_url.match(/t\.me\/([a-zA-Z0-9_]+)\/([0-9]+)/);
          const privateChannel = settings.telegramPrivateChannelId || "-1004449242945";

          let fromChatId: string | number = privateChannel;
          let messageId: number | null = null;

          if (cMatch) {
            fromChatId = `-100${cMatch[1]}`;
            messageId = parseInt(cMatch[2], 10);
          } else if (pubMatch && !["c", "joinchat", "addstickers", "awtmods"].includes(pubMatch[1].toLowerCase())) {
            fromChatId = `@${pubMatch[1]}`;
            messageId = parseInt(pubMatch[2], 10);
          } else {
            const lastNumMatch = tgSource.download_url.match(/\/([0-9]+)$/);
            if (lastNumMatch) {
              messageId = parseInt(lastNumMatch[1], 10);
            }
          }

          if (messageId && fromChatId) {
            try {
              const copyRes = await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  from_chat_id: fromChatId,
                  message_id: messageId,
                  caption: (
                    `⚡ <b>VIP Direct Download Delivered!</b>\n\n` +
                    `📦 <b>App:</b> ${app.name}\n` +
                    `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n\n` +
                    `👑 <i>Thank you for being an AWTMods VIP Member! Tap above to install directly.</i>`
                  ),
                  parse_mode: "HTML",
                }),
              });
              const copyJson = await copyRes.json();
              fileSent = copyJson.ok;
            } catch (err) {
              console.warn("copyMessage err:", err);
            }
          }
        }

        if (fileSent) {
          return NextResponse.json({ ok: true, delivered: true });
        }

        // 3. If direct Telegram file is not in storage yet:
        // Provide the direct external mirror or website link — NEVER just open the general channel!
        const mirror = version?.download_sources?.find(
          (s) => s.download_url && !s.download_url.includes("t.me")
        );
        const siteUrl = settings.siteUrl || "https://www.awtmods.in";
        const fastMirrorUrl = mirror?.download_url || `${siteUrl}/download/${app.slug}`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `⚡ <b>VIP Priority Download</b>\n\n` +
              `📦 <b>App:</b> ${app.name}\n` +
              `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n` +
              `📊 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
              `⚠️ The direct Telegram file for this update is currently syncing to our VIP node.\n` +
              `🚀 In the meantime, you can download it immediately with zero wait times:\n\n` +
              `🔗 <a href="${fastMirrorUrl}"><b>Click here for Instant Download (${mirror?.mirror_name || "Fast Mirror"})</b></a>`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🚀 Open Fast Download Mirror", url: fastMirrorUrl },
                ],
              ],
            },
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

      const downloadPageUrl = targetApp
        ? `https://www.awtmods.in/download/${targetApp}`
        : "https://www.awtmods.in";

      const paymentMarkup = {
        inline_keyboard: [
          [
            {
              text: "🌐 Free Download on Website",
              url: downloadPageUrl,
            },
          ],
        ],
      };

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
            reply_markup: paymentMarkup,
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
            reply_markup: paymentMarkup,
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
