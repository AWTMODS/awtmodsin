import { getDbClient } from "./db";

export interface VipUser {
  userId: number;
  username?: string;
  fullName?: string;
  isVip: boolean;
  vipExpiresAt?: string | null;
  pendingApp?: string | null;
  lastActiveAt: string;
  // Referral System
  referredBy?: number | null;
  referralsCount?: number;
  referredUsers?: number[];
  // Expiry notification tracker
  expiryReminderSentAt?: string | null;
  // Subscribed apps for update alerts
  subscribedApps?: string[];
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

/**
 * Revokes VIP access immediately for a user
 */
export async function revokeUserVip(userId: number): Promise<boolean> {
  const users = await getVipUsers();
  const updatedList = users.map((u) => {
    if (u.userId === userId) {
      return {
        ...u,
        isVip: false,
        vipExpiresAt: null,
        lastActiveAt: new Date().toISOString(),
      };
    }
    return u;
  });

  const supabase = getDbClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_vip_users", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
      return !error;
    } catch (err) {
      console.error("revokeUserVip error:", err);
    }
  }
  return false;
}


/**
 * Extends VIP access by adding N days to existing expiration or now
 */
export async function extendUserVip(userId: number, daysToAdd = 30): Promise<VipUser | null> {
  const users = await getVipUsers();
  const existing = users.find((u) => u.userId === userId);

  let currentExpire = Date.now();
  if (existing?.vipExpiresAt) {
    const parsed = new Date(existing.vipExpiresAt).getTime();
    if (parsed > currentExpire) {
      currentExpire = parsed;
    }
  }

  const newExpire = new Date(currentExpire + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

  let updatedUser: VipUser;
  if (existing) {
    updatedUser = {
      ...existing,
      isVip: true,
      vipExpiresAt: newExpire,
      lastActiveAt: new Date().toISOString(),
    };
  } else {
    updatedUser = {
      userId,
      isVip: true,
      vipExpiresAt: newExpire,
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
      console.error("extendUserVip error:", err);
    }
  }
  return null;
}

/**
 * Permanently removes a user record from the VIP database
 */
export async function deleteVipUser(userId: number): Promise<boolean> {
  const users = await getVipUsers();
  const updatedList = users.filter((u) => u.userId !== userId);

  const supabase = getDbClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_vip_users", setting_value: updatedList },
          { onConflict: "setting_key" }
        );
      return !error;
    } catch (err) {
      console.error("deleteVipUser error:", err);
    }
  }
  return false;
}

/**
 * Saves the full updated list of VIP users to Supabase
 */
export async function saveVipUsers(users: VipUser[]): Promise<boolean> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { setting_key: "telegram_vip_users", setting_value: users },
          { onConflict: "setting_key" }
        );
      return !error;
    } catch (err) {
      console.error("saveVipUsers error:", err);
    }
  }
  return false;
}

/**
 * Records an affiliate referral when a new user starts the bot via ?start=ref_<referrerId>
 */
