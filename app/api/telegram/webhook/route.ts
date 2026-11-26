import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSiteSettings, getApplicationBySlug, getApplicationById, getApplications, getCategories, createApplication, getDbClient, invalidateDbCache, getSiteStats, createModRequest, deleteApplication } from "@/lib/db";
import { isUserVip, recordUserInteraction, activateUserVip } from "@/lib/telegram-vip";
import { broadcastToTelegram } from "@/lib/telegram-broadcast";
import { checkAndMarkTelegramUpdate } from "@/lib/telegram-dedup";
import { cleanAppSlug } from "@/lib/utils";
import {
  parseApkReleaseInfo,
  matchApplicationByApk,
  executeAutoApkRelease,
} from "@/lib/telegram-auto-release";

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
      revalidatePath("/pc-software", "page");
    }
  } catch {}
}

async function buildScheduledQueueView() {
  const { getScheduledPosts } = await import("@/lib/telegram-scheduler");
  const allPosts = await getScheduledPosts();
  const pending = allPosts
    .filter((p) => p.status === "pending")
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  let text = `📅 <b>Scheduled Queue Manager</b>\n\n`;
  const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  if (pending.length === 0) {
    text +=
      `No pending posts are currently queued.\n\n` +
      `<i>Use "📅 Auto-Spread (+1h After Last)" or "⏰ Schedule Post" on any app card to queue releases.</i>`;
  } else {
    text += `Showing <b>${pending.length}</b> pending release(s) in chronological order:\n\n`;
    pending.slice(0, 8).forEach((p, idx) => {
      const targetTime = new Date(p.scheduledFor).toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      text += `${idx + 1}. <b>${escapeHtml(p.appName)}</b>\n   🕒 <code>${targetTime} IST</code>\n`;
      const shortName = p.appName.length > 18 ? `${p.appName.slice(0, 17)}…` : p.appName;
      inline_keyboard.push([
        { text: `🚀 Post: ${shortName}`, callback_data: `q_post:${p.appId}` },
        { text: "⏰ +1h", callback_data: `q_plus1h:${p.appId}` },
        { text: "❌", callback_data: `q_cancel:${p.appId}` },
      ]);
    });
    if (pending.length > 8) {
      text += `\n<i>+ ${pending.length - 8} more queued item(s)</i>`;
    }
  }

  inline_keyboard.push([
    { text: "🔄 Refresh", callback_data: "adm_scheduled" },
    { text: "🔙 Admin Menu", callback_data: "adm_menu" },
  ]);

  return { text, reply_markup: { inline_keyboard } };
}

