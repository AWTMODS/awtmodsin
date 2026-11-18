import { getDbClient } from "@/lib/db";

// Global in-memory cache for ultra-fast update deduplication across lambdas
const memoryProcessedUpdates = new Map<number, number>();

/**
 * Checks if a Telegram update_id was already processed or is currently in flight.
 * If not processed, locks and records it immediately.
 * Returns true if it's a duplicate retry from Telegram, false if it's fresh.
 */
export async function checkAndMarkTelegramUpdate(updateId?: number): Promise<boolean> {
  if (!updateId || typeof updateId !== "number") return false;

  const now = Date.now();

  // 1. Instant Memory Fast-Path (0ms)
  // Telegram sends retries within 5-30s when a webhook hangs.
  // This blocks concurrent retries on the same or warm lambda instances immediately.
  if (memoryProcessedUpdates.has(updateId)) {
    return true;
  }

  // Mark in memory immediately to lock out any parallel retries
  memoryProcessedUpdates.set(updateId, now);

  // Clean memory entries older than 30 minutes
  if (memoryProcessedUpdates.size > 1000) {
    memoryProcessedUpdates.forEach((ts, id) => {
      if (now - ts > 1800000) {
        memoryProcessedUpdates.delete(id);
      }
    });
  }

  // 2. Cross-Container Database Deduplication
  // Checks Supabase site_settings so even cold serverless instances know this update was seen.
  try {
    const supabase = getDbClient();
    if (supabase) {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "tg_recent_update_ids")
        .maybeSingle();

      let recentIds: number[] = [];
      if (data?.setting_value) {
        try {
          recentIds = Array.isArray(data.setting_value)
            ? data.setting_value
            : JSON.parse(data.setting_value);
        } catch {
          recentIds = [];
        }
      }

      // If already recorded in database
      if (recentIds.includes(updateId)) {
        return true;
      }

      // Prepend this update_id and keep last 100 IDs
      const updatedList = [updateId, ...recentIds.filter((id) => id !== updateId).slice(0, 99)];
      await supabase
        .from("site_settings")
        .upsert(
          {
            setting_key: "tg_recent_update_ids",
            setting_value: JSON.stringify(updatedList),
          },
          { onConflict: "setting_key" }
        );
    }
  } catch (err) {
    // If DB check has an issue, memory deduplication already secured the local process
  }

  return false;
}
