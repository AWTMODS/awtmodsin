import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSiteSettings, getApplicationBySlug, getApplicationById, getApplications, getDbClient, invalidateDbCache, getSiteStats } from "@/lib/db";
import { isUserVip, recordUserInteraction, activateUserVip } from "@/lib/telegram-vip";
import { broadcastToTelegram } from "@/lib/telegram-broadcast";
import {
  parseApkReleaseInfo,
  matchApplicationByApk,
  executeAutoApkRelease,
} from "@/lib/telegram-auto-release";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function purgeAppCaches(slug?: string) {
  try {
    invalidateDbCache();
    revalidatePath("/", "page");
    revalidatePath("/apps", "page");
    revalidatePath("/categories", "page");
    revalidatePath("/search", "page");
    revalidatePath("/admin", "page");
    revalidatePath("/admin/apps", "page");
    revalidatePath("/admin/versions", "page");
    revalidatePath("/apps/[slug]", "page");
    revalidatePath("/download/[slug]", "page");
    if (slug) {
      const clean = slug.replace(/\.html$/i, "");
      revalidatePath(`/apps/${clean}`, "page");
      revalidatePath(`/apps/${clean}.html`, "page");
      revalidatePath(`/download/${clean}`, "page");
      revalidatePath(`/download/${clean}.html`, "page");
    }
  } catch {}
}

async function buildAdminMenuContent(settings: any) {
  const stats = await getSiteStats();
  const liveApps = stats?.publishedApps ?? 97;

  let activeVipCount = 0;
  let radarPendingCount = 0;
  let draftCount = 0;

  try {
    const { getVipUsers } = await import("@/lib/telegram-vip");
    const vipList = await getVipUsers();
    const now = Date.now();
    activeVipCount = vipList.filter(
      (u) => u.isVip && (!u.vipExpiresAt || new Date(u.vipExpiresAt).getTime() > now)
    ).length;
  } catch {}

  try {
    const { getRadarState } = await import("@/lib/playstore-radar");
    const radar = await getRadarState();
    radarPendingCount = Object.keys(radar.updates || {}).filter(
      (k) => !radar.updates[k].isMuted
    ).length;
  } catch {}

  try {
    const { applications } = await getApplications({ status: "draft", limit: 50 });
    draftCount = applications?.length || 0;
  } catch {}

  const text = (
    `🛠️ <b>AWTMods Admin Command Center</b>\n\n` +
    `Welcome, Admin! Control and monitor all website & bot functions directly from here:\n\n` +
    `📊 <b>Platform Quick Glance:</b>\n` +
    `• <b>Live Apps:</b> ${liveApps} published\n` +
    `• <b>Pending Drafts:</b> ${draftCount} waiting\n` +
    `• <b>Play Store Updates:</b> ${
      radarPendingCount > 0
        ? `🚨 <b>${radarPendingCount} detected</b>`
        : "✅ Up to date"
    }\n` +
    `• <b>Active VIPs:</b> ${activeVipCount} members\n` +
    `• <b>Server Status:</b> 🟢 24/7 Serverless Webhook\n\n` +
    `👇 <i>Select any administrative action or tool below:</i>`
  );

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `📡 Play Store Radar ${radarPendingCount > 0 ? `(${radarPendingCount})` : ""}`,
          callback_data: "adm_radar",
        },
        { text: "🕵️ Competitor Radar", callback_data: "adm_comp_radar" },
      ],
      [
        { text: `📝 Pending Drafts (${draftCount})`, callback_data: "adm_drafts" },
        { text: "✨ Auto-Scrape App", callback_data: "adm_newapp" },
      ],
      [
        { text: "🔍 Search & Edit App", callback_data: "adm_search_app" },
        { text: "📅 Scheduled Posts", callback_data: "adm_scheduled" },
      ],
      [
        { text: `👑 VIP Subscribers (${activeVipCount})`, callback_data: "adm_vip_list" },
        { text: "👥 Referral Stats", callback_data: "adm_ref_stats" },
      ],
      [
        { text: "💾 Backup Database", callback_data: "adm_backup" },
        { text: "⚡ Purge Live Caches", callback_data: "adm_purge_cache" },
      ],
      [
        { text: "📊 Platform Analytics", callback_data: "adm_stats" },
        { text: "⚙️ Site & Bot Config", callback_data: "adm_settings" },
      ],
      [
        {
          text: "🌐 Open Web Admin Dashboard",
          url: `${settings.siteUrl || "https://www.awtmods.in"}/admin`,
        },
      ],
    ],
  };

  return { text, reply_markup };
}

