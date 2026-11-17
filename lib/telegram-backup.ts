import { getDbClient, getSiteSettings } from "./db";

/**
 * Creates a complete JSON snapshot of all Supabase database tables and delivers it
 * directly to the Admin or Storage Channel on Telegram as a downloadable document.
 */
export async function sendDatabaseBackupToTelegram(
  targetChatId?: string | number
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  stats?: { apps: number; versions: number; categories: number };
}> {
  try {
    const settings = await getSiteSettings();
    const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = targetChatId || settings.telegramAdminChatId || 1343548529;

    if (!token) {
      return { success: false, error: "Telegram bot token is not configured" };
    }

    const supabase = getDbClient();
    if (!supabase) {
      return { success: false, error: "Database client is unavailable" };
    }

    // Fetch all primary database tables
    const [appsRes, versionsRes, categoriesRes, settingsRes] = await Promise.all([
      supabase.from("applications").select("*").limit(2000),
      supabase.from("application_versions").select("*").limit(3000),
      supabase.from("app_categories").select("*"),
      supabase.from("site_settings").select("*"),
    ]);

    const apps = appsRes.data || [];
    const versions = versionsRes.data || [];
    const categories = categoriesRes.data || [];
    const settingsRows = settingsRes.data || [];

    const dateStr = new Date().toISOString().slice(0, 10);
    const backupData = {
      backupDate: new Date().toISOString(),
      generator: "AWTMods Automated Backup Engine",
      siteUrl: settings.siteUrl || "https://www.awtmods.in",
      stats: {
        totalApplications: apps.length,
        totalVersions: versions.length,
        totalCategories: categories.length,
        totalSettingsEntries: settingsRows.length,
      },
      tables: {
        applications: apps,
        application_versions: versions,
        app_categories: categories,
        site_settings: settingsRows,
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const filename = `awtmods_backup_${dateStr}.json`;

    // Construct Multipart FormData to deliver .json file to Telegram
    const formData = new FormData();
    formData.append("chat_id", String(adminChatId));
    formData.append(
      "caption",
      (
        `💾 <b>AWTMods Automated Database Backup Complete!</b>\n\n` +
        `📅 <b>Date:</b> <code>${dateStr}</code>\n` +
        `📦 <b>Applications:</b> ${apps.length}\n` +
        `🏷️ <b>Versions:</b> ${versions.length}\n` +
        `📁 <b>Categories:</b> ${categories.length}\n` +
        `⚙️ <b>Settings Entries:</b> ${settingsRows.length}\n\n` +
        `<i>Complete JSON snapshot attached. Store in a safe archive.</i>`
      )
    );
    formData.append("parse_mode", "HTML");

    const jsonBlob = new Blob([jsonString], { type: "application/json" });
    formData.append("document", jsonBlob, filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || "Telegram rejected the backup document" };
    }

    return {
      success: true,
      message: `Database backup (${filename}) sent to Telegram!`,
      stats: {
        apps: apps.length,
        versions: versions.length,
        categories: categories.length,
      },
    };
  } catch (err: any) {
    console.error("sendDatabaseBackupToTelegram error:", err);
    return { success: false, error: err.message || "Backup generation failed" };
  }
}
