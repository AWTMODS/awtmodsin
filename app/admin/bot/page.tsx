import { getSiteSettings } from "@/lib/db";
import { getVipUsers } from "@/lib/telegram-vip";
import { BotManager } from "@/components/admin/bot-manager";

export const metadata = {
  title: "Telegram Bot & UPI Gateway | AWTMods Admin",
};

export default async function AdminBotPage() {
  const [settings, vipUsers] = await Promise.all([
    getSiteSettings(),
    getVipUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Telegram Bot &amp; VIP Gateway
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage your serverless Telegram bot, dynamic UPI payment QR code, and VIP subscriber access.
        </p>
      </div>

      <BotManager initialSettings={settings} initialVipUsers={vipUsers} />
    </div>
  );
}
