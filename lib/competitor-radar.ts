import { getDbClient, getSiteSettings, getApplications } from "./db";

export interface CompetitorModAlert {
  appName: string;
  appSlug: string;
  detectedVersion: string;
  currentSiteVersion: string;
  source: string;
  sourceUrl: string;
  detectedAt: string;
}

/**
 * Checks popular modded releases across competitor sources (LiteAPKs, HappyMod, etc.)
 * Only executes if competitorRadarEnabled is turned ON in Admin Panel settings.
 */
export async function checkCompetitorModReleases(options?: {
  limit?: number;
  notifyTelegram?: boolean;
}): Promise<{
  enabled: boolean;
  scanned: number;
  alertsFound: number;
  alerts: CompetitorModAlert[];
}> {
  const settings = await getSiteSettings();

  if (!settings.competitorRadarEnabled) {
    return { enabled: false, scanned: 0, alertsFound: 0, alerts: [] };
  }

  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = settings.telegramAdminChatId || 1343548529;

  // Retrieve cached competitor alert state to avoid spamming the same update
  const supabase = getDbClient();
  let seenAlerts: Record<string, string> = {};
  if (supabase) {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "competitor_radar_state")
        .single();
      if (data?.setting_value && typeof data.setting_value === "object") {
        seenAlerts = data.setting_value as Record<string, string>;
      }
    } catch {}
  }

  // Fetch our top apps
  const limit = options?.limit || 15;
  const { applications: apps } = await getApplications({
    status: "published",
    limit,
    sortBy: "downloads",
  });

  const alerts: CompetitorModAlert[] = [];
  const updatedSeen = { ...seenAlerts };

  for (const app of apps) {
    const currentVer = app.latest_version?.version_name || "v1.0.0";
    const cleanSlug = app.slug.replace(/\.html$/, "");

    // Check competitor source feeds / search endpoints
    try {
      // Simulate/scrape search on trusted open mod catalogs
      const searchUrl = `https://liteapks.com/?s=${encodeURIComponent(app.name.replace(/mod.*$/i, "").trim())}`;
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6000),
      }).catch(() => null);

      if (res && res.ok) {
        const html = await res.text();
        // Look for version pattern in search results
        const verMatch = html.match(/(?:v|version\s*)([0-9]+(?:\.[0-9]+)+)/i);
        const linkMatch = html.match(/href="(https:\/\/liteapks\.com\/[^"]+)"/i);

        if (verMatch && linkMatch) {
          const detectedVer = `v${verMatch[1]}`;
          const modUrl = linkMatch[1];
          const cacheKey = `${cleanSlug}_${detectedVer}`;

          // Check if version is different/newer and not already alerted
          if (detectedVer !== currentVer && !seenAlerts[cacheKey]) {
            const alertItem: CompetitorModAlert = {
              appName: app.name,
              appSlug: cleanSlug,
              detectedVersion: detectedVer,
              currentSiteVersion: currentVer,
              source: "LiteAPKs",
              sourceUrl: modUrl,
              detectedAt: new Date().toISOString(),
            };
            alerts.push(alertItem);
            updatedSeen[cacheKey] = alertItem.detectedAt;

            // Notify Admin via Telegram
            if (options?.notifyTelegram && token && adminChatId) {
              await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: adminChatId,
                  text: (
                    `🔥 <b>Competitor Mod Update Detected!</b>\n\n` +
                    `📱 <b>App:</b> ${app.name}\n` +
                    `🏷️ <b>Competitor Mod:</b> <code>${detectedVer}</code>\n` +
                    `🌐 <b>AWTMods Current:</b> <code>${currentVer}</code>\n` +
                    `📡 <b>Source:</b> LiteAPKs\n\n` +
                    `<i>Tap below to auto-scrape this mod and prepare draft post for AWTMods:</i>`
                  ),
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "⚡ Auto-Import & Scrape Mod",
                          callback_data: `import_mod:${encodeURIComponent(modUrl)}`,
                        },
                      ],
                      [
                        {
                          text: "🔗 View Competitor Page",
                          url: modUrl,
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
    } catch {}
  }

  // Save radar state
  if (supabase && Object.keys(updatedSeen).length !== Object.keys(seenAlerts).length) {
    try {
      await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "competitor_radar_state", setting_value: updatedSeen },
          { onConflict: "setting_key" }
        );
    } catch {}
  }

  return {
    enabled: true,
    scanned: apps.length,
    alertsFound: alerts.length,
    alerts,
  };
}
