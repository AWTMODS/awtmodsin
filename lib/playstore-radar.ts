import { revalidatePath } from "next/cache";
import { getDbClient, getSiteSettings, getApplicationById } from "@/lib/db";
import { isNewerVersion } from "./version-comparator";

// Dynamic import helper for google-play-scraper
async function getGPlay() {
  const mod = await import("google-play-scraper");
  return (mod as any).default || mod;
}

export interface RadarAppUpdate {
  appId: string;
  appName: string;
  slug: string;
  packageName: string;
  currentModVersion: string;
  playStoreVersion: string;
  changelog?: string;
  detectedAt: string;
  lastNotifiedAt?: string;
  lastNotifiedVersion?: string;
  isMuted?: boolean;
}

export interface RadarState {
  lastScanAt: string;
  totalChecked: number;
  updatesCount: number;
  updates: Record<string, RadarAppUpdate>; // keyed by appId
}

const RADAR_SETTING_KEY = "playstore_radar_state";

/**
 * Retrieves the current Radar status from site_settings
 */
export async function getRadarState(): Promise<RadarState> {
  const supabase = getDbClient();
  if (!supabase) {
    return { lastScanAt: "", totalChecked: 0, updatesCount: 0, updates: {} };
  }

  const { data } = await supabase
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", RADAR_SETTING_KEY)
    .maybeSingle();

  if (data?.setting_value) {
    return data.setting_value as RadarState;
  }

  return { lastScanAt: "", totalChecked: 0, updatesCount: 0, updates: {} };
}

/**
 * Saves Radar status into site_settings
 */
export async function saveRadarState(state: RadarState): Promise<void> {
  const supabase = getDbClient();
  if (!supabase) return;

  await supabase.from("site_settings").upsert(
    {
      setting_key: RADAR_SETTING_KEY,
      setting_value: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );

  try {
    revalidatePath("/admin");
    revalidatePath("/admin/apps");
  } catch {}
}

/**
 * Sends rich interactive Telegram alert to Admin
 */
export async function sendRadarAlertToAdmin(params: {
  app: any;
  currentVersion: string;
  newVersion: string;
  changelog?: string;
  adminChatId: number;
  botToken: string;
}): Promise<boolean> {
  const { app, currentVersion, newVersion, changelog, adminChatId, botToken } = params;

  const storeUrl = `https://play.google.com/store/apps/details?id=${app.package_name}`;

  const cleanChangelog = changelog
    ? changelog.replace(/<[^>]*>/g, "").trim().slice(0, 280)
    : "";

  const alertText = [
    `🚨 <b>PLAY STORE UPDATE DETECTED!</b>`,
    ``,
    `📦 <b>App:</b> ${app.name}`,
    `🏷️ <b>Current Mod on Site:</b> <code>${currentVersion}</code>`,
    `🚀 <b>New on Google Play:</b> <code>v${newVersion}</code>`,
    `🆔 <b>Package:</b> <code>${app.package_name}</code>`,
    cleanChangelog ? `\n📝 <b>What's New:</b>\n<i>${cleanChangelog}</i>` : ``,
    ``,
    `⏰ <b>Detected At:</b> ${new Date().toLocaleTimeString()} UTC`,
  ]
    .filter(Boolean)
    .join("\n");

  const inlineKeyboard = [
    [
      {
        text: `⚡ Quick Release v${newVersion}`,
        callback_data: `rdr_rel:${app.id}:${newVersion}`,
      },
    ],
    [
      {
        text: `📝 Auto-Draft Post (v${newVersion})`,
        callback_data: `rdr_draft:${app.id}:${newVersion}`,
      },
    ],
    [
      {
        text: `🔗 Open on Google Play`,
        url: storeUrl,
      },
      {
        text: `🔕 Mute Alert`,
        callback_data: `rdr_mute:${app.id}:${newVersion}`,
      },
    ],
  ];

  let sent = false;
  const photoUrl = app.icon_url;

  if (photoUrl && (photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          photo: photoUrl,
          caption: alertText.slice(0, 1024),
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      });
      const data = await res.json();
      sent = data.ok;
    } catch {
      // Fallback to sendMessage
    }
  }

  if (!sent) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: alertText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      });
      const data = await res.json();
      sent = data.ok;
    } catch (err) {
      console.error("sendRadarAlertToAdmin error:", err);
    }
  }

  return sent;
}

/**
 * Scans all applications for updates on Google Play Store
 */