async function createPcSoftwareDraftFromTelegram(
  rawInput: string,
  adminChatId: number | string
) {
  const parts = rawInput.split("|").map((s) => s.trim()).filter(Boolean);
  const softwareName = parts[0] || "";
  if (!softwareName) return null;

  const customVersion = parts[1] && !parts[1].startsWith("http") ? parts[1] : undefined;
  const customUrl = parts.find((p) => /^https?:\/\//i.test(p));

  const categories = await getCategories();
  const pcCategory =
    categories.find((c) => c.slug === "pc-software") ||
    categories.find((c) => c.slug === "tools") ||
    categories[0];

  const baseSlug = softwareName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  const exeBase = softwareName
    .toLowerCase()
    .replace(/\b(202[4-9]|pro|studio|cc|dc|pre-activated|crack|for pc|mac|windows)\b/gi, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || baseSlug.replace(/-/g, "").slice(0, 20) || "software";

  const displayName = /pre-activated/i.test(softwareName)
    ? softwareName
    : `${softwareName} (Pre-Activated)`;

  const downloadSources = customUrl
    ? [
        {
          download_type: "external" as const,
          hosting_provider: customUrl.includes("mediafire")
            ? ("mediafire" as const)
            : customUrl.includes("drive.google")
            ? ("google_drive" as const)
            : ("custom" as const),
          download_url: customUrl,
          mirror_name: "Windows & macOS Fast Mirror",
          is_primary: true,
          is_active: true,
        },
      ]
    : [];

  const createdApp = await createApplication({
    name: displayName,
    slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
    package_name: `${exeBase}.exe`,
    developer: "Aadith C V",
    category_id: pcCategory?.id,
    platform: "pc",
    short_description: `Download ${displayName} for Windows & macOS with all Pro features unlocked.`,
    description:
      `### Overview\n${displayName} is available as a pre-activated offline installer for Windows and macOS.\n\n` +
      `### Key Highlights\n- Pre-activated lifetime license (no crack/keygen steps)\n- Full offline installer package\n- Supports Windows 10/11 (64-bit) & macOS`,
    icon_url: "/icons/default-app.png",
    android_requirement: "Windows 10/11 (64-bit) & macOS",
    status: "draft",
    mod_features: [
      "Pre-Activated / Lifetime License Unlocked",
      "No Crack or Keygen Required (Auto-Activated)",
      "Full Offline Installer (Windows & macOS)",
      "All Pro Studio Tools & Exports Enabled",
    ],
    version: {
      version_name: customVersion || "2026 Latest",
      version_code: 1,
      file_size: "Varies by OS",
      architecture: "x64 / ARM64 (Win & Mac)",
      android_requirement: "Windows 10/11 & macOS",
      release_notes: "Pre-Activated Windows & macOS release",
      status: "draft",
      download_sources: downloadSources,
    },
  });

  purgeAppCaches(createdApp.slug);
  const { sendDraftPreviewToAdmin } = await import("@/lib/telegram-broadcast");
  await sendDraftPreviewToAdmin(createdApp, adminChatId);
  return createdApp;
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
        { text: "💻 New PC Software", callback_data: "adm_newpc" },
        { text: "📅 Scheduled Queue", callback_data: "adm_scheduled" },
      ],
      [
        { text: "🔍 Search & Edit App", callback_data: "adm_search_app" },
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
    // 0. Telegram Webhook Retry Deduplication
    // Telegram re-sends the exact same update_id if a long background scrape
    // takes longer than Telegram's 5s timeout. Rejecting duplicate updates immediately
    // prevents duplicate execution loops, duplicate messages, and duplicate cards.
    // ==========================================
    const updateId = body?.update_id;
    if (updateId && (await checkAndMarkTelegramUpdate(updateId))) {
      console.log(`[Telegram Webhook] Deduplicated retry for update_id ${updateId}`);
      return NextResponse.json({ ok: true, deduplicated: true, update_id: updateId });
    }

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
        // 1.0 PATCHER STAGED RELEASE ACTIONS (1-Tap Publish / Discard)
        // ==========================================
        if (data.startsWith("stage_pub_")) {
          const verId = data.replace("stage_pub_", "");
          const supabase = getDbClient();
          if (!supabase) {
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cq.id, text: "Database unavailable", show_alert: true }),
            }).catch(() => {});
            return NextResponse.json({ ok: false });
          }

          // Fetch version & app
          const { data: ver, error: verErr } = await supabase
            .from("application_versions")
            .select("*, applications(*), download_sources(*)")
            .eq("id", verId)
            .single();

          if (verErr || !ver) {
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: cq.id, text: "Version not found or already published", show_alert: true }),
            }).catch(() => {});
            return NextResponse.json({ ok: false });
          }

          const app = ver.applications;
          const appName = app?.name || "Application";
          const pkgName = app?.package_name || "";
          const verName = ver.version_name || `v${ver.version_code}`;

          // 1. Mark other versions as is_latest = false
          await supabase
            .from("application_versions")
            .update({ is_latest: false })
            .eq("application_id", ver.application_id);

          // 2. Mark this version as published and is_latest = true
          await supabase
            .from("application_versions")
            .update({ status: "published", is_latest: true })
            .eq("id", verId);

          // 3. Mark application as published
          await supabase
            .from("applications")
            .update({ status: "published", updated_at: new Date().toISOString() })
            .eq("id", ver.application_id);

          purgeAppCaches(app?.slug);

          // 4. Broadcast to Telegram Channel with app logo
          let broadcastSuccess = false;
          try {
            const bRes = await broadcastToTelegram({
              app: {
                ...app,
                latest_version: ver,
                versions: [ver],
              },
              version: ver,
              force: true,
            });
            broadcastSuccess = bRes.success;
          } catch (bErr) {
            console.warn("Broadcast error from bot callback:", bErr);
          }

          // 5. Auto-resolve & archive from Play Store Radar
          let radarArchived = false;
          try {
            if (pkgName) {
              const { getRadarTrackedApps, transitionToModReleased } = await import("@/lib/radar-engine");
              const radarApps = await getRadarTrackedApps();
              const matchedRadarApp = radarApps.find(
                (ra) => (ra.package_name || "").toLowerCase() === pkgName.toLowerCase()
              );
              if (matchedRadarApp) {
                const primarySrc = ver.download_sources?.find((s: any) => s.is_primary)?.download_url;
                await transitionToModReleased({
                  appId: matchedRadarApp.id,
                  adminName: "Telegram Admin (1-Tap)",
                  releasedModVersion: verName,
                  downloadUrl: primarySrc || `${settings.siteUrl || "https://www.awtmods.in"}/download/${app?.slug}`,
                  changelog: ver.release_notes || "Updated to latest version via Patcher",
                });
                radarArchived = true;
              }
            }
          } catch (rErr) {
            console.warn("Radar transition error:", rErr);
          }

          // 6. Notify Community Subscribers
          try {
            const { notifySubscribersOfAppUpdate } = await import("@/lib/telegram-broadcast");
            await notifySubscribersOfAppUpdate(app, ver);
          } catch (nErr) {
            console.warn("Notify subscribers error:", nErr);
          }

          // 7. Answer callback query
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: `🚀 ${appName} (${verName}) published to Live!`,
              show_alert: false,
            }),
          }).catch(() => {});

          // 8. Edit original staged alert message
          const channelHandle = settings.telegramChannelId || "@awtmods";
          const publishedText = [
            `✅ <b>PUBLISHED TO LIVE & CHANNEL!</b>`,
            ``,
            `📱 <b>App:</b> <b>${appName}</b>`,
            `🔢 <b>Version:</b> <code>${verName}</code>`,
            `🌐 <b>Website:</b> <a href="${settings.siteUrl || "https://www.awtmods.in"}/apps/${app?.slug}.html">Live on Site</a>`,
            `📢 <b>Broadcast:</b> ${broadcastSuccess ? `Posted to ${channelHandle}` : "Auto-broadcast completed"}`,
            radarArchived ? `📡 <b>Play Store Radar:</b> Auto-Resolved &amp; Archived ✅` : ``,
            ``,
            `<i>Approved by Admin at ${new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" })} IST</i>`,
          ].filter(Boolean).join("\n");

          if (cq.message?.photo) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message.message_id,
                caption: publishedText,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          } else {
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message.message_id,
                text: publishedText,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }

          return NextResponse.json({ ok: true, published: verId });
        }

        if (data.startsWith("stage_del_")) {
          const verId = data.replace("stage_del_", "");
          const supabase = getDbClient();
          if (supabase) {
            await supabase.from("download_sources").delete().eq("version_id", verId);
            await supabase.from("application_versions").delete().eq("id", verId);
            purgeAppCaches();
          }

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "🗑️ Staged draft discarded.",
            }),
          }).catch(() => {});

          const discardedText = `🗑️ <b>Draft Discarded &amp; Removed from Patcher Queue.</b>`;
          if (cq.message?.photo) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message.message_id,
                caption: discardedText,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          } else {
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message.message_id,
                text: discardedText,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }

          return NextResponse.json({ ok: true, discarded: verId });
        }

        // ==========================================
        // 1.1 Admin Command Center Callbacks
        // ==========================================
        if (data === "adm_menu") {
          const sb = getDbClient();
          if (sb) {
            await sb.from("site_settings").delete().eq("setting_key", `admin_wizard_${adminChatId}`);
          }
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

        if (data === "adm_newpc") {
          const pcPromptText = (
            `💻 <b>One-Tap PC Software Creator</b>\n\n` +
            `Reply with the software name (or <code>Name | Version | Download URL</code>):\n\n` +
            `• <code>Adobe Photoshop 2026</code>\n` +
            `• <code>DaVinci Resolve Studio 21 | v21.0 | https://devuploads.com/...</code>\n\n` +
            `The bot will auto-create the PC draft with <code>.exe</code> ID, OS requirements, and open the preview card.`
          );

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: pcPromptText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "adm_menu" }]],
              },
            }),
          }).catch(() => {});

          const supabase = getDbClient();
          if (supabase) {
            await supabase.from("site_settings").upsert(
              {
                setting_key: `admin_wizard_${adminChatId}`,
                setting_value: {
                  step: "waiting_for_pc_name",
                  appId: "new_pc",
                  promptMessageId: cq.message?.message_id,
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "setting_key" }
            );
          }

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data === "adm_scheduled") {
          const { text: schText, reply_markup } = await buildScheduledQueueView();

          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: schText,
              parse_mode: "HTML",
              reply_markup,
            }),
          }).catch(() => {});

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data.startsWith("q_post:")) {
          const targetAppId = data.slice("q_post:".length);
          let app = await getApplicationById(targetAppId);
          if (app) {
            const supabase = getDbClient();
            if (supabase && app.status !== "published") {
              await supabase.from("applications").update({ status: "published" }).eq("id", targetAppId);
              await supabase.from("application_versions").update({ status: "published" }).eq("application_id", targetAppId);
              purgeAppCaches(app.slug);
              app = (await getApplicationById(targetAppId)) || app;
            }
            await broadcastToTelegram({ app, force: true }).catch(() => {});
            const { getScheduledPosts, saveScheduledPosts } = await import("@/lib/telegram-scheduler");
            const posts = await getScheduledPosts();
            await saveScheduledPosts(
              posts.map((p) =>
                p.appId === targetAppId && p.status === "pending" ? { ...p, status: "published" as const } : p
              )
            );
          }

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id, text: "🚀 Posted to channel now!" }),
          }).catch(() => {});

          const { text: schText, reply_markup } = await buildScheduledQueueView();
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: schText,
              parse_mode: "HTML",
              reply_markup,
            }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data.startsWith("q_plus1h:")) {
          const targetAppId = data.slice("q_plus1h:".length);
          const { getScheduledPosts, scheduleAppPost } = await import("@/lib/telegram-scheduler");
          const posts = await getScheduledPosts();
          const current = posts.find((p) => p.appId === targetAppId && p.status === "pending");
          const baseMs = current ? Math.max(Date.now(), new Date(current.scheduledFor).getTime()) : Date.now();
          const newDate = new Date(baseMs + 60 * 60 * 1000);
          await scheduleAppPost(targetAppId, newDate.toISOString(), adminChatId);

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: `⏰ Rescheduled to ${newDate.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" })} IST`,
            }),
          }).catch(() => {});

          const { text: schText, reply_markup } = await buildScheduledQueueView();
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: schText,
              parse_mode: "HTML",
              reply_markup,
            }),
          }).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        if (data.startsWith("q_cancel:")) {
          const targetAppId = data.slice("q_cancel:".length);
          const { cancelScheduledPost } = await import("@/lib/telegram-scheduler");
          await cancelScheduledPost(targetAppId);

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cq.id, text: "❌ Removed from queue." }),
          }).catch(() => {});

          const { text: schText, reply_markup } = await buildScheduledQueueView();
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              message_id: cq.message?.message_id,
              text: schText,
              parse_mode: "HTML",
              reply_markup,
            }),
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

            // Hide (delete) the draft preview card after publishing
            if (cq.message?.message_id) {
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
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

        // Action: Publish All Drafts in 1 Tap
        if (
          data === "wiz_puball" ||
          data.startsWith("wiz_puball") ||
          action === "wiz_puball" ||
          (action === "wiz" && rest[0] === "puball")
        ) {
          const supabase = getDbClient();
          let publishedCount = 0;
          if (supabase) {
            const { data: updatedApps } = await supabase
              .from("applications")
              .update({ status: "published" })
              .eq("status", "draft")
              .select("id");
            await supabase
              .from("application_versions")
              .update({ status: "published" })
              .eq("status", "draft");
            publishedCount = updatedApps?.length || 0;
            purgeAppCaches();
          }

          const targetChatId = cq.message?.chat?.id || adminChatId;

          // 1. Popup alert on user's device
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: `🎉 Successfully published ${publishedCount > 0 ? publishedCount : "all"} drafts live!`,
              show_alert: true,
            }),
          }).catch(() => {});

          // 2. Update reply markup in-place to show confirmed published status
          if (cq.message?.message_id) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: targetChatId,
                message_id: cq.message.message_id,
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "✅ Published Live on Website", callback_data: "none" },
                    ],
                    [
                      { text: "🌐 View Live Catalog", url: "https://www.awtmods.in/apps" },
                      { text: "📱 Admin Panel", url: "https://www.awtmods.in/admin/apps" },
                    ],
                  ],
                },
              }),
            }).catch(() => {});
          }
          return NextResponse.json({ ok: true, allDraftsPublished: true, publishedCount });
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
              [
                { text: "🗑️ Delete Post", callback_data: `wiz_delete:${app.id}` },
              ],
            ];

            // 3. Update the reply markup buttons directly first so the buttons ALWAYS update in-place
            if (cq.message?.message_id) {
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

            // 4. Also update status line in caption/text if present
            const existingCaption = cq.message?.caption;
            const existingText = cq.message?.text;
            const statusDraftRegex = /📌\s*(?:<b>)?Website Status:?(?:<\/b>)?\s*(?:<code>)?\s*📁?\s*DRAFT(?:\s*\(Unpublished\))?(?:<\/code>)?/i;

            if (existingCaption !== undefined && statusDraftRegex.test(existingCaption)) {
              const updatedCaption = existingCaption.replace(
                statusDraftRegex,
                `📌 <b>Website Status:</b> <code>🌐 PUBLISHED (Live)</code>`
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
            } else if (existingText !== undefined && statusDraftRegex.test(existingText)) {
              const updatedText = existingText.replace(
                statusDraftRegex,
                `📌 <b>Website Status:</b> <code>🌐 PUBLISHED (Live)</code>`
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
              [
                { text: "🗑️ Delete Post", callback_data: `wiz_delete:${app.id}` },
              ],
            ];

            // 3. Update the reply markup buttons directly first so the buttons ALWAYS update in-place
            if (cq.message?.message_id) {
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

            // 4. Also update status line in caption/text if present
            const existingCaption = cq.message?.caption;
            const existingText = cq.message?.text;
            const statusPublishedRegex = /📌\s*(?:<b>)?Website Status:?(?:<\/b>)?\s*(?:<code>)?\s*🌐?\s*PUBLISHED(?:\s*\(Live\))?(?:<\/code>)?/i;

            if (existingCaption !== undefined && statusPublishedRegex.test(existingCaption)) {
              const updatedCaption = existingCaption.replace(
                statusPublishedRegex,
                `📌 <b>Website Status:</b> <code>📁 DRAFT (Unpublished)</code>`
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
            } else if (existingText !== undefined && statusPublishedRegex.test(existingText)) {
              const updatedText = existingText.replace(
                statusPublishedRegex,
                `📌 <b>Website Status:</b> <code>📁 DRAFT (Unpublished)</code>`
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
            }

            return NextResponse.json({ ok: true, draft: true });
          }
        }

        // Action: Wizard Edit Version Code Prompt
        if (action === "wiz_code") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const promptRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
            }).catch(() => null);
            const promptMessageId = promptRes ? (await promptRes.json().catch(() => null))?.result?.message_id : undefined;

            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_version_code", appId, appName: app.name, promptMessageId },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }
          }
        }

        // Action: Wizard Edit App Size Prompt
        if (action === "wiz_size") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const currentSize = app.latest_version?.file_size || "Not set";
            const promptRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
            }).catch(() => null);
            const promptMessageId = promptRes ? (await promptRes.json().catch(() => null))?.result?.message_id : undefined;

            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_size", appId, appName: app.name, promptMessageId },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }
          }
        }

        // Action: Wizard Edit Logo Prompt
        if (action === "wiz_logo") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const promptRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
            }).catch(() => null);
            const promptMessageId = promptRes ? (await promptRes.json().catch(() => null))?.result?.message_id : undefined;

            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_logo", appId, appName: app.name, promptMessageId },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }
          }
        }

        // Action: Wizard Edit Mod Features Prompt
        if (action === "wiz_feat") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          if (app) {
            const promptRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
            }).catch(() => null);
            const promptMessageId = promptRes ? (await promptRes.json().catch(() => null))?.result?.message_id : undefined;

            const supabase = getDbClient();
            if (supabase) {
              await supabase.from("site_settings").upsert(
                {
                  setting_key: `admin_wizard_${adminChatId}`,
                  setting_value: { step: "waiting_for_features", appId, appName: app.name, promptMessageId },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "setting_key" }
              );
            }
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

        // Action: Wizard Delete Post
        if (action === "wiz_delete") {
          const appId = rest[0] || rest.join("_");
          const app = await getApplicationById(appId);
          const appName = app?.name || "Application";
          const appSlug = app?.slug;

          const deleted = await deleteApplication(appId);
          if (deleted) {
            purgeAppCaches(appSlug);
          }

          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: deleted ? `🗑️ Deleted ${appName}` : "App not found or already deleted",
            }),
          }).catch(() => {});

          if (cq.message?.message_id) {
            const deletedMsg = `🗑️ <b>Post Deleted: ${escapeHtml(appName)}</b>\n<i>Removed from website and database.</i>`;
            if (cq.message?.photo) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  caption: deletedMsg,
                  parse_mode: "HTML",
                }),
              }).catch(() => {});
            } else {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  text: deletedMsg,
                  parse_mode: "HTML",
                }),
              }).catch(() => {});
            }
          }
          return NextResponse.json({ ok: true, deleted: appId });
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
                      { text: "📅 Auto-Spread (+1h After Last)", callback_data: `sched_do:${app.id}:spread` },
                    ],
                    [
                      { text: "⏱️ In 15 Mins", callback_data: `sched_do:${app.id}:15` },
                      { text: "⏱️ In 30 Mins", callback_data: `sched_do:${app.id}:30` },
                    ],
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
            const { getScheduledPosts, scheduleAppPost } = await import("@/lib/telegram-scheduler");
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            let targetDate = new Date();
            if (timing === "spread") {
              const pending = (await getScheduledPosts()).filter((p) => p.status === "pending");
              const latestMs = pending.reduce((max, p) => {
                const ms = new Date(p.scheduledFor).getTime();
                return Number.isFinite(ms) && ms > max ? ms : max;
              }, Date.now());
              targetDate = new Date(latestMs + 60 * 60 * 1000);
            } else if (timing === "15") {
              targetDate = new Date(Date.now() + 15 * 60 * 1000);
            } else if (timing === "30") {
              targetDate = new Date(Date.now() + 30 * 60 * 1000);
            } else if (timing === "60") {
              targetDate = new Date(Date.now() + 60 * 60 * 1000);
            } else if (timing === "180") {
              targetDate = new Date(Date.now() + 180 * 60 * 1000);
            } else if (timing === "peak18" || timing === "peak21" || timing === "tomorrow10") {
              const nowIst = new Date(Date.now() + IST_OFFSET_MS);
              if (timing === "peak18") {
                nowIst.setUTCHours(18, 0, 0, 0);
                if (nowIst.getTime() <= Date.now() + IST_OFFSET_MS) {
                  nowIst.setUTCDate(nowIst.getUTCDate() + 1);
                }
              } else if (timing === "peak21") {
                nowIst.setUTCHours(21, 0, 0, 0);
                if (nowIst.getTime() <= Date.now() + IST_OFFSET_MS) {
                  nowIst.setUTCDate(nowIst.getUTCDate() + 1);
                }
              } else if (timing === "tomorrow10") {
                nowIst.setUTCDate(nowIst.getUTCDate() + 1);
                nowIst.setUTCHours(10, 0, 0, 0);
              }
              targetDate = new Date(nowIst.getTime() - IST_OFFSET_MS);
            }

            await scheduleAppPost(app.id, targetDate.toISOString(), adminChatId);

            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cq.id,
                text: `⏰ Scheduled for ${targetDate.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata" })} IST`,
              }),
            }).catch(() => {});

            const scheduledText = (
              `⏰ <b>Telegram Post Scheduled!</b>\n\n` +
              `📦 <b>App:</b> ${app.name}\n` +
              `📅 <b>Scheduled For:</b> <code>${targetDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
              `📢 <b>Target Channel:</b> ${settings.telegramChannelId || "@awtmods"}\n\n` +
              `<i>Website is already live. The bot will broadcast to the Telegram channel at the scheduled time.</i>`
            );

            if (cq.message?.message_id && !cq.message?.photo) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  message_id: cq.message.message_id,
                  text: scheduledText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "🚀 Post Now Instead", callback_data: `broadcast:${app.id}` },
                        { text: "⏭️ Skip Telegram", callback_data: `sched_skip:${app.id}` },
                      ],
                    ],
                  },
                }),
              }).catch(() => {});
            } else {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  text: scheduledText,
                  parse_mode: "HTML",
                }),
              }).catch(() => {});
            }
          }
        }

        if (action === "sched_skip") {
          const appId = rest[0];
          const app = await getApplicationById(appId);
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: "⏭️ Skipped Telegram channel broadcast.",
            }),
          }).catch(() => {});
          if (cq.message?.message_id) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                message_id: cq.message.message_id,
                text: `✅ <b>Website Updated Live</b> (${app?.name || "App"})\n⏭️ <i>Telegram channel broadcast skipped by Admin.</i>`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
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
        const requestedName = decodeURIComponent(data.includes(":") ? data.slice(8) : data.slice(8)).trim();
        if (requestedName) {
          const requester = cq.from?.username
            ? `@${cq.from.username}`
            : cq.from?.first_name
            ? `${cq.from.first_name} (Telegram)`
            : `Telegram User #${fromId}`;

          await createModRequest({
            app_name: requestedName,
            features_requested: "Requested via Telegram Bot (@awtmods_bot)",
            requester_name: requester,
          }).catch((err) => console.error("Failed to save bot mod request:", err));
        }

        const targetUserChat = cq.message?.chat?.id || userChatId;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetUserChat,
            text: (
              `✅ <b>MOD Request Submitted!</b>\n\n` +
              `Our team has received your request for <b>"${requestedName}"</b>.\n` +
              `It is now listed in our community queue on <a href="https://www.awtmods.in/requests">AWTMods.in/requests</a>!\n\n` +
              `Make sure to stay in our channel @awtmods for the release alert.`
            ),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }).catch(() => {});

        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: cq.id,
            text: `✅ Request for "${requestedName}" submitted!`,
            show_alert: true,
          }),
        }).catch(() => {});

        return NextResponse.json({ ok: true, requestSubmitted: requestedName });
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
    // 2.35 CLOUD / STORAGE CHANNEL FORWARDED LINK EXTRACTOR
    // ==========================================================
    const privateCloudChannelId = String(settings.telegramPrivateChannelId || "-1004449242945");
    if (String(chatId) === privateCloudChannelId && !doc) {
      const fullText = (caption || text || "").trim();
      const fileLinkMatch = fullText.match(/File\s*Link(?:\s*\([^)]+\))?\s*:\s*(https?:\/\/[^\s]+)/i);
      const parsedCloud = parseApkReleaseInfo(fullText, fullText, 0);
      const extractedUrl = fileLinkMatch?.[1]?.trim() || parsedCloud.externalUrls[0]?.url;

      if (extractedUrl) {
        const fileNameMatch = fullText.match(/File\s*Name\s*:\s*([^\n\r]+)/i);
        const extractedFileName = (fileNameMatch?.[1] || fullText.split("\n")[0] || "").trim();
        const sizeMatch = fullText.match(/File\s*Size\s*:\s*([^\n\r]+)/i);
        const extractedSize = sizeMatch?.[1]?.trim() || parsedCloud.fileSize;
        const parsedFile = parseApkReleaseInfo(extractedFileName, fullText, 0);

        const { matchedApp, candidates } = await matchApplicationByApk(extractedFileName, fullText);
        const supabaseCloud = getDbClient();

        if (matchedApp && supabaseCloud) {
          // Prefer staged "draft" version in Admin Panel first, then fallback to latest
          let { data: verData } = await supabaseCloud
            .from("application_versions")
            .select("id, version_name, version_code, file_size, release_notes")
            .eq("application_id", matchedApp.id)
            .eq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!verData) {
            const fallbackVer = await supabaseCloud
              .from("application_versions")
              .select("id, version_name, version_code, file_size, release_notes")
              .eq("application_id", matchedApp.id)
              .order("is_latest", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            verData = fallbackVer.data;
          }

          if (verData) {
            const hostingProvider = extractedUrl.includes("t.me")
              ? "telegram"
              : extractedUrl.includes("mediafire.com")
              ? "mediafire"
              : extractedUrl.includes("drive.google.com")
              ? "google_drive"
              : extractedUrl.includes("mega.")
              ? "mega"
              : "custom";
            const mirrorName = extractedUrl.includes("devuploads")
              ? "DevUploads Fast Mirror"
              : extractedUrl.includes("t.me")
              ? "Telegram Channel"
              : "Download Mirror";

            const { data: existingSrc } = await supabaseCloud
              .from("download_sources")
              .select("id")
              .eq("version_id", verData.id)
              .eq("is_primary", true)
              .maybeSingle();

            if (existingSrc) {
              await supabaseCloud
                .from("download_sources")
                .update({
                  download_url: extractedUrl,
                  hosting_provider: hostingProvider,
                  mirror_name: mirrorName,
                  is_active: true,
                  is_primary: true,
                })
                .eq("id", existingSrc.id);
            } else {
              await supabaseCloud.from("download_sources").insert({
                version_id: verData.id,
                download_type: "external",
                hosting_provider: hostingProvider,
                download_url: extractedUrl,
                mirror_name: mirrorName,
                is_primary: true,
                is_active: true,
              });
            }

            const versionUpdates: Record<string, any> = {
              status: "published",
              is_latest: true,
            };
            if (extractedSize && extractedSize !== "Varies with device") {
              versionUpdates.file_size = extractedSize;
            }
            if (parsedFile.versionName && parsedFile.versionName !== "v1.0.0") {
              versionUpdates.version_name = parsedFile.versionName;
            }
            if (parsedFile.versionCode && parsedFile.versionCode > 0) {
              versionUpdates.version_code = parsedFile.versionCode;
            }

            await supabaseCloud
              .from("application_versions")
              .update({ is_latest: false })
              .eq("application_id", matchedApp.id);
            await supabaseCloud
              .from("application_versions")
              .update(versionUpdates)
              .eq("id", verData.id);
            await supabaseCloud
              .from("applications")
              .update({ status: "published", updated_at: new Date().toISOString() })
              .eq("id", matchedApp.id);

            purgeAppCaches(matchedApp.slug);

            // Auto-resolve from Play Store Radar if tracked
            try {
              const pkgLower = (matchedApp.package_name || "").toLowerCase();
              if (pkgLower) {
                const { getRadarTrackedApps, transitionToModReleased } = await import("@/lib/radar-engine");
                const radarApps = await getRadarTrackedApps();
                const matchedRadarApp = radarApps.find(
                  (ra) => (ra.package_name || "").toLowerCase() === pkgLower
                );
                if (matchedRadarApp) {
                  await transitionToModReleased({
                    appId: matchedRadarApp.id,
                    adminName: "Telegram Cloud Channel",
                    releasedModVersion: versionUpdates.version_name || verData.version_name || `v${verData.version_code}`,
                    downloadUrl: extractedUrl,
                    changelog: verData.release_notes || "Updated via Cloud Channel forwarded DevUploads link",
                  });
                }
              }
            } catch (rErr) {
              console.warn("Radar transition error on cloud channel sync:", rErr);
            }

            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const liveAppUrl = `${siteUrl}/apps/${cleanAppSlug(matchedApp.slug)}.html`;
            const finalVer = versionUpdates.version_name || verData.version_name || "Latest";

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: (
                  `☁️ <b>CLOUD CHANNEL LINK SYNCED LIVE!</b>\n\n` +
                  `📱 <b>App:</b> <b>${escapeHtml(matchedApp.name)}</b> (${escapeHtml(finalVer)})\n` +
                  `📁 <b>File:</b> <code>${escapeHtml(extractedFileName)}</code>\n` +
                  `📦 <b>Size:</b> <code>${escapeHtml(extractedSize)}</code>\n` +
                  `🔗 <b>Link:</b> <code>${escapeHtml(extractedUrl)}</code>\n\n` +
                  `<i>Website mirror &amp; version updated automatically!</i>`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "🚀 Post to Telegram Now", callback_data: `broadcast:${matchedApp.id}` },
                      { text: "🌐 View Live App", url: liveAppUrl },
                    ],
                    [
                      { text: "📅 Auto-Spread (+1h After Last)", callback_data: `sched_do:${matchedApp.id}:spread` },
                      { text: "⏭️ Skip", callback_data: `sched_skip:${matchedApp.id}` },
                    ],
                  ],
                },
              }),
            }).catch(() => {});

            return NextResponse.json({ ok: true, cloudChannelSynced: matchedApp.slug });
          }
        } else {
          const candidateNames = candidates.slice(0, 3).map((c) => `• ${escapeHtml(c.name)}`).join("\n");
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text: (
                `⚠️ <b>Cloud Channel Link Detected (No App Match)</b>\n\n` +
                `📁 <b>File:</b> <code>${escapeHtml(extractedFileName)}</code>\n` +
                `🔗 <b>Link:</b> <code>${escapeHtml(extractedUrl)}</code>\n` +
                (candidateNames ? `\n<b>Closest matches:</b>\n${candidateNames}\n` : "") +
                `\n<i>Tip: Use /pc Name | Version | Link to create it quickly.</i>`
              ),
              parse_mode: "HTML",
            }),
          }).catch(() => {});

          return NextResponse.json({ ok: true, cloudChannelUnmatched: extractedFileName });
        }
      }
    }

    // ==========================================================
    // 2.4 ADMIN REPLY TO PATCHER STAGED ALERT (Custom Download Link & Publish)
    // ==========================================================
    const replyTo = message.reply_to_message;
    if (isAuthorized && replyTo) {
      const replyCaption = replyTo.caption || replyTo.text || "";
      if (replyCaption.includes("NEW APK STAGED FROM PATCHER")) {
        const fullMsg = (text || caption || "").trim();
        const foundUrls = fullMsg.match(/(?:https?:\/\/)[^\s]+/gi) || [];
        const newDownloadUrl = foundUrls[0];

        const pkgMatch =
          replyCaption.match(/Package:\s*<[^>]+>([^<]+)<\/[^>]+>/i) ||
          replyCaption.match(/Package:\s*([a-zA-Z0-9._]+)/i);
        const pkgName = pkgMatch ? pkgMatch[1].trim().toLowerCase() : null;

        if (pkgName && newDownloadUrl) {
          const supabase = getDbClient();
          if (supabase) {
            const { data: appData } = await supabase
              .from("applications")
              .select("id, name, slug, package_name, icon_url, banner_url")
              .ilike("package_name", pkgName)
              .maybeSingle();

            if (appData) {
              let { data: verData } = await supabase
                .from("application_versions")
                .select("id, version_name, version_code, release_notes")
                .eq("application_id", appData.id)
                .eq("status", "draft")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!verData) {
                const fallbackVer = await supabase
                  .from("application_versions")
                  .select("id, version_name, version_code, release_notes")
                  .eq("application_id", appData.id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                verData = fallbackVer.data;
              }

              if (verData) {
                // 1. Update or create download source
                const { data: existingSrc } = await supabase
                  .from("download_sources")
                  .select("id")
                  .eq("version_id", verData.id)
                  .maybeSingle();

                if (existingSrc) {
                  await supabase
                    .from("download_sources")
                    .update({
                      download_url: newDownloadUrl,
                      hosting_provider: newDownloadUrl.includes("t.me") ? "telegram" : "custom",
                      mirror_name: newDownloadUrl.includes("t.me") ? "Telegram Channel" : "Download Mirror",
                      is_active: true,
                      is_primary: true,
                    })
                    .eq("id", existingSrc.id);
                } else {
                  await supabase.from("download_sources").insert({
                    version_id: verData.id,
                    download_type: "external",
                    hosting_provider: newDownloadUrl.includes("t.me") ? "telegram" : "custom",
                    download_url: newDownloadUrl,
                    mirror_name: newDownloadUrl.includes("t.me") ? "Telegram Channel" : "Download Mirror",
                    is_primary: true,
                    is_active: true,
                  });
                }

                // 2. Mark other versions as is_latest: false
                await supabase
                  .from("application_versions")
                  .update({ is_latest: false })
                  .eq("application_id", appData.id);

                // 3. Mark version as published
                await supabase
                  .from("application_versions")
                  .update({ status: "published", is_latest: true })
                  .eq("id", verData.id);

                // 4. Mark app as published & bump updated_at so it appears in Latest Releases
                await supabase
                  .from("applications")
                  .update({ status: "published", updated_at: new Date().toISOString() })
                  .eq("id", appData.id);

                purgeAppCaches(appData.slug);

                // 5. Auto-resolve & archive from Play Store Radar
                try {
                  const { getRadarTrackedApps, transitionToModReleased } = await import("@/lib/radar-engine");
                  const radarApps = await getRadarTrackedApps();
                  const matchedRadarApp = radarApps.find(
                    (ra) => (ra.package_name || "").toLowerCase() === pkgName
                  );
                  if (matchedRadarApp) {
                    await transitionToModReleased({
                      appId: matchedRadarApp.id,
                      adminName: "Telegram Admin (Reply)",
                      releasedModVersion: verData.version_name || `v${verData.version_code}`,
                      downloadUrl: newDownloadUrl,
                      changelog: verData.release_notes || "Updated via Patcher with custom download link",
                    });
                  }
                } catch (rErr) {
                  console.warn("Radar transition error on reply publish:", rErr);
                }

                // 6. Ask Admin to Publish Now or Schedule the Telegram Channel Post (do NOT auto-post to Telegram)
                const verLabel = verData.version_name || `v${verData.version_code}`;
                const channelHandle = settings.telegramChannelId || "@awtmods";
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: (
                      `✅ <b>WEBSITE UPDATED LIVE!</b>\n\n` +
                      `📱 <b>App:</b> <b>${escapeHtml(appData.name)}</b> (${escapeHtml(verLabel)})\n` +
                      `🔗 <b>Download URL:</b> <code>${escapeHtml(newDownloadUrl)}</code>\n` +
                      `🌐 <b>Website:</b> Published automatically &amp; Radar resolved\n\n` +
                      `⏰ <b>Schedule Telegram Post (${escapeHtml(channelHandle)}):</b>\n` +
                      `Choose when to broadcast this update to your Telegram channel:`
                    ),
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "🚀 Post to Telegram Now", callback_data: `broadcast:${appData.id}` },
                        ],
                        [
                          { text: "📅 Auto-Spread (+1h After Last)", callback_data: `sched_do:${appData.id}:spread` },
                        ],
                        [
                          { text: "⏱️ In 15 Mins", callback_data: `sched_do:${appData.id}:15` },
                          { text: "⏱️ In 30 Mins", callback_data: `sched_do:${appData.id}:30` },
                        ],
                        [
                          { text: "⏱️ In 1 Hour", callback_data: `sched_do:${appData.id}:60` },
                          { text: "⏱️ In 3 Hours", callback_data: `sched_do:${appData.id}:180` },
                        ],
                        [
                          { text: "🌅 Peak 6:00 PM", callback_data: `sched_do:${appData.id}:peak18` },
                          { text: "🌃 Peak 9:00 PM", callback_data: `sched_do:${appData.id}:peak21` },
                        ],
                        [
                          { text: "☀️ Tomorrow 10:00 AM", callback_data: `sched_do:${appData.id}:tomorrow10` },
                          { text: "⏭️ Skip Telegram", callback_data: `sched_skip:${appData.id}` },
                        ],
                      ],
                    },
                  }),
                }).catch(() => {});

                return NextResponse.json({ ok: true, replyWebsitePublishedAwaitingSchedule: appData.name });
              }
            }
          }
        }

        // Never fall through to Mod Webpage Scraper when replying to a Staged Patcher message
        return NextResponse.json({ ok: true, replyHandledNoMatch: pkgName || null });
      }
    }

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
      if (wiz && wiz.step) {
        // Step 0: One-Tap PC Software Creation
        if (wiz.step === "waiting_for_pc_name" && text && !text.startsWith("/")) {
          await supabase
            .from("site_settings")
            .delete()
            .eq("setting_key", `admin_wizard_${adminChatId}`);
          if (wiz.promptMessageId) {
            await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: adminChatId, message_id: wiz.promptMessageId }),
            }).catch(() => {});
          }
          if (message.message_id) {
            await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: adminChatId, message_id: message.message_id }),
            }).catch(() => {});
          }
          const created = await createPcSoftwareDraftFromTelegram(text, adminChatId);
          return NextResponse.json({ ok: true, createdPcDraft: created?.slug || null });
        }

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
                if (wiz.promptMessageId) {
                  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminChatId, message_id: wiz.promptMessageId }),
                  }).catch(() => {});
                }
                if (message.message_id) {
                  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminChatId, message_id: message.message_id }),
                  }).catch(() => {});
                }
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
                if (wiz.promptMessageId) {
                  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminChatId, message_id: wiz.promptMessageId }),
                  }).catch(() => {});
                }
                if (message.message_id) {
                  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: adminChatId, message_id: message.message_id }),
                  }).catch(() => {});
                }
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
              if (wiz.promptMessageId) {
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: adminChatId, message_id: wiz.promptMessageId }),
                }).catch(() => {});
              }
              if (message.message_id) {
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: adminChatId, message_id: message.message_id }),
                }).catch(() => {});
              }
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
              if (wiz.promptMessageId) {
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: adminChatId, message_id: wiz.promptMessageId }),
                }).catch(() => {});
              }
              if (message.message_id) {
                await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: adminChatId, message_id: message.message_id }),
                }).catch(() => {});
              }
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

    // Filter out direct APK / file-host download links so they aren't treated as Mod webpages to scrape
    const appLinkMatches = allUrls.filter((url: string) => {
      const u = url.toLowerCase();
      return (
        !u.endsWith(".apk") &&
        !u.includes(".apk?") &&
        !u.includes("devuploads.com") &&
        !u.includes("mediafire.com") &&
        !u.includes("mega.nz") &&
        !u.includes("drive.google.com") &&
        !u.includes("t.me/")
      );
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
          const isAlreadyLive = result.wasAlreadyPublished || result.app.status === "published";
          if (isAlreadyLive) {
            const siteUrl = settings.siteUrl || "https://www.awtmods.in";
            const appUrl = `${siteUrl}/apps/${result.app.slug}.html`;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ <b>App Already Live on Website!</b>\n\n📱 <b>${result.app.name}</b> is already published and live.\nMetadata and mod features have been refreshed.\n\n🌐 <a href="${appUrl}">View Live App on Website</a>`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          } else {
            await sendDraftPreviewToAdmin(result.app, adminChatId);
          }
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
        // --- BULK APPS & MODS IMPORT FLOW WITH LIVE PROGRESS ---
        const totalCount = uniqueTargets.length;
        const escapeTgHtml = (str: string) =>
          (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        type ItemStatus = "pending" | "drafted" | "live" | "failed";
        interface ImportProgressItem {
          index: number;
          target: string;
          status: ItemStatus;
          appName?: string;
          error?: string;
        }

        const items: ImportProgressItem[] = uniqueTargets.map((target, idx) => ({
          index: idx + 1,
          target,
          status: "pending",
        }));

        const buildProgressText = (isComplete: boolean = false) => {
          const completedCount = items.filter((i) => i.status !== "pending").length;
          const draftedCount = items.filter((i) => i.status === "drafted").length;
          const liveCount = items.filter((i) => i.status === "live").length;
          const failedCount = items.filter((i) => i.status === "failed").length;
          const pendingCount = items.filter((i) => i.status === "pending").length;

          const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const filled = Math.min(10, Math.round((percent / 100) * 10));
          const empty = 10 - filled;
          const progressBar = "█".repeat(filled) + "░".repeat(empty);

          let msg = isComplete
            ? `🎉 <b>Bulk Mod & App Import Complete!</b>\n`
            : `📦 <b>Bulk Mod & App Import: ${totalCount} links detected!</b>\n`;

          msg += `📊 <b>Progress:</b> [${progressBar}] <b>${percent}%</b> (${completedCount}/${totalCount} completed)\n`;
          msg += `✨ <b>Drafted:</b> ${draftedCount} | 🌐 <b>Live:</b> ${liveCount} | ⏳ <b>Pending:</b> ${pendingCount}\n\n`;

          // If total items <= 20, display all items.
          // If total items > 20, display a sliding window of max 15 items so message NEVER exceeds Telegram's 4096 character limit!
          let displayedItems = items;
          if (items.length > 20) {
            const activeIdx = items.findIndex((i) => i.status === "pending");
            if (activeIdx === -1) {
              // All completed: show last 15 items
              const startIdx = Math.max(0, items.length - 15);
              msg += `<i>... (${startIdx} earlier apps processed) ...</i>\n`;
              displayedItems = items.slice(startIdx);
            } else {
              // Still running: show 4 before active and up to 11 ahead
              const startIdx = Math.max(0, activeIdx - 4);
              const endIdx = Math.min(items.length, startIdx + 15);
              if (startIdx > 0) {
                msg += `<i>... (${startIdx} earlier apps processed) ...</i>\n`;
              }
              displayedItems = items.slice(startIdx, endIdx);
            }
          }

          for (const item of displayedItems) {
            const defaultLabel =
              item.target.match(/id=([a-zA-Z0-9._]+)/i)?.[1] ||
              item.target.replace(/^https?:\/\//i, "").slice(0, 26);
            const safeAppName = escapeTgHtml(
              item.appName ? item.appName.replace(/MOD APK.*$/i, "").trim().slice(0, 32) : defaultLabel
            );

            if (item.status === "drafted") {
              msg += `${item.index}. ✅ <b>Drafted:</b> ${safeAppName}\n`;
            } else if (item.status === "live") {
              msg += `${item.index}. 🌐 <b>Live (Updated):</b> ${safeAppName}\n`;
            } else if (item.status === "failed") {
              msg += `${item.index}. ❌ <b>Failed:</b> <code>${escapeTgHtml(defaultLabel.slice(0, 22))}</code>\n`;
            } else {
              msg += `${item.index}. ⏳ <i>Processing...</i>\n`;
            }
          }

          if (items.length > 20 && displayedItems.length < items.length) {
            const lastShownIndex = displayedItems[displayedItems.length - 1]?.index || items.length;
            const remainingBelow = items.length - lastShownIndex;
            if (remainingBelow > 0) {
              msg += `<i>... (${remainingBelow} more in queue) ...</i>\n`;
            }
          }

          if (isComplete) {
            msg += `\n👤 <b>Developer:</b> Aadith C V\n`;
            if (draftedCount > 0) {
              msg += `✨ <b>New Drafts Ready:</b> ${draftedCount}\n`;
            }
            if (liveCount > 0) {
              msg += `🌐 <b>Already Live / Refreshed:</b> ${liveCount}\n`;
            }
            if (failedCount > 0) {
              msg += `⚠️ <b>Failed Links:</b> ${failedCount}\n`;
            }
            msg += `👉 <a href="https://www.awtmods.in/admin/apps">Manage Apps in Admin Panel</a>`;
          }

          // Strict Telegram 4096 character safety cutoff
          if (msg.length > 3900) {
            msg = msg.slice(0, 3900) + "\n\n<i>[Message truncated to comply with Telegram limits]</i>";
          }

          return msg;
        };

        // Send initial progress message
        let progressMsgId: number | null = null;
        try {
          const initRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: buildProgressText(false),
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });
          const initData = await initRes.json();
          if (initData?.ok && initData.result?.message_id) {
            progressMsgId = initData.result.message_id;
          }
        } catch {}

        const updateTelegramProgress = async (isComplete: boolean = false) => {
          if (!progressMsgId) return;
          try {
            const bodyPayload: any = {
              chat_id: chatId,
              message_id: progressMsgId,
              text: buildProgressText(isComplete),
              parse_mode: "HTML",
              disable_web_page_preview: true,
            };

            if (isComplete) {
              const inlineButtons: any[] = [];
              if (newDrafts.length > 0) {
                inlineButtons.push([
                  { text: `🚀 Publish All ${newDrafts.length} New Drafts Now`, callback_data: `wiz_puball:all` },
                ]);
              }
              inlineButtons.push([
                { text: `📱 Admin Panel`, url: `https://www.awtmods.in/admin/apps` },
                { text: `🌐 View Website`, url: `https://www.awtmods.in/apps` },
              ]);
              bodyPayload.reply_markup = { inline_keyboard: inlineButtons };
            }

            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyPayload),
            });
          } catch {}
        };

        const successfulApps: any[] = [];
        const alreadyLiveApps: any[] = [];
        const newDrafts: any[] = [];
        const failedApps: { target: string; error: string }[] = [];

        // Concurrency chunk size of 8 for high throughput, with a 46s execution time limit
        const CHUNK_SIZE = 8;
        const startTime = Date.now();
        const MAX_RUNTIME_MS = 46000;

        for (let i = 0; i < uniqueTargets.length; i += CHUNK_SIZE) {
          // Check if we are approaching Vercel function timeout
          if (Date.now() - startTime > MAX_RUNTIME_MS) {
            for (let k = i; k < uniqueTargets.length; k++) {
              items[k].status = "failed";
              items[k].error = "Time limit (paste in next batch)";
              failedApps.push({ target: uniqueTargets[k], error: "Time limit reached" });
            }
            break;
          }

          const chunk = uniqueTargets.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (target, chunkIdx) => {
              const globalIdx = i + chunkIdx;
              const item = items[globalIdx];
              try {
                const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
                  setTimeout(() => resolve({ success: false, error: "Scrape timed out (4.5s)" }), 4500)
                );
                const result = await Promise.race([processLink(target), timeoutPromise]);
                if (result.success && result.app) {
                  item.appName = result.app.name;
                  successfulApps.push(result.app);
                  if (result.wasAlreadyPublished || result.app.status === "published") {
                    item.status = "live";
                    alreadyLiveApps.push(result.app);
                  } else {
                    item.status = "drafted";
                    newDrafts.push(result.app);
                  }
                } else {
                  item.status = "failed";
                  item.error = result.error || "Failed to scrape";
                  failedApps.push({ target, error: item.error });
                }
              } catch (err: any) {
                item.status = "failed";
                item.error = err.message || "Scraping failed";
                failedApps.push({ target, error: item.error || "Scraping failed" });
              }
            })
          );

          // Update the progress card in Telegram with current percentage and drafted app names
          await updateTelegramProgress(false);

          if (i + CHUNK_SIZE < uniqueTargets.length) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        // Final completion update for the progress card (100%)
        await updateTelegramProgress(true);

        // For single-link imports (1 target), send the full draft preview card.
        // For bulk imports (> 1 links), DO NOT send extra individual draft preview messages,
        // so the user only gets the clean progress summary card with the "🚀 Publish All New Drafts Now" button.
        if (uniqueTargets.length === 1 && newDrafts.length === 1) {
          await sendDraftPreviewToAdmin(newDrafts[0], adminChatId).catch(() => {});
        }

        // Invalidate website caches so all newly created drafts show up immediately in Admin
        purgeAppCaches();

        return NextResponse.json({
          ok: true,
          bulkImport: true,
          total: totalCount,
          successCount: successfulApps.length,
          newDrafts: newDrafts.length,
          alreadyLive: alreadyLiveApps.length,
          failCount: failedApps.length,
        });
      }
    }

    if (isAuthorized && (hasApkDoc || hasApkText)) {
      const privateChannelId =
        settings.telegramPrivateChannelId || "-1004449242945";
      const publicChannelId = settings.telegramChannelId || "@awtmods";
      const chatUsername = (message.chat?.username || "").toLowerCase();

      // Ignore forwarded/uploaded files inside storage or broadcast channels (e.g. @awtmodsfilescloud)
      // so storing backup APKs in the cloud channel never triggers duplicate DM posts.
      if (
        isChannel &&
        (String(chatId) === String(privateChannelId) ||
          String(chatId) === String(publicChannelId) ||
          chatUsername === "awtmodsfilescloud" ||
          chatUsername === publicChannelId.replace(/^@/, "").toLowerCase())
      ) {
        return NextResponse.json({ ok: true, ignoredStorageChannelPost: true });
      }

      const rawFileName =
        doc?.file_name ||
        caption.match(/([a-zA-Z0-9_\-\.]+\.apk)/i)?.[1] ||
        "app.apk";
      const fileSizeBytes = doc?.file_size || 0;
      const parsed = parseApkReleaseInfo(rawFileName, caption, fileSizeBytes);

      // Derive Telegram message link for direct VIP downloads
      let telegramMessageLink = "";

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
          // Send a single clean Draft Preview card (no duplicate confirmation bubble)
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

    // ==========================================
    // 2.95 Command: /queue (Scheduled Queue Manager)
    // ==========================================
    if (text === "/queue" || text.startsWith("/queue ")) {
      const isAdminUser =
        user?.id === adminChatId ||
        chatId === adminChatId ||
        user?.id === 1343548529 ||
        chatId === 1343548529;
      if (!isAdminUser) {
        return NextResponse.json({ ok: true });
      }
      const { text: schText, reply_markup } = await buildScheduledQueueView();
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: schText,
          parse_mode: "HTML",
          reply_markup,
        }),
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    // ==========================================
    // 2.96 Command: /pc <name> (One-Tap PC Software Draft)
    // ==========================================
    if (text === "/pc" || text.startsWith("/pc ")) {
      const isAdminUser =
        user?.id === adminChatId ||
        chatId === adminChatId ||
        user?.id === 1343548529 ||
        chatId === 1343548529;
      if (!isAdminUser) {
        return NextResponse.json({ ok: true });
      }
      const pcArg = text.replace(/^\/pc\s*/i, "").trim();
      if (!pcArg) {
        const promptRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: (
              `💻 <b>One-Tap PC Software Creator</b>\n\n` +
              `Reply with the software name (or <code>Name | Version | Download URL</code>):\n` +
              `e.g. <code>Adobe Photoshop 2026</code>`
            ),
            parse_mode: "HTML",
          }),
        }).catch(() => null);
        const promptMessageId = promptRes ? (await promptRes.json().catch(() => null))?.result?.message_id : undefined;
        const sb = getDbClient();
        if (sb) {
          await sb.from("site_settings").upsert(
            {
              setting_key: `admin_wizard_${adminChatId}`,
              setting_value: { step: "waiting_for_pc_name", appId: "new_pc", promptMessageId },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "setting_key" }
          );
        }
        return NextResponse.json({ ok: true });
      }

      const created = await createPcSoftwareDraftFromTelegram(pcArg, adminChatId);
      return NextResponse.json({ ok: true, createdPcDraft: created?.slug || null });
    }

    // ==========================================
    // Handle /request or /modrequest command
    // ==========================================
    if (text.startsWith("/request") || text.startsWith("/modrequest")) {
      const parts = text.split(" ");
      const requestedName = parts.slice(1).join(" ").trim();
      const requester = user?.username
        ? `@${user.username}`
        : user?.first_name
        ? `${user.first_name} (Telegram)`
        : `Telegram User #${chatId}`;

      if (requestedName) {
        await createModRequest({
          app_name: requestedName,
          features_requested: "Requested via Telegram Bot /request command",
          requester_name: requester,
        }).catch((err) => console.error("Failed to create mod request from command:", err));

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `✅ <b>MOD Request Submitted!</b>\n\n` +
              `📱 <b>App:</b> <code>${requestedName}</code>\n` +
              `👤 <b>Requester:</b> ${requester}\n\n` +
              `Your request is now live in the <a href="https://www.awtmods.in/requests">Community Requests</a> board on our website! Our team and community can now review and upvote it.`
            ),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: true, requested: requestedName });
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `🙋‍♂️ <b>How to Request an App or Game MOD:</b>\n\n` +
              `Type: <code>/request [App Name]</code>\n\n` +
              `<b>Examples:</b>\n` +
              `• <code>/request Spotify Premium</code>\n` +
              `• <code>/request Minecraft PE</code>\n` +
              `• <code>/request InShot Pro</code>\n\n` +
              `Your request will immediately appear on <a href="https://www.awtmods.in/requests">AWTMods.in/requests</a> and in the Admin Panel!`
            ),
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: true });
      }
    }

    // ==========================================
    // 2.7 /notify Command for Community Updates (Feature 5)
    // ==========================================
    if (text.startsWith("/notify")) {
      const query = text.replace(/^\/notify/i, "").trim();
      if (!query) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `🔔 <b>Get Notified for Mod APK Updates!</b>\n\n` +
              `Subscribe to any app to receive an instant direct message as soon as a new mod version is released.\n\n` +
              `<b>Usage:</b>\n` +
              `<code>/notify &lt;app name or package&gt;</code>\n\n` +
              `<b>Examples:</b>\n` +
              `• <code>/notify PicsArt</code>\n` +
              `• <code>/notify BandLab</code>\n` +
              `• <code>/notify com.appostrophe.scrl</code>`
            ),
            parse_mode: "HTML",
          }),
        }).catch(() => {});
        return NextResponse.json({ ok: true });
      }

      // Search application
      const supabase = getDbClient();
      let matchedApp: any = null;
      if (supabase) {
        const { data: appData } = await supabase
          .from("applications")
          .select("id, name, slug, package_name, icon_url")
          .or(`name.ilike.%${query}%,package_name.ilike.%${query}%,slug.ilike.%${query}%`)
          .limit(1)
          .maybeSingle();

        matchedApp = appData;
      }

      if (matchedApp && user) {
        const { subscribeUserToApp } = await import("@/lib/telegram-vip");
        await subscribeUserToApp(user.id, matchedApp.slug);

        const cleanSlug = cleanAppSlug(matchedApp.slug);
        const appUrl = `${settings.siteUrl || "https://www.awtmods.in"}/apps/${cleanSlug}.html`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `🔔 <b>Subscribed to Update Alerts!</b>\n\n` +
              `You will receive an instant notification right here whenever a new mod version of <b>${escapeHtml(matchedApp.name)}</b> is released!\n\n` +
              `📦 <b>Package:</b> <code>${escapeHtml(matchedApp.package_name || matchedApp.slug)}</code>`
            ),
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `🌐 View ${matchedApp.name.slice(0, 20)} on Website`, url: appUrl },
                ],
              ],
            },
          }),
        }).catch(() => {});
      } else {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: (
              `🔍 Could not find an app matching "<b>${escapeHtml(query)}</b>".\n\n` +
              `Please check the spelling or browse our full catalogue on <a href="${settings.siteUrl || "https://www.awtmods.in"}">AWTMods.in</a>!`
            ),
            parse_mode: "HTML",
          }),
        }).catch(() => {});
      }

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
        let tgSource = version?.download_sources?.find(
          (s: any) => (s.hosting_provider === "telegram" || s.download_url?.includes("t.me")) && (s.storage_key || s.download_url)
        );

        // Fallback 1: Look through all versions of this app for an active telegram file source
        if (!tgSource) {
          for (const v of app.versions || []) {
            const found = v.download_sources?.find(
              (s: any) => (s.hosting_provider === "telegram" || s.download_url?.includes("t.me")) && (s.storage_key || s.download_url)
            );
            if (found) {
              tgSource = found;
              break;
            }
          }
        }

        // Fallback 2: Query Supabase download_sources directly across all versions of this app
        if (!tgSource) {
          try {
            const supabase = getDbClient();
            if (supabase) {
              const allVerIds = (app.versions || []).map((v: any) => v.id).filter(Boolean);
              if (allVerIds.length > 0) {
                const { data: dbSources } = await supabase
                  .from("download_sources")
                  .select("*")
                  .in("version_id", allVerIds)
                  .eq("hosting_provider", "telegram")
                  .order("created_at", { ascending: false });
                if (dbSources && dbSources.length > 0) {
                  tgSource = dbSources.find((s: any) => s.storage_key || s.download_url) || dbSources[0];
                }
              }
            }
          } catch {}
        }

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

        // 3. Fallback: Known Storage Mapping for APKs in private storage channel
        if (!fileSent) {
          const knownAppStorageMap: Record<string, { fileId: string; msgId: number }> = {
            "vpnify": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHmsD4I1j8O6CwzXnzs2ikGVN1ootAAKzIgAC9aIhVN2ZeqHf_BsPPQQ", msgId: 30 },
            "vpnify-vpn-proxy": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHmsD4I1j8O6CwzXnzs2ikGVN1ootAAKzIgAC9aIhVN2ZeqHf_BsPPQQ", msgId: 30 },
            "apple-music": { fileId: "BQACAgUAAyEFAAMBCTIPQQADGWsD4I0yDecksVWBEs2xWKIOVNufAAKuIgAC9aIhVAhNmRYrZQw2PQQ", msgId: 25 },
            "bandlab": { fileId: "BQACAgUAAyEFAAMBCTIPQQADGmsD4I1xp1uPhIrZbKuNmDqgaaU7AAKvIgAC9aIhVGQTuljspAmtPQQ", msgId: 26 },
            "bandlab-mod": { fileId: "BQACAgUAAyEFAAMBCTIPQQADGmsD4I1xp1uPhIrZbKuNmDqgaaU7AAKvIgAC9aIhVGQTuljspAmtPQQ", msgId: 26 },
            "instants": { fileId: "BQACAgUAAyEFAAMBCTIPQQADG2sD4I302KU5J3lUQE5S9x08RyzGAAKwIgAC9aIhVJKdtqW3g3ILPQQ", msgId: 27 },
            "adobe-lightroom": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHGsD4I2UGFI1VBh0O0amLUzvl1mcAAKxIgAC9aIhVAcPQW-1QCQmPQQ", msgId: 28 },
            "lightroom": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHGsD4I2UGFI1VBh0O0amLUzvl1mcAAKxIgAC9aIhVAcPQW-1QCQmPQQ", msgId: 28 },
            "xplayer": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHWsD4I3vEW6arSAgZjF14ATSo1WaAAKyIgAC9aIhVDhxrX97_wspPQQ", msgId: 29 },
            "xplayer-video-player": { fileId: "BQACAgUAAyEFAAMBCTIPQQADHWsD4I3vEW6arSAgZjF14ATSo1WaAAKyIgAC9aIhVDhxrX97_wspPQQ", msgId: 29 },
            "xodo": { fileId: "BQACAgUAAyEFAAMBCTIPQQADH2sD4I0U8u-MHlZFsI-EeHmdyD3vAAK0IgAC9aIhVLFQ-OwmBdRXPQQ", msgId: 31 },
            "xodo-pdf": { fileId: "BQACAgUAAyEFAAMBCTIPQQADH2sD4I0U8u-MHlZFsI-EeHmdyD3vAAK0IgAC9aIhVLFQ-OwmBdRXPQQ", msgId: 31 },
            "voice-changer": { fileId: "BQACAgUAAyEFAAMBCTIPQQADIGsD4I0PTaaBuNe1sFSLw3Foq6OhAAK1IgAC9aIhVI2Uf3G8aPOkPQQ", msgId: 32 },
            "vn-video-editor": { fileId: "BQACAgUAAyEFAAMBCTIPQQADIWsD4I2q-hqYvVg8yUIamUwlMEUUAAK2IgAC9aIhVMDNIt70kl0vPQQ", msgId: 33 },
            "terabox": { fileId: "BQACAgUAAyEFAAMBCTIPQQADImsD4I0s0ZtudUHoDHc4KF3mM3-JAAK3IgAC9aIhVH2VSdJDEVUaPQQ", msgId: 34 },
            "terabox-premium": { fileId: "BQACAgUAAyEFAAMBCTIPQQADImsD4I0s0ZtudUHoDHc4KF3mM3-JAAK3IgAC9aIhVH2VSdJDEVUaPQQ", msgId: 34 },
          };
          const cleanKey = cleanAppSlug(app.slug);
          const matched = knownAppStorageMap[cleanKey] || (targetApp ? knownAppStorageMap[cleanAppSlug(targetApp)] : null);
          if (matched?.fileId) {
            try {
              const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  document: matched.fileId,
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
              console.warn("sendDocument fallback err:", err);
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
          const downloadUrl = `${siteUrl}/apps/${cleanSlug}.html`;

          if (vipStatus.isVip) {
            // VIP USER: Direct APK delivery
            let tgSource = version?.download_sources?.find(
              (s: any) => (s.hosting_provider === "telegram" || s.download_url?.includes("t.me")) && (s.storage_key || s.download_url)
            );

            if (!tgSource) {
              for (const v of targetApp.versions || []) {
                const found = v.download_sources?.find(
                  (s: any) => (s.hosting_provider === "telegram" || s.download_url?.includes("t.me")) && (s.storage_key || s.download_url)
                );
                if (found) {
                  tgSource = found;
                  break;
                }
              }
            }

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

            if (!sentDirect && tgSource?.download_url) {
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
                        `📦 <b>App:</b> ${targetApp.name}\n` +
                        `🏷️ <b>Version:</b> ${version?.version_name || "Latest"}\n\n` +
                        `👑 <i>VIP Pass Active. Tap above to install directly!</i>`
                      ),
                      parse_mode: "HTML",
                    }),
                  });
                  const copyJson = await copyRes.json();
                  sentDirect = copyJson.ok;
                } catch {}
              }
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