async function sendOrEditAdminMenu(
  chatId: number | string,
  token: string,
  settings: any,
  messageIdToEdit?: number
) {
  const { text, reply_markup } = await buildAdminMenuContent(settings);

  if (messageIdToEdit) {
    const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageIdToEdit,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup,
      }),
    }).catch(() => null);

    if (editRes && editRes.ok) return;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    }),
  }).catch(() => {});
}

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
      const isAdminUser = fromId === adminChatId || fromId === 1343548529;
      if (isAdminUser) {
        // ==========================================
        // 1.1 Admin Command Center Callbacks
        // ==========================================
        if (data === "adm_menu") {
          await sendOrEditAdminMenu(adminChatId, token, settings, cq.message?.message_id);
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_radar") {
          const { getRadarState } = await import("@/lib/playstore-radar");
          const radar = await getRadarState();
          const pending = Object.values(radar.updates || {}).filter((u: any) => !u.isMuted);

          let rText = `📡 <b>Play Store Version Radar</b>\n\n`;
          const buttons: any[] = [];

          if (pending.length === 0) {
            rText += `✅ <b>All applications are up to date!</b>\n` +
                     `No pending Google Play updates detected.\n\n` +
                     `<i>Last scan: ${radar.lastScanAt ? new Date(radar.lastScanAt).toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" }) : "Recently"} IST</i>`;
          } else {
            rText += `🚨 <b>Found ${pending.length} apps with newer versions on Play Store:</b>\n\n`;
            pending.slice(0, 5).forEach((u: any, idx: number) => {
              rText += `${idx + 1}. <b>${u.applicationName}</b>\n   Site: <code>${u.currentSiteVersion}</code> ➔ Play: <code>${u.latestPlayStoreVersion}</code>\n`;
              buttons.push([
                {
                  text: `⚡ Update ${u.applicationName.slice(0, 18)} (${u.latestPlayStoreVersion})`,
                  callback_data: `rdr_rel:${u.applicationId}:${u.latestPlayStoreVersion}`,
                },
              ]);
            });
            if (pending.length > 5) {
              rText += `\n<i>...plus ${pending.length - 5} more apps in dashboard!</i>`;
            }
          }

          buttons.push([
            { text: "🔄 Run Fresh Scan", callback_data: "adm_radar_scan" },
            { text: "🔙 Admin Menu", callback_data: "adm_menu" },
          ]);

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: rText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: buttons },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_radar_scan") {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "📡 Scanning Google Play Store for all catalog apps...",
            }),
          }).catch(() => {});

          const { checkPlayStoreUpdates } = await import("@/lib/playstore-radar");
          const scanRes = await checkPlayStoreUpdates({ notifyTelegram: false }).catch(() => null);

          const { getRadarState } = await import("@/lib/playstore-radar");
          const radar = await getRadarState();
          const pending = Object.values(radar.updates || {}).filter((u: any) => !u.isMuted);

          let rText = `📡 <b>Play Store Version Radar (Scan Finished)</b>\n\n`;
          const buttons: any[] = [];

          if (pending.length === 0) {
            rText += `✅ <b>Scan complete! All catalog applications are up to date.</b>\n` +
                     `<i>Scanned: ${scanRes?.checked || 0} apps</i>`;
          } else {
            rText += `🚨 <b>Scan complete! Detected ${pending.length} apps with newer updates:</b>\n\n`;
            pending.slice(0, 5).forEach((u: any, idx: number) => {
              rText += `${idx + 1}. <b>${u.applicationName}</b>\n   Site: <code>${u.currentSiteVersion}</code> ➔ Play: <code>${u.latestPlayStoreVersion}</code>\n`;
              buttons.push([
                {
                  text: `⚡ Update ${u.applicationName.slice(0, 18)} (${u.latestPlayStoreVersion})`,
                  callback_data: `rdr_rel:${u.applicationId}:${u.latestPlayStoreVersion}`,
                },
              ]);
            });
          }

          buttons.push([
            { text: "🔄 Scan Again", callback_data: "adm_radar_scan" },
            { text: "🔙 Admin Menu", callback_data: "adm_menu" },
          ]);

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: rText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: buttons },
            }),
          }).catch(() => {});

          return NextResponse.json({ ok: true });
        }

        if (data === "adm_comp_radar") {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "🕵️ Scanning competitor sites (LiteAPKs, HappyMod, AN1, APKDone)...",
            }),
          }).catch(() => {});

          const { checkCompetitorModReleases } = await import("@/lib/competitor-radar");
          const compRes = await checkCompetitorModReleases({ notifyTelegram: false }).catch(() => null);

          let cText = `🕵️ <b>Competitor Mod Radar</b>\n\n`;
          cText += `<b>Monitored:</b> LiteAPKs, HappyMod, AN1, APKDone\n\n`;

          if (!compRes || compRes.alertsFound === 0) {
            cText += `✅ <b>All caught up!</b> No new mod releases found on competitor sites right now.`;
          } else {
            cText += `🔥 <b>Detected ${compRes.alertsFound} new releases:</b>\n\n`;
            (compRes.alerts || []).slice(0, 5).forEach((rel: any, idx: number) => {
              cText += `${idx + 1}. <b>${rel.appName}</b> (${rel.detectedVersion})\n   Source: ${rel.source} [Site: ${rel.currentSiteVersion}]\n`;
            });
          }

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: cText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔄 Re-scan Competitors", callback_data: "adm_comp_radar" }],
                  [{ text: "🔙 Admin Menu", callback_data: "adm_menu" }],
                ],
              },
            }),
          }).catch(() => {});

          return NextResponse.json({ ok: true });
        }

        if (data === "adm_drafts") {
          const { applications } = await getApplications({ status: "draft", limit: 6, sortBy: "newest" });
          const drafts = applications || [];

          let dText = `📝 <b>Pending Draft Applications</b>\n\n`;
          const buttons: any[] = [];

          if (drafts.length === 0) {
            dText += `✅ <b>Zero drafts pending!</b> All applications in your catalog are published live on AWTMods.in.`;
            buttons.push([{ text: "✨ Auto-Scrape New App", callback_data: "adm_newapp" }]);
          } else {
            dText += `Select any draft below to edit, preview, test mirrors, publish to website, or broadcast:\n\n`;
            drafts.forEach((app, idx) => {
              const verName = app.latest_version?.version_name || app.versions?.[0]?.version_name || "v1.0";
              dText += `${idx + 1}. <b>${app.name}</b> (${verName})\n`;
              buttons.push([
                {
                  text: `📱 ${app.name} (${verName})`,
                  callback_data: `adm_open_draft:${app.id}`,
                },
              ]);
            });
          }

          buttons.push([{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]);

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: dText,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: buttons },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data.startsWith("adm_open_draft:")) {
          const appId = data.split(":")[1];
          const app = await getApplicationById(appId);
          if (app) {
            const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
            await sendDraftPreviewToAdmin(app, adminChatId);
          }
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id, text: "Opening draft preview card..." }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_newapp") {
          const nText = (
            `✨ <b>Auto-Scrape & Generate Mod Webpage</b>\n\n` +
            `Send any of the following directly into this chat:\n` +
            `1. <b>Google Play Store link:</b>\n` +
            `   <code>https://play.google.com/store/apps/details?id=...</code>\n` +
            `2. <b>Mod site link:</b>\n` +
            `   LiteAPKs, HappyMod, APKMody, AN1, etc.\n` +
            `3. <b>Batch links:</b>\n` +
            `   Paste 5-10 links separated by new lines!\n\n` +
            `The bot will automatically:\n` +
            `• Scrape metadata, HD icons, descriptions\n` +
            `• Set Developer Name to <b>aadith cv</b>\n` +
            `• Generate verified download mirrors\n` +
            `• Build live webpage draft & deliver 1-click Approval card!`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: nText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_search_app") {
          const sText = (
            `🔍 <b>Search & Manage Catalog</b>\n\n` +
            `Simply type any app name or keyword in this chat:\n` +
            `• <code>capcut</code>\n` +
            `• <code>spotify</code>\n` +
            `• <code>lightroom</code>\n` +
            `• <code>kinemaster</code>\n\n` +
            `The bot will instantly search the database and display complete version controls, mirror editors, and broadcasting options!`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: sText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_scheduled") {
          const { getScheduledPosts } = await import("@/lib/telegram-scheduler");
          const posts = await getScheduledPosts();

          let schText = `📅 <b>Scheduled Channel Posts</b>\n\n`;
          if (posts.length === 0) {
            schText += `No posts are currently queued for scheduled broadcast.\n\n` +
                       `<i>To schedule a release, click the '📅 Schedule Post' button on any draft preview card!</i>`;
          } else {
            schText += `Found ${posts.length} scheduled release(s):\n\n`;
            posts.forEach((p, idx) => {
              const targetTime = new Date(p.scheduledFor).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
              schText += `${idx + 1}. <b>${p.appName}</b>\n   Scheduled for: <code>${targetTime} IST</code>\n`;
            });
          }

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: schText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_vip_list") {
          const { getVipUsers } = await import("@/lib/telegram-vip");
          const vips = await getVipUsers();
          const now = Date.now();
          const activeVips = vips.filter(
            (u) => u.isVip && (!u.vipExpiresAt || new Date(u.vipExpiresAt).getTime() > now)
          );

          let vText = (
            `👑 <b>VIP Membership Overview</b>\n\n` +
            `• <b>Total Registered:</b> ${vips.length} users\n` +
            `• <b>Active Passes:</b> ${activeVips.length} members\n` +
            `• <b>VIP Price:</b> ₹${vipPrice} / 30 Days\n\n` +
            `<b>Recent Active Subscribers:</b>\n`
          );

          if (activeVips.length === 0) {
            vText += `<i>No active VIP members yet.</i>`;
          } else {
            activeVips.slice(0, 6).forEach((u, i) => {
              const exp = u.vipExpiresAt
                ? new Date(u.vipExpiresAt).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" })
                : "Lifetime";
              vText += `${i + 1}. @${u.username || u.fullName || u.userId} (ID: <code>${u.userId}</code>) — Expires: ${exp}\n`;
            });
          }

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: vText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "➕ Grant 30-Day VIP to User", callback_data: "adm_grant_vip" }],
                  [{ text: "🔙 Admin Menu", callback_data: "adm_menu" }],
                ],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_grant_vip") {
          const supabase = getDbClient();
          if (supabase) {
            await supabase.from("site_settings").upsert(
              {
                setting_key: `admin_wizard_${adminChatId}`,
                setting_value: { step: "waiting_for_grant_vip_id" },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "setting_key" }
            );
          }

          const gText = (
            `👑 <b>Grant VIP Membership</b>\n\n` +
            `Please send the numeric Telegram User ID (e.g. <code>1343548529</code>) of the user to activate 30 days of VIP Access.\n\n` +
            `<i>The bot will instantly activate their pass and send them a VIP welcome notification!</i>`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: gText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "❌ Cancel", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_ref_stats") {
          const { getVipUsers } = await import("@/lib/telegram-vip");
          const vips = await getVipUsers();
          const goal = settings.telegramReferralGoal || 5;
          const rewardDays = settings.telegramReferralRewardDays || 30;

          const referrers = vips
            .filter((u) => (u.referralsCount || 0) > 0)
            .sort((a, b) => (b.referralsCount || 0) - (a.referralsCount || 0));

          const totalInvited = referrers.reduce((acc, u) => acc + (u.referralsCount || 0), 0);
          const unlockedCount = referrers.filter((u) => (u.referralsCount || 0) >= goal).length;

          let rText = (
            `👥 <b>VIP Referral Program Analytics</b>\n\n` +
            `• <b>Goal:</b> Invite ${goal} friends = <b>${rewardDays} Days Free VIP</b>\n` +
            `• <b>Total Invitations Tracked:</b> ${totalInvited}\n` +
            `• <b>Users Unlocked VIP:</b> ${unlockedCount}\n\n` +
            `<b>Top Community Referrers:</b>\n`
          );

          if (referrers.length === 0) {
            rText += `<i>No referrals recorded yet.</i>`;
          } else {
            referrers.slice(0, 6).forEach((r, i) => {
              const statusTag = (r.referralsCount || 0) >= goal ? "👑 VIP Unlocked" : `${goal - (r.referralsCount || 0)} left`;
              rText += `${i + 1}. @${r.username || r.userId} — <b>${r.referralsCount} friends</b> (${statusTag})\n`;
            });
          }

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: rText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_backup") {
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "💾 Generating complete database JSON backup...",
            }),
          }).catch(() => {});

          const { sendDatabaseBackupToTelegram } = await import("@/lib/telegram-backup");
          const bRes = await sendDatabaseBackupToTelegram(adminChatId);

          let bText = `💾 <b>Database Backup</b>\n\n`;
          if (bRes.success) {
            bText += `✅ <b>Backup created and delivered successfully!</b>\n` +
                     `A full JSON snapshot document has been attached to this chat.\n\n` +
                     `• Total Apps: ${bRes.stats?.apps || 0}\n` +
                     `• Total Versions: ${bRes.stats?.versions || 0}\n` +
                     `• Categories: ${bRes.stats?.categories || 0}`;
          } else {
            bText += `❌ <b>Backup failed:</b> ${bRes.error || "Unknown error"}`;
          }

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: bText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          return NextResponse.json({ ok: true });
        }

        if (data === "adm_purge_cache") {
          purgeAppCaches();

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "⚡ Website & Database Caches Purged!",
            }),
          }).catch(() => {});

          const pText = (
            `⚡ <b>All Live Caches Purged!</b>\n\n` +
            `• Next.js ISR edge cache invalidated across all routes\n` +
            `• In-memory slug & database maps reset\n` +
            `• Real-time database queries refreshed\n\n` +
            `Every visit to <a href="${settings.siteUrl || "https://www.awtmods.in"}">AWTMods.in</a> now reads live database state immediately.`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: pText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          return NextResponse.json({ ok: true });
        }

        if (data === "adm_stats") {
          const stats = await getSiteStats();

          const sText = (
            `📊 <b>AWTMods Real-time Analytics</b>\n\n` +
            `• <b>Published Applications:</b> ${stats?.publishedApps || 0}\n` +
            `• <b>Active Categories:</b> ${stats?.categories || 0}\n` +
            `• <b>All-time Downloads:</b> ${stats?.totalDownloads || 0}\n` +
            `• <b>Pending User Requests:</b> ${stats?.pendingRequests || 0}\n` +
            `• <b>Mirror Health:</b> 🟢 100% Active`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: sText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🌐 View Full Analytics", url: `${settings.siteUrl || "https://www.awtmods.in"}/admin/analytics` }],
                  [{ text: "🔙 Admin Menu", callback_data: "adm_menu" }],
                ],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_settings") {
          const setDesc = (
            `⚙️ <b>Platform Configuration Overview</b>\n\n` +
            `• <b>Telegram Bot:</b> @${settings.telegramBotUsername || "awtmods_bot"}\n` +
            `• <b>Auto-Post Channel:</b> ${settings.telegramChannelId || "@awtmods"}\n` +
            `• <b>Private Storage Channel:</b> <code>${settings.telegramPrivateChannelId || "Not set"}</code>\n` +
            `• <b>Admin Chat ID:</b> <code>${adminChatId}</code>\n` +
            `• <b>VIP Pass Price:</b> ₹${vipPrice} / 30 Days\n` +
            `• <b>Telegram Join Popup:</b> ${settings.telegramPopupEnabled !== false ? "🟢 Enabled" : "🔴 Disabled"}\n` +
            `• <b>VIP Referral Program:</b> ${settings.telegramReferralsEnabled !== false ? "🟢 Enabled" : "🔴 Disabled"}\n` +
            `• <b>Competitor Mod Radar:</b> ${settings.competitorRadarEnabled ? "🟢 Enabled" : "🔴 Disabled"}`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: setDesc,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🌐 Open Admin Settings", url: `${settings.siteUrl || "https://www.awtmods.in"}/admin/settings` }],
                  [{ text: "🔙 Admin Menu", callback_data: "adm_menu" }],
                ],
              },
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

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
          let app = await getApplicationById(appId);
          if (app) {
            // If currently in draft, publish it to the website now
            const supabase = getDbClient();
            if (supabase && app.status !== "published") {
              await supabase
                .from("applications")
                .update({ status: "published" })
                .eq("id", appId);
              await supabase
                .from("application_versions")
                .update({ status: "published" })
                .eq("application_id", appId);
              purgeAppCaches(app.slug);
              app = (await getApplicationById(appId)) || app;
            }

            const bRes = await broadcastToTelegram({ app, force: true }).catch((err) =>
              console.warn("Broadcast callback err:", err)
            );

            const channelId = settings.telegramChannelId || "@awtmods";
            const channelClean = channelId.replace(/^@/, "");
            const postLink = bRes?.messageId
              ? `https://t.me/${channelClean}/${bRes.messageId}`
              : `https://t.me/${channelClean}`;

            // Edit the original wizard message buttons in-place to mark broadcasted
            if (cq.message?.message_id) {
              const liveAppUrl = `${settings.siteUrl || "https://www.awtmods.in"}/apps/${app.slug}.html`;
              const broadcastedButtons = [
                [
                  { text: "✅ Broadcasted to Channel", url: postLink },
                  { text: "🌐 View Live App", url: liveAppUrl },
                ],
                [
                  { text: "📁 Save as Draft", callback_data: `wiz_draft:${app.id}` },
                  { text: "⏰ Schedule Another", callback_data: `wiz_sched:${app.id}` },
                ],
              ];

              await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  reply_markup: { inline_keyboard: broadcastedButtons },
                }),
              }).catch(() => {});
            }

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `🎉 <b>POST APPROVED &amp; BROADCAST LIVE!</b>\n\n` +
                  `📱 <b>App:</b> ${app.name}\n` +
                  `📢 <b>Channel:</b> ${channelId}\n` +
                  `🌐 <b>Website Status:</b> Published (Live on AWTMods.in)\n\n` +
                  `✅ <i>The post is live on the channel with official app icon and download buttons!</i>`
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

        // Action: Publish on Website Only (Edit buttons in-place, no duplicate messages)
        if (action === "wiz_pubsite") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          const supabase = getDbClient();
          if (supabase) {
            await supabase
              .from("applications")
              .update({ status: "published" })
              .eq("id", appId);
            await supabase
              .from("application_versions")
              .update({ status: "published" })
              .eq("application_id", appId);
            purgeAppCaches(app?.slug);
          }

          if (app) {
            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const appUrl = `${siteUrl}/apps/${app.slug}.html`;

            // 1. Toast alert to admin
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cq.id,
                text: `🌐 Published! ${app.name} is now LIVE on website.`,
                show_alert: false,
              }),
            }).catch(() => {});

            // 2. Updated inline buttons (Row 2 toggles to "Save as Draft" + "View Live App")
            const updatedButtons = [
              [
                { text: "🚀 Approve & Broadcast Now", callback_data: `wiz_approve:${app.id}` },
                { text: "⏰ Schedule Post", callback_data: `wiz_sched:${app.id}` },
              ],
              [
                { text: "📁 Save as Draft", callback_data: `wiz_draft:${app.id}` },
                { text: "🌐 View Live App", url: appUrl },
              ],
              [
                { text: "🔢 Edit Version Code", callback_data: `wiz_code:${app.id}` },
                { text: "📦 Edit App Size", callback_data: `wiz_size:${app.id}` },
              ],
              [
                { text: "🖼️ Change Logo Photo", callback_data: `wiz_logo:${app.id}` },
                { text: "📝 Edit Mod Features", callback_data: `wiz_feat:${app.id}` },
              ],
            ];

            // 3. Edit original message in-place (caption if photo, or text if regular message)
            const existingCaption = cq.message?.caption;
            const existingText = cq.message?.text;

            if (existingCaption !== undefined) {
              const updatedCaption = existingCaption.replace(
                /(📌\s*<b>Website Status:<\/b>\s*<code>).*?(<\/code>)/,
                `$1🌐 PUBLISHED (Live)$2`
              );
              await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message?.message_id,
                  caption: updatedCaption,
                  parse_mode: "HTML",
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            } else if (existingText !== undefined) {
              const updatedText = existingText.replace(
                /(📌\s*<b>Website Status:<\/b>\s*<code>).*?(<\/code>)/,
                `$1🌐 PUBLISHED (Live)$2`
              );
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message?.message_id,
                  text: updatedText,
                  parse_mode: "HTML",
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            } else if (cq.message?.message_id) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            }

            return NextResponse.json({ ok: true, published: true });
          }
        }

        // Action: Keep / Save as Draft on Website (Edit buttons in-place, no duplicate messages)
        if (action === "wiz_draft") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          const supabase = getDbClient();
          if (supabase) {
            await supabase
              .from("applications")
              .update({ status: "draft" })
              .eq("id", appId);
            await supabase
              .from("application_versions")
              .update({ status: "draft" })
              .eq("application_id", appId);
            purgeAppCaches(app?.slug);
          }

          if (app) {
            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const appUrl = `${siteUrl}/apps/${app.slug}.html`;

            // 1. Toast alert to admin
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cq.id,
                text: `📁 Saved as Draft! ${app.name} is now unpublished.`,
                show_alert: false,
              }),
            }).catch(() => {});

            // 2. Updated inline buttons (Row 2 toggles to "Publish on Website" + "Preview on Website")
            const updatedButtons = [
              [
                { text: "🚀 Approve & Broadcast Now", callback_data: `wiz_approve:${app.id}` },
                { text: "⏰ Schedule Post", callback_data: `wiz_sched:${app.id}` },
              ],
              [
                { text: "🌐 Publish on Website", callback_data: `wiz_pubsite:${app.id}` },
                { text: "👀 Preview on Website", url: appUrl },
              ],
              [
                { text: "🔢 Edit Version Code", callback_data: `wiz_code:${app.id}` },
                { text: "📦 Edit App Size", callback_data: `wiz_size:${app.id}` },
              ],
              [
                { text: "🖼️ Change Logo Photo", callback_data: `wiz_logo:${app.id}` },
                { text: "📝 Edit Mod Features", callback_data: `wiz_feat:${app.id}` },
              ],
            ];

            // 3. Edit original message in-place
            const existingCaption = cq.message?.caption;
            const existingText = cq.message?.text;

            if (existingCaption !== undefined) {
              const updatedCaption = existingCaption.replace(
                /(📌\s*<b>Website Status:<\/b>\s*<code>).*?(<\/code>)/,
                `$1📁 DRAFT (Unpublished)$2`
              );
              await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message?.message_id,
                  caption: updatedCaption,
                  parse_mode: "HTML",
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            } else if (existingText !== undefined) {
              const updatedText = existingText.replace(
                /(📌\s*<b>Website Status:<\/b>\s*<code>).*?(<\/code>)/,
                `$1📁 DRAFT (Unpublished)$2`
              );
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message?.message_id,
                  text: updatedText,
                  parse_mode: "HTML",
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            } else if (cq.message?.message_id) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  reply_markup: { inline_keyboard: updatedButtons },
                }),
              }).catch(() => {});
            }

            return NextResponse.json({ ok: true, draft: true });
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

        // Action: Wizard Edit App Size Prompt
        if (action === "wiz_size") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_size", appId, appName: app.name },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }

            const currentSize = app.latest_version?.file_size || "Not set";
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `📦 <b>Edit Exact App Size for ${app.name}</b>\n\n` +
                  `Current Size: <code>${currentSize}</code>\n\n` +
                  `Please reply with the exact app size (e.g. <code>78 MB</code>, <code>138.56 MB</code>, <code>1.2 GB</code>):`
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

        // Action: Radar Quick Release Prompt
        if (action === "rdr_rel") {
          const appId = rest[0];
          const newVer = rest[1] || "Latest";
          const app = await getApplicationById(appId);
          if (app) {
            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: {
                    step: "waiting_for_radar_apk",
                    appId,
                    appName: app.name,
                    versionName: newVer.startsWith("v") ? newVer : `v${newVer}`,
                  },
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
                  `⚡ <b>Quick Release: ${app.name} (${newVer})</b>\n\n` +
                  `Please forward the new modded <code>.apk</code> file or paste a DevUploads / Direct APK link right here:\n\n` +
                  `<i>The bot will automatically extract file size, assign version <code>${newVer}</code>, and update the website catalog instantly!</i>`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
        }

        // Action: Radar Auto-Draft from Play Store
        if (action === "rdr_draft") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app && app.package_name) {
            const { scrapeAndCreateFromPlayStore } = await import("@/lib/playstore-auto-poster");
            const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: `🔍 <i>Scraping Play Store metadata for ${app.name} and generating draft...</i>`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            const res = await scrapeAndCreateFromPlayStore(
              `https://play.google.com/store/apps/details?id=${app.package_name}`
            );
            if (res.success && res.app) {
              await sendDraftPreviewToAdmin(res.app, adminChatId);
            }
          }
        }

        // Action: Radar Mute Alert
        if (action === "rdr_mute") {
          const appId = rest[0];
          const { getRadarState, saveRadarState } = await import("@/lib/playstore-radar");
          const radarState = await getRadarState();
          if (radarState.updates[appId]) {
            radarState.updates[appId].isMuted = true;
            await saveRadarState(radarState);
          }
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: `🔕 <b>Alert Muted:</b> You will not receive further alerts for this version.`,
              parse_mode: "HTML",
            }),
          }).catch(() => {});
        }

        // Action: Schedule Post Broadcast
        if (action === "wiz_sched") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `⏰ <b>Schedule Channel Broadcast: ${app.name}</b>\n\n` +
                  `Select when you would like this post to be published to <b>${settings.telegramChannelId || "@awtmods"}</b>:`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "⏱️ In 1 Hour", callback_data: `sched_do:${app.id}:60` },
                      { text: "⏱️ In 3 Hours", callback_data: `sched_do:${app.id}:180` },
                    ],
                    [
                      { text: "🌅 Peak 6:00 PM", callback_data: `sched_do:${app.id}:peak18` },
                      { text: "🌃 Peak 9:00 PM", callback_data: `sched_do:${app.id}:peak21` },
                    ],
                    [
                      { text: "☀️ Tomorrow 10:00 AM", callback_data: `sched_do:${app.id}:tomorrow10` },
                    ],
                    [
                      { text: "🔙 Cancel", callback_data: `broadcast:${app.id}` },
                    ],
                  ],
                },
              }),
            });
          }
        }

        // Action: Confirm Schedule Execution
        if (action === "sched_do") {
          const appId = rest[0];
          const timing = rest[1] || "60";
          const app = await getApplicationById(appId);
          if (app) {
            let targetDate = new Date();
            if (timing === "60") {
              targetDate = new Date(Date.now() + 60 * 60 * 1000);
            } else if (timing === "180") {
              targetDate = new Date(Date.now() + 180 * 60 * 1000);
            } else if (timing === "peak18") {
              targetDate.setHours(18, 0, 0, 0);
              if (targetDate.getTime() <= Date.now()) {
                targetDate.setDate(targetDate.getDate() + 1);
              }
            } else if (timing === "peak21") {
              targetDate.setHours(21, 0, 0, 0);
              if (targetDate.getTime() <= Date.now()) {
                targetDate.setDate(targetDate.getDate() + 1);
              }
            } else if (timing === "tomorrow10") {
              targetDate.setDate(targetDate.getDate() + 1);
              targetDate.setHours(10, 0, 0, 0);
            }

            const { scheduleAppPost } = await import("@/lib/telegram-scheduler");
            await scheduleAppPost(app.id, targetDate.toISOString(), adminChatId);

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `⏰ <b>Post Scheduled Successfully!</b>\n\n` +
                  `📦 <b>App:</b> ${app.name}\n` +
                  `📅 <b>Scheduled For:</b> <code>${targetDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
                  `📢 <b>Target Channel:</b> ${settings.telegramChannelId || "@awtmods"}\n\n` +
                  `<i>The bot will automatically publish this to the website and channel when the scheduled time arrives.</i>`
                ),
                parse_mode: "HTML",
              }),
            });
          }
        }

        // Action: Auto-Import from Competitor Mod Radar
        if (action === "import_mod") {
          const rawUrl = decodeURIComponent(rest.join(":"));
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: `🔍 <i>Scraping competitor mod page and generating draft post...</i>\n<code>${rawUrl}</code>`,
              parse_mode: "HTML",
            }),
          });
          const { scrapeAndCreateFromModUrl } = await import("@/lib/mod-web-scraper");
          const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
          const res = await scrapeAndCreateFromModUrl(rawUrl);
          if (res.success && res.app) {
            await sendDraftPreviewToAdmin(res.app, adminChatId);
          } else {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: `❌ Mod scraping failed: ${res.error}`,
              }),
            });
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

      // ==========================================
      // Public Callbacks for ALL Telegram Users
      // ==========================================
      const userChatId = cq.message?.chat?.id || fromId;

      // User Action: Subscribe to App Updates
      if (data.startsWith("sub_") || data.startsWith("sub:")) {
        const targetAppId = data.includes(":") ? data.split(":")[1] : data.slice(4);
        const app = await getApplicationById(targetAppId);
        if (app && fromId) {
          const { subscribeUserToApp } = await import("@/lib/telegram-vip");
          await subscribeUserToApp(fromId, app.slug);
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: userChatId,
              text: `🔔 <b>Subscribed!</b> You will receive an instant alert here the second a new update for <b>${app.name}</b> is released.`,
              parse_mode: "HTML",
            }),
          });
        }
      }

      // User Action: Referral Program Dashboard
      if (data === "referral_info") {
        const { getReferralStats } = await import("@/lib/telegram-vip");
        const goal = settings.telegramReferralGoal || 5;
        const stats = await getReferralStats(fromId || userChatId, settings.telegramBotUsername || "awtmods_bot", goal);
        const percent = Math.min(100, Math.round((stats.count / goal) * 100));
        const fullBar = "🟩".repeat(Math.floor(percent / 20)) + "⬜".repeat(5 - Math.floor(percent / 20));

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userChatId,
            text: (
              `👥 <b>AWTMods VIP Referral Program</b>\n\n` +
              `Invite <b>${goal} friends</b> to the bot and unlock <b>30 Days of FREE VIP Access</b>! 👑\n\n` +
              `📊 <b>Your Progress:</b> ${stats.count} / ${goal} Friends Invited\n` +
              `[${fullBar}] ${percent}%\n\n` +
              `🔗 <b>Your Exclusive Invite Link:</b>\n<code>${stats.inviteLink}</code>\n\n` +
              `<i>When your friends start the bot using your link, your count increases! Once you reach ${goal}, Free VIP unlocks automatically!</i>`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📤 Share Invite Link with Friends",
                    url: `https://t.me/share/url?url=${encodeURIComponent(stats.inviteLink)}&text=${encodeURIComponent("Download 100% clean modded APKs with zero ads on AWTMods!")}`,
                  },
                ],
              ],
            },
          }),
        });
      }

      // User Action: Submit MOD Request from Bot
      if (data.startsWith("req_app:") || data.startsWith("req_app_")) {
        const requestedName = decodeURIComponent(data.includes(":") ? data.slice(8) : data.slice(8));
        const supabase = getDbClient();
        if (supabase && requestedName) {
          await supabase.from("mod_requests").insert({
            app_name: requestedName,
            status: "pending",
            requested_by: cq.from?.username || String(fromId) || "Telegram User",
            votes: 1,
          });
        }
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userChatId,
            text: (
              `✅ <b>MOD Request Submitted!</b>\n\n` +
              `Our team has received your request for <b>"${requestedName}"</b>.\n` +
              `We will add it to AWTMods.in soon! Make sure to stay in our channel @awtmods for the release alert.`
            ),
            parse_mode: "HTML",
          }),
        });
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
              purgeAppCaches(app?.slug);
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

        // Step 1.5: App Size input
        if (wiz.step === "waiting_for_size" && text) {
          let cleanSize = text.trim();
          if (/^[0-9]+(?:\.[0-9]+)?$/.test(cleanSize)) {
            cleanSize = `${cleanSize} MB`;
          } else {
            const sizeMatch = cleanSize.match(/\b([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB|KB))\b/i);
            if (sizeMatch) {
              cleanSize = sizeMatch[1].toUpperCase();
            }
          }

          if (cleanSize) {
            const app = await getApplicationById(wiz.appId);
            const ver = app?.latest_version || app?.versions?.[0];
            if (ver?.id) {
              await supabase
                .from("application_versions")
                .update({ file_size: cleanSize })
                .eq("id", ver.id);
              await supabase
                .from("site_settings")
                .delete()
                .eq("setting_key", `admin_wizard_${adminChatId}`);
              purgeAppCaches(app?.slug);
              const updatedApp = await getApplicationById(wiz.appId);
              if (updatedApp) {
                const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: `✅ <b>Exact App Size updated to <code>${cleanSize}</code>!</b>\nHere is your updated Channel Broadcast Preview:`,
                    parse_mode: "HTML",
                  }),
                });
                await sendDraftPreviewToAdmin(updatedApp, adminChatId);
                return NextResponse.json({ ok: true, wizardUpdated: "file_size" });
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
            const updatedApp = await getApplicationById(wiz.appId);
            purgeAppCaches(updatedApp?.slug);
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
            const updatedApp = await getApplicationById(wiz.appId);
            purgeAppCaches(updatedApp?.slug);
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

        // Step 4: Radar Quick Release APK input
        if (wiz.step === "waiting_for_radar_apk" && (doc || text || caption)) {
          const rawFileName =
            doc?.file_name ||
            (caption || text || "").match(/([a-zA-Z0-9_\-\.]+\.apk)/i)?.[1] ||
            "app.apk";
          const fileSizeBytes = doc?.file_size || 0;
          const parsed = parseApkReleaseInfo(rawFileName, caption || text || "", fileSizeBytes);

          const { executeAutoApkRelease } = await import("@/lib/telegram-auto-release");
          const releaseRes = await executeAutoApkRelease({
            appId: wiz.appId,
            versionName: wiz.versionName || parsed.versionName,
            versionCode: parsed.versionCode > 0 ? parsed.versionCode : 1,
            fileSize: parsed.fileSize,
            externalUrls: parsed.externalUrls,
            fileId: doc?.file_id,
            releaseNotes: parsed.releaseNotes,
          });

          await supabase
            .from("site_settings")
            .delete()
            .eq("setting_key", `admin_wizard_${adminChatId}`);
          purgeAppCaches();

          if (releaseRes.success && releaseRes.app) {
            const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: `🎉 <b>${releaseRes.app.name} updated to ${wiz.versionName || parsed.versionName}!</b>\n\nChannel Broadcast Preview generated below:`,
                parse_mode: "HTML",
              }),
            });
            await sendDraftPreviewToAdmin(releaseRes.app, adminChatId);
            return NextResponse.json({ ok: true, radarQuickReleased: releaseRes.app.name });
          }
        }

        // Step 5: Grant VIP by User ID
        if (wiz.step === "waiting_for_grant_vip_id" && text) {
          const targetUserId = parseInt(text.trim(), 10);
          if (!isNaN(targetUserId) && targetUserId > 1000) {
            await supabase
              .from("site_settings")
              .delete()
              .eq("setting_key", `admin_wizard_${adminChatId}`);

            const { activateUserVip } = await import("@/lib/telegram-vip");
            await activateUserVip(targetUserId, 30);

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `👑 <b>VIP ACCESS ACTIVATED!</b>\n\n` +
                  `User ID <code>${targetUserId}</code> has been granted <b>30 Days of VIP Direct APK Access</b>.\n\n` +
                  `A confirmation notification has been delivered to the user.`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
                },
              }),
            }).catch(() => {});

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: targetUserId,
                text: (
                  `🎉 <b>Congratulations! VIP Pass Activated!</b>\n\n` +
                  `The administrator has activated <b>30 Days of VIP Access</b> for your account!\n` +
                  `⚡ You now have direct high-speed APK downloads on <a href="https://www.awtmods.in">AWTMods.in</a>!`
                ),
                parse_mode: "HTML",
              }),
            }).catch(() => {});

            return NextResponse.json({ ok: true });
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
    // 2.8 APP / MOD / GOOGLE PLAY STORE LINK AUTO-POST GENERATOR (SINGLE & BULK)
    // ==========================================================
    const fullMessage = (text || caption || "").trim();
    const allUrls = fullMessage.match(/(?:https?:\/\/)[^\s]+/gi) || [];

    // Filter out direct APK links that will be handled by the APK release engine
    const appLinkMatches = allUrls.filter((url: string) => {
      const u = url.toLowerCase();
      return !u.endsWith(".apk") && !u.includes(".apk?");
    });

    if (isAuthorized && appLinkMatches.length > 0 && !hasApkDoc && !hasApkText) {
      const { scrapeAndCreateFromPlayStore } = await import("@/lib/playstore-auto-poster");
      const { scrapeAndCreateFromModUrl } = await import("@/lib/mod-web-scraper");
      const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");

      // Extract per-line target strings to preserve any per-app custom sizes or annotations
      const lines = fullMessage.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      const targetsMap = new Map<string, string>();

      for (const fullUrl of appLinkMatches) {
        // Deduplication key
        let key = fullUrl.toLowerCase().split("?")[0].split("#")[0].replace(/\/+$/, "");
        const pkgMatch = fullUrl.match(/id=([a-zA-Z0-9._]+)/i);
        if (pkgMatch) {
          key = `play_${pkgMatch[1].toLowerCase()}`;
        }

        // Look for the specific line that contains this URL
        const matchingLine = lines.find((l: string) => l.includes(fullUrl)) || fullUrl;
        const urlMatchesInLine = matchingLine.match(/(?:https?:\/\/)[^\s]+/gi) || [];
        const targetString = urlMatchesInLine.length === 1 ? matchingLine : fullUrl;

        if (!targetsMap.has(key)) {
          targetsMap.set(key, targetString);
        }
      }

      const uniqueTargets = Array.from(targetsMap.values());

      // Helper function to process any link (Google Play or Mod site)
      const processLink = async (target: string) => {
        if (target.includes("play.google.com/store/apps/details")) {
          return await scrapeAndCreateFromPlayStore(target);
        } else {
          return await scrapeAndCreateFromModUrl(target);
        }
      };

      if (uniqueTargets.length === 1) {
        // --- SINGLE APP / MOD IMPORT FLOW ---
        const rawInput = uniqueTargets[0];
        const isPlay = rawInput.includes("play.google.com/store/apps/details");

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: isPlay
              ? `🔍 <b>Google Play link detected!</b>\n<i>Scraping official icon, title, genre, and generating mod post (Developer: Aadith C V)...</i>`
              : `🌐 <b>Mod webpage link detected!</b>\n<i>Scraping app details, mod features, icon, and generating webpage (Developer: Aadith C V)...</i>`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});

        const result = await processLink(rawInput);

        if (result.success && result.app) {
          await sendDraftPreviewToAdmin(result.app, adminChatId);
          purgeAppCaches(result.app.slug);
          return NextResponse.json({ ok: true, appCreated: result.app.name, developer: result.app.developer });
        } else {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ <b>Failed to fetch from link:</b>\n<code>${result.error || "Unknown error"}</code>`,
              parse_mode: "HTML",
            }),
          }).catch(() => {});
          return NextResponse.json({ ok: false, error: result.error });
        }
      } else {
        // --- BULK APPS & MODS IMPORT FLOW ---
        const totalCount = uniqueTargets.length;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📦 <b>Bulk Mod & App Import: ${totalCount} links detected!</b>\n<i>Scraping metadata, icons, and generating draft cards (Developer: Aadith C V)...</i>`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});

        const successfulApps: any[] = [];
        const failedApps: { target: string; error: string }[] = [];

        for (let i = 0; i < uniqueTargets.length; i++) {
          const target = uniqueTargets[i];
          try {
            const result = await processLink(target);
            if (result.success && result.app) {
              successfulApps.push(result.app);
              await sendDraftPreviewToAdmin(result.app, adminChatId);
            } else {
              failedApps.push({ target, error: result.error || "Failed to scrape" });
            }
          } catch (err: any) {
            failedApps.push({ target, error: err.message || "Scraping failed" });
          }

          // Gentle delay between Telegram messages to prevent HTTP 429 flood
          if (i < uniqueTargets.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 350));
          }
        }

        // Invalidate website caches so all newly created drafts show up immediately in Admin
        purgeAppCaches();

        // Send consolidated summary to admin
        const successCount = successfulApps.length;
        const failCount = failedApps.length;

        let summaryText = `🎉 <b>Bulk Import Complete!</b>\n\n`;
        summaryText += `✅ <b>Successfully Created:</b> ${successCount} / ${totalCount} draft posts\n`;
        summaryText += `👤 <b>Developer:</b> Aadith C V\n`;
        if (failCount > 0) {
          summaryText += `⚠️ <b>Failed (${failCount}):</b>\n`;
          for (const f of failedApps.slice(0, 5)) {
            const label = f.target.match(/id=([a-zA-Z0-9._]+)/i)?.[1] || f.target.slice(0, 35);
            summaryText += `• <code>${label}</code>: ${f.error}\n`;
          }
          if (failedApps.length > 5) {
            summaryText += `<i>...and ${failedApps.length - 5} more</i>\n`;
          }
        }
        summaryText += `\nAll drafts are ready! You can publish them with the <b>[ 🚀 Quick Publish ]</b> buttons above, or manage them in the dashboard:\n`;
        summaryText += `👉 <a href="https://www.awtmods.in/admin/apps">Manage Apps in Admin Panel</a>`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: summaryText,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }).catch(() => {});

        return NextResponse.json({
          ok: true,
          bulkImport: true,
          total: totalCount,
          successCount,
          failCount,
        });
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

    // ==========================================
    // 2.9 Command: /admin, /panel, or /dashboard
    // ==========================================
    if (
      text === "/admin" ||
      text.startsWith("/admin ") ||
      text === "/panel" ||
      text === "/dashboard"
    ) {
      const isAdminUser =
        user?.id === adminChatId ||
        chatId === adminChatId ||
        user?.id === 1343548529 ||
        chatId === 1343548529;

      if (!isAdminUser) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `⛔ <b>Access Denied:</b> This command is reserved exclusively for the AWTMods Bot Administrator.`,
            parse_mode: "HTML",
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: true });
      }

      await sendOrEditAdminMenu(chatId, token, settings);
      return NextResponse.json({ ok: true });
    }

    // Check if user is asking for /start
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const rawArg = parts[1] || "";
      const targetApp = rawArg.startsWith("dl_") ? rawArg.replace("dl_", "") : null;

      // Handle Affiliate Referral Invitation (?start=ref_<referrerId>)
      if (rawArg.startsWith("ref_") && user) {
        const referrerId = parseInt(rawArg.replace("ref_", ""), 10);
        if (!isNaN(referrerId) && referrerId !== user.id) {
          const { recordReferral } = await import("@/lib/telegram-vip");
          const goal = settings.telegramReferralGoal || 5;
          const rewardDays = settings.telegramReferralRewardDays || 30;
          const refResult = await recordReferral(user.id, referrerId, goal, rewardDays);

          if (refResult.success) {
            if (refResult.unlockedVip) {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: referrerId,
                  text: (
                    `🎉 <b>CONGRATULATIONS! REFERRAL GOAL REACHED!</b>\n\n` +
                    `<b>${goal} friends</b> have joined AWTMods using your invite link.\n` +
                    `You have unlocked <b>${rewardDays} Days of FREE VIP Access</b>! 👑\n\n` +
                    `Your VIP pass is active right now. Enjoy unlimited direct APK downloads!`
                  ),
                  parse_mode: "HTML",
                }),
              }).catch(() => {});
            } else {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: referrerId,
                  text: (
                    `👤 <b>New Friend Joined!</b>\n\n` +
                    `A friend just joined using your referral link.\n` +
                    `📊 <b>Your Progress:</b> ${refResult.count} / ${goal} friends\n` +
                    `<i>Only ${goal - refResult.count} more to unlock Free VIP!</i>`
                  ),
                  parse_mode: "HTML",
                }),
              }).catch(() => {});
            }
          }
        }
      }

      // Handle App Update Alert Subscription (?start=notify_<slug>)
      if (rawArg.startsWith("notify_") && user) {
        const slug = rawArg.replace("notify_", "");
        const { subscribeUserToApp } = await import("@/lib/telegram-vip");
        await subscribeUserToApp(user.id, slug);
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `🔔 <b>Subscribed to Update Alerts!</b>\n\n` +
              `You will receive an instant message here the second a new version of <b>${slug}</b> is published on AWTMods!`
            ),
            parse_mode: "HTML",
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: true });
      }

      if (user) {
        await recordUserInteraction(user.id, {
          username: user.username,
          fullName: [user.first_name, user.last_name].filter(Boolean).join(" "),
          pendingApp: targetApp,
        });
      }

      const vipStatus = user ? await isUserVip(user.id) : { isVip: false };
      const stats = await getSiteStats();
      const liveAppCount = stats?.publishedApps || 97;

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
                `Browse all <b>${liveAppCount} apps</b> on <a href="https://www.awtmods.in">AWTMods.in</a> and tap "Get Direct File" on any app to receive it instantly here!`
              ),
              parse_mode: "HTML",
            }),
          });
          return NextResponse.json({ ok: true });
        }

        // Look up the exact app in the database
        const app = await getApplicationBySlug(targetApp);
        if (!app) {
          const siteUrl = settings.siteUrl || "https://www.awtmods.in";
          const searchUrl = `${siteUrl}/search?q=${encodeURIComponent(targetApp)}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: (
                `⚠️ <b>File Updating / Not Found in Bot</b>\n\n` +
                `The direct file for "<b>${targetApp}</b>" could not be located in this bot node.\n\n` +
                `🌐 You can search and download the latest version right now from our website:\n` +
                `🔗 <a href="${searchUrl}"><b>Search &amp; Download on AWTMods.in</b></a>`
              ),
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🌐 Search & Download on Website", url: searchUrl },
                  ],
                ],
              },
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
        // Provide our official website download link or valid external mirror — NEVER just open play store or general channel!
        const siteUrl = settings.siteUrl || "https://www.awtmods.in";
        const cleanSlug = app.slug.replace(/\.html$/, "");
        const websiteDownloadUrl = `${siteUrl}/download/${cleanSlug}`;
        const websiteAppUrl = `${siteUrl}/apps/${cleanSlug}.html`;

        const mirror = version?.download_sources?.find(
          (s) =>
            s.download_url &&
            !s.download_url.includes("t.me") &&
            !s.download_url.includes("play.google.com")
        );

        const targetDownloadUrl = mirror?.download_url || websiteDownloadUrl;
        const targetMirrorName = mirror?.download_url
          ? (mirror.mirror_name || "Fast Mirror")
          : "AWTMods Website";

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
              `🚀 In the meantime, you can download it immediately from our website:\n\n` +
              `🔗 <a href="${targetDownloadUrl}"><b>Click here to Download on AWTMods Website</b></a>`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `🌐 Download on Website (${targetMirrorName})`, url: targetDownloadUrl },
                ],
                [
                  { text: "📱 View Full App Details", url: websiteAppUrl },
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
        `• 📦 Unlimited access across all <b>${liveAppCount} apps</b> for 30 days\n` +
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

    // ==========================================================
    // 5. DATABASE BACKUP COMMAND (/backup) - Admin Only
    // ==========================================================
    if (text === "/backup" && isAuthorized) {
      const { sendDatabaseBackupToTelegram } = await import("@/lib/telegram-backup");
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⏳ <b>Exporting database snapshot...</b>\n<i>Collecting applications, versions, categories, and settings...</i>`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});

      const backupRes = await sendDatabaseBackupToTelegram(chatId);
      if (!backupRes.success) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ Backup failed: ${backupRes.error}`,
          }),
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // ==========================================================
    // 6. REFERRAL PROGRAM COMMAND (/referral or /invite)
    // ==========================================================
    if (text === "/referral" || text === "/invite") {
      const { getReferralStats } = await import("@/lib/telegram-vip");
      const goal = settings.telegramReferralGoal || 5;
      const stats = await getReferralStats(user?.id || chatId, settings.telegramBotUsername || "awtmods_bot", goal);
      const percent = Math.min(100, Math.round((stats.count / goal) * 100));
      const fullBar = "🟩".repeat(Math.floor(percent / 20)) + "⬜".repeat(5 - Math.floor(percent / 20));

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: (
            `👥 <b>AWTMods VIP Referral Program</b>\n\n` +
            `Invite <b>${goal} friends</b> to the bot and unlock <b>30 Days of FREE VIP Access</b>! 👑\n\n` +
            `📊 <b>Your Progress:</b> ${stats.count} / ${goal} Friends Invited\n` +
            `[${fullBar}] ${percent}%\n\n` +
            `🔗 <b>Your Exclusive Invite Link:</b>\n<code>${stats.inviteLink}</code>\n\n` +
            `<i>Share this link with your friends or in Telegram groups!</i>`
          ),
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📤 Share Invite Link with Friends",
                  url: `https://t.me/share/url?url=${encodeURIComponent(stats.inviteLink)}&text=${encodeURIComponent("Download 100% clean modded APKs with zero ads on AWTMods!")}`,
                },
              ],
            ],
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // ==========================================================
    // 7. DIRECT APP NAME SEARCH & VIP APK DELIVERY (NO /command REQUIRED)
    // ==========================================================
    if (
      text &&
      !text.startsWith("/") &&
      !text.startsWith("http://") &&
      !text.startsWith("https://") &&
      !hasApkDoc &&
      !hasApkText
    ) {
      const query = text.trim();
      if (query.length >= 2) {
        const { getApplications } = await import("@/lib/db");
        const cleanSlugQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        let targetApp = await getApplicationBySlug(cleanSlugQuery);
        if (!targetApp) {
          const { applications: searchResults } = await getApplications({
            search: query,
            limit: 3,
            status: "published",
          });
          if (searchResults && searchResults.length > 0) {
            targetApp = searchResults[0];
          }
        }

        if (targetApp) {
          const version = targetApp.latest_version || targetApp.versions?.[0];
          const vipStatus = user ? await isUserVip(user.id) : { isVip: false };
          const siteUrl = settings.siteUrl || "https://www.awtmods.in";
          const cleanSlug = targetApp.slug.replace(/\.html$/, "");
          const appUrl = `${siteUrl}/apps/${cleanSlug}.html`;
          const downloadUrl = `${siteUrl}/download/${cleanSlug}`;

          if (vipStatus.isVip) {
            // VIP USER: Direct APK delivery
            const tgSource = version?.download_sources?.find(
              (s) => s.hosting_provider === "telegram" || s.download_url?.includes("t.me")
            );

            let sentDirect = false;
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
                      `📦 <b>App:</b> ${targetApp.name}\n` +
                      `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n` +
                      `📊 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
                      `👑 <i>VIP Pass Active. Tap above to install directly!</i>`
                    ),
                    parse_mode: "HTML",
                  }),
                });
                const docJson = await docRes.json();
                sentDirect = docJson.ok;
              } catch {}
            }

            if (!sentDirect) {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: (
                    `⚡ <b>VIP Direct Download</b>\n\n` +
                    `📦 <b>App:</b> ${targetApp.name}\n` +
                    `🏷️ <b>Version:</b> <code>${version?.version_name || "Latest"}</code>\n` +
                    `📊 <b>Size:</b> ${version?.file_size || "APK"}\n\n` +
                    `🚀 Tap below to download high-speed without waiting:`
                  ),
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "⚡ High-Speed Direct Download", url: downloadUrl }],
                      [{ text: "🌐 View Full App Details", url: appUrl }],
                    ],
                  },
                }),
              });
            }
            return NextResponse.json({ ok: true, directDelivered: targetApp.name });
          } else {
            // NON-VIP USER: App Preview Card with Free Download & VIP Option
            const modFeats = (targetApp.mod_features || []).slice(0, 4).map((f) => `• ${f}`).join("\n");
            const appCardText = (
              `📱 <b>${targetApp.name}</b>\n\n` +
              `🏷️ <b>Version:</b> <code>${version?.version_name || "vLatest"}</code> | 📦 <b>Size:</b> ${version?.file_size || "APK"}\n` +
              `👤 <b>Developer:</b> ${targetApp.developer || "Aadith C V"}\n\n` +
              (modFeats ? `<u><b>MOD Features:</b></u>\n${modFeats}\n\n` : "") +
              `🛡️ <i>Clean, Verified &amp; Malware-Free APK</i>`
            );

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: appCardText,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "🌐 Free Download on Website", url: downloadUrl },
                    ],
                    [
                      { text: "👑 Get Direct File in Chat (VIP)", callback_data: `get_vip_${cleanSlug}` },
                    ],
                    [
                      { text: "👥 Invite Friends (Get Free VIP)", callback_data: "referral_info" },
                      { text: "🔔 Notify Me on Updates", callback_data: `sub_${targetApp.id}` },
                    ],
                  ],
                },
              }),
            });
            return NextResponse.json({ ok: true, previewServed: targetApp.name });
          }
        } else {
          // App not found: Offer 1-tap MOD Request!
          const safeQuery = query.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: (
                `🔍 <b>App Not Found:</b> "<code>${safeQuery}</code>"\n\n` +
                `This application is not available on AWTMods yet.\n` +
                `Would you like to request this MOD? Our team will add it!`
              ),
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🙋‍♂️ Submit MOD Request", callback_data: `req_app:${encodeURIComponent(query.slice(0, 40))}` },
                  ],
                  [
                    { text: "🌐 Browse All Apps on Website", url: "https://www.awtmods.in/apps" },
                  ],
                ],
              },
            }),
          });
          return NextResponse.json({ ok: true, notFoundOffered: query });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