export async function checkPlayStoreUpdates(options?: {
  limit?: number;
  notifyTelegram?: boolean;
}): Promise<{
  checked: number;
  updatesFound: number;
  updates: RadarAppUpdate[];
}> {
  const supabase = getDbClient();
  if (!supabase) {
    return { checked: 0, updatesFound: 0, updates: [] };
  }

  const settings = await getSiteSettings();
  const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = settings.telegramAdminChatId
    ? parseInt(settings.telegramAdminChatId, 10)
    : 1343548529;

  const shouldNotify = options?.notifyTelegram !== false && !!botToken && !!adminChatId;

  // 1. Fetch apps with package_name
  const { data: apps, error } = await supabase
    .from("applications")
    .select(`
      id,
      name,
      slug,
      package_name,
      icon_url,
      versions:application_versions(
        id,
        version_name,
        version_code,
        file_size,
        is_latest,
        created_at
      )
    `)
    .not("package_name", "is", null);

  if (error || !apps || apps.length === 0) {
    return { checked: 0, updatesFound: 0, updates: [] };
  }

  const validApps = apps.filter((app: any) => {
    const pkg = app.package_name;
    return (
      pkg &&
      pkg.includes(".") &&
      !pkg.startsWith("com.awt") &&
      pkg.length > 4
    );
  });

  const scanLimit = options?.limit || validApps.length;
  const targetApps = validApps.slice(0, scanLimit);

  const gplay = await getGPlay();
  const currentState = await getRadarState();
  const currentUpdates = { ...currentState.updates };

  const detectedUpdates: RadarAppUpdate[] = [];

  // 2. Iterate in fast parallel batches of 12 for high speed & low latency
  const batchSize = 12;
  for (let i = 0; i < targetApps.length; i += batchSize) {
    const batch = targetApps.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (app: any) => {
        try {
          // Fetch details with 3.5s timeout per app to prevent serverless stalls
          const detail = await Promise.race([
            gplay.app({ appId: app.package_name }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
          ]).catch(() => null);
          if (!detail || !detail.version || detail.version === "VARY") return;

          const playStoreVer = String(detail.version).trim();
          const verList = Array.isArray(app.versions)
            ? app.versions
            : Array.isArray(app.latest_version)
            ? app.latest_version
            : app.latest_version
            ? [app.latest_version]
            : [];

          // Identify true latest version on website (is_latest, highest versionCode, or newest)
          const verObj =
            verList.find((v: any) => v.is_latest) ||
            [...verList].sort((a: any, b: any) => {
              if (b.version_code && a.version_code && b.version_code !== a.version_code) {
                return b.version_code - a.version_code;
              }
              return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            })[0];

          const currentModVer = verObj?.version_name || "v1.0.0";

          if (isNewerVersion(playStoreVer, currentModVer)) {
            const existingUpdate = currentUpdates[app.id];

            const updateInfo: RadarAppUpdate = {
              appId: app.id,
              appName: app.name,
              slug: app.slug,
              packageName: app.package_name,
              currentModVersion: currentModVer,
              playStoreVersion: playStoreVer,
              changelog: detail.recentChanges || "",
              detectedAt: new Date().toISOString(),
              lastNotifiedAt: existingUpdate?.lastNotifiedAt,
              lastNotifiedVersion: existingUpdate?.lastNotifiedVersion,
              isMuted: existingUpdate?.isMuted || false,
            };

            currentUpdates[app.id] = updateInfo;
            detectedUpdates.push(updateInfo);

            // Notify Admin via Telegram Bot if not muted and not already notified for this version
            if (
              shouldNotify &&
              !updateInfo.isMuted &&
              existingUpdate?.lastNotifiedVersion !== playStoreVer
            ) {
              const notified = await sendRadarAlertToAdmin({
                app,
                currentVersion: currentModVer,
                newVersion: playStoreVer,
                changelog: detail.recentChanges,
                adminChatId,
                botToken: botToken!,
              });

              if (notified) {
                updateInfo.lastNotifiedAt = new Date().toISOString();
                updateInfo.lastNotifiedVersion = playStoreVer;
              }
            }
          } else {
            // App is up to date, clear any active update
            if (currentUpdates[app.id]) {
              delete currentUpdates[app.id];
            }
          }
        } catch {
          // Ignore individual app lookup errors (e.g. geo-restricted apps)
        }
      })
    );

    // Progressive save every 2 batches so progress and timestamps are never lost
    if ((i / batchSize) % 2 === 0 || i + batchSize >= targetApps.length) {
      await saveRadarState({
        lastScanAt: new Date().toISOString(),
        totalChecked: Math.min(i + batch.length, targetApps.length),
        updatesCount: Object.keys(currentUpdates).length,
        updates: currentUpdates,
      }).catch(() => {});
    }

    // Minor delay between batches to respect Google Play rate limits
    if (i + batchSize < targetApps.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const newState: RadarState = {
    lastScanAt: new Date().toISOString(),
    totalChecked: targetApps.length,
    updatesCount: Object.keys(currentUpdates).length,
    updates: currentUpdates,
  };

  await saveRadarState(newState);

  return {
    checked: targetApps.length,
    updatesFound: detectedUpdates.length,
    updates: detectedUpdates,
  };
}
