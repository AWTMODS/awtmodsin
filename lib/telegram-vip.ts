import { getDbClient } from "./db";

export interface VipUser {
  userId: number;
  username?: string;
  fullName?: string;
  isVip: boolean;
  vipExpiresAt?: string | null;
  pendingApp?: string | null;
  lastActiveAt: string;
}

/**
 * Retrieves all registered Telegram VIP users from Supabase
 */
export async function getVipUsers(): Promise<VipUser[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "telegram_vip_users")
        .single();

      if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
        return data.setting_value as VipUser[];
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

/**
 * Checks if a specific Telegram user currently has an active VIP pass
 */
export async function isUserVip(userId: number): Promise<{
  isVip: boolean;
  expiresAt?: string | null;
  pendingApp?: string | null;
  user?: VipUser;
}> {
  const users = await getVipUsers();
  const found = users.find((u) => u.userId === userId);

  if (!found || !found.isVip || !found.vipExpiresAt) {
    return { isVip: false, pendingApp: found?.pendingApp, user: found };
  }

  const expireTime = new Date(found.vipExpiresAt).getTime();
  const now = Date.now();

  if (now > expireTime) {
    // Expired
    return { isVip: false, expiresAt: found.vipExpiresAt, pendingApp: found.pendingApp, user: found };
  }

  return { isVip: true, expiresAt: found.vipExpiresAt, pendingApp: found.pendingApp, user: found };
}

/**
 * Saves a user's pending requested app when they open the bot via deep-link
 */
export async function recordUserInteraction(
  userId: number,
  details: { username?: string; fullName?: string; pendingApp?: string | null }
): Promise<VipUser> {
  const users = await getVipUsers();
  const existing = users.find((u) => u.userId === userId);

  let updatedUser: VipUser;
  if (existing) {
    updatedUser = {
      ...existing,
      username: details.username || existing.username,
      fullName: details.fullName || existing.fullName,
      pendingApp: details.pendingApp !== undefined ? details.pendingApp : existing.pendingApp,
      lastActiveAt: new Date().toISOString(),
    };
  } else {
    updatedUser = {
      userId,
      username: details.username,
      fullName: details.fullName,
      isVip: false,
      vipExpiresAt: null,
      pendingApp: details.pendingApp || null,
      lastActiveAt: new Date().toISOString(),
    };
  }

  const updatedList = [
    updatedUser,
    ...users.filter((u) => u.userId !== userId),
  ];

  const supabase = getDbClient();
  if (supabase) {
    try {
      await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_vip_users", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
    } catch (err) {
      console.error("recordUserInteraction error:", err);
    }
  }

  return updatedUser;
}

/**
 * Grants or extends VIP access for 30 days
 */
export async function activateUserVip(
  userId: number,
  days = 30
): Promise<VipUser | null> {
  const users = await getVipUsers();
  const existing = users.find((u) => u.userId === userId);

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  let updatedUser: VipUser;
  if (existing) {
    updatedUser = {
      ...existing,
      isVip: true,
      vipExpiresAt: expiresAt,
      lastActiveAt: new Date().toISOString(),
    };
  } else {
    updatedUser = {
      userId,
      isVip: true,
      vipExpiresAt: expiresAt,
      lastActiveAt: new Date().toISOString(),
    };
  }

  const updatedList = [
    updatedUser,
    ...users.filter((u) => u.userId !== userId),
  ];

  const supabase = getDbClient();
  if (supabase) {
    try {
      await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_vip_users", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
      return updatedUser;
    } catch (err) {
      console.error("activateUserVip error:", err);
    }
  }

  return null;
}