export async function recordReferral(
  newUserId: number,
  referrerId: number,
  goal = 5,
  rewardDays = 30
): Promise<{
  success: boolean;
  unlockedVip: boolean;
  count: number;
  goal: number;
  referrerUser?: VipUser;
  error?: string;
}> {
  if (newUserId === referrerId) {
    return { success: false, unlockedVip: false, count: 0, goal, error: "Self-referral is not allowed" };
  }

  const users = await getVipUsers();
  const existingNewUser = users.find((u) => u.userId === newUserId);

  // If user already has a referrer, do not count twice
  if (existingNewUser?.referredBy) {
    return { success: false, unlockedVip: false, count: 0, goal, error: "User has already been referred" };
  }

  let referrer = users.find((u) => u.userId === referrerId);
  if (!referrer) {
    referrer = {
      userId: referrerId,
      isVip: false,
      vipExpiresAt: null,
      lastActiveAt: new Date().toISOString(),
      referralsCount: 0,
      referredUsers: [],
    };
  }

  const currentReferredUsers = referrer.referredUsers || [];
  if (currentReferredUsers.includes(newUserId)) {
    return { success: false, unlockedVip: false, count: referrer.referralsCount || 0, goal, error: "Already counted" };
  }

  const newReferredUsers = [...currentReferredUsers, newUserId];
  const newCount = newReferredUsers.length;
  const unlockedVip = newCount >= goal;

  let newVipExpiresAt = referrer.vipExpiresAt;
  let newIsVip = referrer.isVip;

  if (unlockedVip) {
    newIsVip = true;
    const currentExpiry = referrer.vipExpiresAt ? new Date(referrer.vipExpiresAt).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    newVipExpiresAt = new Date(baseTime + rewardDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const updatedReferrer: VipUser = {
    ...referrer,
    referralsCount: newCount,
    referredUsers: newReferredUsers,
    isVip: newIsVip,
    vipExpiresAt: newVipExpiresAt,
  };

  const updatedNewUser: VipUser = existingNewUser
    ? { ...existingNewUser, referredBy: referrerId }
    : {
        userId: newUserId,
        isVip: false,
        vipExpiresAt: null,
        lastActiveAt: new Date().toISOString(),
        referredBy: referrerId,
      };

  const updatedList = [
    updatedReferrer,
    updatedNewUser,
    ...users.filter((u) => u.userId !== referrerId && u.userId !== newUserId),
  ];

  await saveVipUsers(updatedList);

  return {
    success: true,
    unlockedVip,
    count: newCount,
    goal,
    referrerUser: updatedReferrer,
  };
}

/**
 * Returns referral statistics for a user to display in the referral dashboard
 */
export async function getReferralStats(
  userId: number,
  botUsername = "awtmods_bot",
  goal = 5
) {
  const users = await getVipUsers();
  const user = users.find((u) => u.userId === userId);

  const count = user?.referralsCount || (user?.referredUsers?.length ?? 0);
  const remaining = Math.max(0, goal - count);
  const inviteLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  return {
    count,
    goal,
    remaining,
    inviteLink,
    isVip: !!user?.isVip,
    expiresAt: user?.vipExpiresAt,
  };
}

/**
 * Subscribes a user to receive Telegram updates for a specific app
 */
export async function subscribeUserToApp(
  userId: number,
  appSlug: string
): Promise<{ success: boolean; subscribed: boolean; totalApps: number }> {
  const clean = appSlug.toLowerCase().replace(/\.html$/, "");
  const users = await getVipUsers();
  let user = users.find((u) => u.userId === userId);

  if (!user) {
    user = {
      userId,
      isVip: false,
      vipExpiresAt: null,
      lastActiveAt: new Date().toISOString(),
      subscribedApps: [clean],
    };
  } else {
    const subs = new Set(user.subscribedApps || []);
    subs.add(clean);
    user = {
      ...user,
      subscribedApps: Array.from(subs),
      lastActiveAt: new Date().toISOString(),
    };
  }

  const updatedList = [user, ...users.filter((u) => u.userId !== userId)];
  await saveVipUsers(updatedList);

  return {
    success: true,
    subscribed: true,
    totalApps: user.subscribedApps?.length || 1,
  };
}

/**
 * Finds all Telegram user IDs subscribed to a specific app slug
 */
export async function getSubscribersForApp(appSlug: string): Promise<number[]> {
  const clean = appSlug.toLowerCase().replace(/\.html$/, "");
  const users = await getVipUsers();
  return users
    .filter((u) => u.subscribedApps && u.subscribedApps.includes(clean))
    .map((u) => u.userId);
}

/**
 * Checks all VIP users and sends renewal reminders to those expiring in <= 3 days
 */
export async function checkAndSendVipExpiryReminders(token: string): Promise<{
  notifiedCount: number;
  users: number[];
}> {
  if (!token) return { notifiedCount: 0, users: [] };

  const users = await getVipUsers();
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const notifiedUsers: number[] = [];
  let changed = false;

  const updatedList = await Promise.all(
    users.map(async (u) => {
      if (!u.isVip || !u.vipExpiresAt) return u;

      const expireTime = new Date(u.vipExpiresAt).getTime();
      const timeLeft = expireTime - now;

      // If expiring within 3 days (and not already expired)
      if (timeLeft > 0 && timeLeft <= threeDaysMs) {
        // Check if reminder was already sent in the last 4 days
        const lastSent = u.expiryReminderSentAt ? new Date(u.expiryReminderSentAt).getTime() : 0;
        if (now - lastSent > 4 * 24 * 60 * 60 * 1000) {
          const daysLeft = Math.max(1, Math.ceil(timeLeft / (24 * 60 * 60 * 1000)));

          try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: u.userId,
                text: (
                  `⏳ <b>Your AWTMods VIP Membership is Expiring Soon!</b>\n\n` +
                  `Only <b>${daysLeft} day(s) left</b> on your VIP pass (expires: <code>${u.vipExpiresAt.slice(0, 10)}</code>).\n\n` +
                  `Renew today to maintain:\n` +
                  `• ⚡ Instant 1-tap in-chat APK downloads\n` +
                  `• 🚫 Zero ads &amp; zero link shorteners\n` +
                  `• 👑 VIP priority updates\n\n` +
                  `<i>Tap below to renew now or invite friends to get free VIP:</i>`
                ),
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "💳 Renew VIP Now", callback_data: "renew_vip" },
                    ],
                    [
                      { text: "👥 Invite Friends (Get Free VIP)", callback_data: "referral_info" },
                    ],
                  ],
                },
              }),
            });
            notifiedUsers.push(u.userId);
            changed = true;
            return {
              ...u,
              expiryReminderSentAt: new Date().toISOString(),
            };
          } catch (err) {
            console.warn(`Failed to send VIP expiry reminder to ${u.userId}:`, err);
          }
        }
      }

      return u;
    })
  );

  if (changed) {
    await saveVipUsers(updatedList);
  }

  return {
    notifiedCount: notifiedUsers.length,
    users: notifiedUsers,
  };
}

