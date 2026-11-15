import { NextResponse } from "next/server";
import { getSiteSettings, getApplicationBySlug } from "@/lib/db";
import { isUserVip, recordUserInteraction, activateUserVip } from "@/lib/telegram-vip";

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

    // 1. Handle Callback Query (Admin tapped [ Approve ] or [ Reject ])
    if (body.callback_query) {
      const cq = body.callback_query;
      const data = cq.data || ""; // e.g. "approve_12345" or "reject_12345"
      const fromId = cq.from?.id;

      // Ensure only Admin can approve/reject
      if (fromId === adminChatId) {
        const [action, targetUserIdStr] = data.split("_");
        const targetUserId = parseInt(targetUserIdStr, 10);

        if (action === "approve") {
          await activateUserVip(targetUserId, 30);

          // Update Admin message
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

          // Notify User
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

      // Answer callback query so Telegram spinner stops
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cq.id }),
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    // 2. Handle Messages
    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const user = message.from;
    const text = (message.text || "").trim();
    const photo = message.photo;

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

      await recordUserInteraction(user.id, {
        username: user.username,
        fullName: [user.first_name, user.last_name].filter(Boolean).join(" "),
        pendingApp: targetApp,
      });

      const vipStatus = await isUserVip(user.id);

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
          // If message ID is present, try copyMessage
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
                  `⚡ <b>${app.name} (${version?.version_name || "Latest"})</b>\n\n` +
                  `📦 Here is your direct VIP Telegram download link:\n` +
                  `🔗 <a href="${tgSource.download_url}">${tgSource.download_url}</a>\n\n` +
                  `<i>Enjoy 100% ad-free 5G download speed!</i>`
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

    // Handle Payment Proof (User uploaded photo or sent UTR message)
    if (photo || (text && !text.startsWith("/"))) {
      const userStatus = await isUserVip(user.id);
      if (userStatus.isVip) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "✅ You are already an active VIP member! Enjoy unlimited direct downloads.",
          }),
        });
        return NextResponse.json({ ok: true });
      }

      const adminCaption = (
        `🚨 <b>NEW VIP PAYMENT SUBMISSION!</b>\n\n` +
        `👤 <b>User:</b> ${user.first_name || ""} ${user.last_name || ""} (@${user.username || "No handle"})\n` +
        `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
        `📱 <b>Requested App:</b> ${userStatus.pendingApp || "General VIP Pass"}\n` +
        `💰 <b>Amount:</b> ₹${vipPrice}\n` +
        `⏰ <b>Submitted:</b> ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`
      );

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Approve VIP (30 Days)", callback_data: `approve_${user.id}` },
            { text: "❌ Reject", callback_data: `reject_${user.id}` },
          ],
        ],
      };

      // Forward to Admin
      if (photo && photo.length > 0) {
        const largestPhotoId = photo[photo.length - 1].file_id;
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminChatId,
            photo: largestPhotoId,
            caption: adminCaption,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          }),
        }).catch((err) => console.error("Admin photo forward err:", err));
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: `${adminCaption}\n\n📝 <b>Message:</b>\n${text}`,
            parse_mode: "HTML",
            reply_markup: inlineKeyboard,
          }),
        }).catch((err) => console.error("Admin text forward err:", err));
      }

      // Reply to User
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: (
            `⏳ <b>Payment proof received!</b>\n\n` +
            `Admin is verifying your transaction. Once approved (usually within 2-5 minutes), your VIP pass will activate automatically!`
          ),
          parse_mode: "HTML",
        }),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
