"use client";

import { useState } from "react";
import { SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  Save,
  Loader2,
  Send,
  Zap,
  Eye,
  EyeOff,
  DollarSign,
  Smartphone,
  Laptop,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

export function SettingsManager({
  initialSettings,
}: {
  initialSettings: SiteSettings;
}) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [connectingWebhook, setConnectingWebhook] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const handleConnectWebhook = async () => {
    if (!settings.telegramBotToken) {
      toast.error("Please enter a Telegram Bot Token first.");
      return;
    }
    setConnectingWebhook(true);
    try {
      // First save settings
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const res = await fetch("/api/telegram/set-webhook", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set webhook");
      }
      toast.success(data.message || "Webhook activated successfully! Bot runs 24/7 with No VPS.");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect webhook");
    } finally {
      setConnectingWebhook(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken) {
      toast.error("Please enter a Telegram Bot Token first.");
      return;
    }
    setTestingBot(true);
    try {
      // First save settings so the server has the latest token
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const res = await fetch("/api/admin/telegram-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          targetChat: settings.telegramChannelId || "@awtmods",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to deliver test message");
      }
      toast.success(data.message || "Test message sent to Telegram successfully!");
    } catch (err: any) {
      toast.error(err.message || "Telegram test failed");
    } finally {
      setTestingBot(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      toast.success("Settings updated successfully!");
    } catch {
      toast.error("Failed to update site settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      {/* General Settings */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
        <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
          General Platform Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Site Name
            </label>
            <Input
              value={settings.siteName}
              onChange={(e) =>
                setSettings({ ...settings, siteName: e.target.value })
              }
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Contact Email
            </label>
            <Input
              value={settings.contactEmail}
              onChange={(e) =>
                setSettings({ ...settings, contactEmail: e.target.value })
              }
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-foreground">
              Tagline
            </label>
            <Input
              value={settings.tagline}
              onChange={(e) =>
                setSettings({ ...settings, tagline: e.target.value })
              }
              className="rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-foreground">
              Site Description
            </label>
            <Textarea
              rows={2}
              value={settings.siteDescription}
              onChange={(e) =>
                setSettings({ ...settings, siteDescription: e.target.value })
              }
              className="rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Social Communities */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
        <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
          Social & Channel Links
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Telegram Channel URL
            </label>
            <Input
              value={settings.telegramUrl}
              onChange={(e) =>
                setSettings({ ...settings, telegramUrl: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Instagram Profile URL
            </label>
            <Input
              value={settings.instagramUrl}
              onChange={(e) =>
                setSettings({ ...settings, instagramUrl: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              YouTube Channel URL
            </label>
            <Input
              value={settings.youtubeUrl}
              onChange={(e) =>
                setSettings({ ...settings, youtubeUrl: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Twitter / X URL
            </label>
            <Input
              value={settings.twitterUrl}
              onChange={(e) =>
                setSettings({ ...settings, twitterUrl: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Telegram Join Modal (Growth Popup) */}
      <div className="rounded-3xl border border-sky-500/20 bg-sky-500/5 p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <h3 className="font-bold text-base text-foreground">
                Telegram Join Popup (Community Growth Widget)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Displays a modern, high-converting Telegram channel join bottom sheet / modal to website visitors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  try {
                    localStorage.removeItem("awtmods_tg_joined");
                    localStorage.removeItem("awtmods_tg_snooze_until");
                  } catch {}
                  window.dispatchEvent(new CustomEvent("awtmods_open_tg_popup"));
                  toast.info("Triggered Telegram Join Popup preview!");
                }
              }}
              className="rounded-xl border-sky-500/40 text-xs font-semibold gap-1.5 hover:bg-sky-500/10 text-foreground"
            >
              <span>Preview Live Popup</span>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.telegramPopupEnabled !== false}
              onChange={(e) =>
                setSettings({ ...settings, telegramPopupEnabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-500 bg-background"
            />
            <div>
              <span className="text-xs font-semibold text-foreground">
                Enable Telegram Join Popup
              </span>
              <p className="text-[11px] text-muted-foreground">
                When enabled, visitors are prompted to join your official Telegram channel after a short delay.
              </p>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Display Delay (Seconds)
              </label>
              <Input
                type="number"
                min={1}
                max={60}
                value={settings.telegramPopupDelay ?? 3}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    telegramPopupDelay: parseInt(e.target.value) || 3,
                  })
                }
                className="rounded-xl text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Delay after page load before opening (default: 3s).
              </p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-foreground">
                Popup Title
              </label>
              <Input
                value={settings.telegramPopupTitle ?? "Join our Telegram"}
                onChange={(e) =>
                  setSettings({ ...settings, telegramPopupTitle: e.target.value })
                }
                className="rounded-xl text-xs"
                placeholder="Join our Telegram"
              />
            </div>

            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-semibold uppercase text-foreground">
                Popup Subtitle / Description
              </label>
              <Input
                value={
                  settings.telegramPopupDesc ??
                  "Get new premium unlocked apps first, plus update alerts and support from the community."
                }
                onChange={(e) =>
                  setSettings({ ...settings, telegramPopupDesc: e.target.value })
                }
                className="rounded-xl text-xs"
                placeholder="Get new premium unlocked apps first, plus update alerts and support from the community."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Download Preferences */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
        <h3 className="font-bold text-base text-foreground pb-2 border-b border-border">
          Download Flow & Mirror Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Countdown Delay (Seconds)
            </label>
            <Input
              type="number"
              min={0}
              max={30}
              value={settings.countdownSeconds}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  countdownSeconds: parseInt(e.target.value, 10) || 5,
                })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.allowDirectUploads}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowDirectUploads: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-border"
              />
              <span>Enable Direct APK Storage Uploads (R2 / S3)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Telegram VIP & Auto-Poster Section */}
      <div className="rounded-3xl border-2 border-sky-500/30 bg-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
          <div className="space-y-0.5">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Send className="h-4 w-4 text-sky-400" />
              <span>Telegram Bot &amp; Channel Auto-Poster</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Automate channel releases and manage the @{settings.telegramBotUsername || "awtmods_bot"} VIP payment gateway.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnectWebhook}
              disabled={connectingWebhook || !settings.telegramBotToken}
              className="rounded-xl border-emerald-500/40 text-xs font-semibold gap-1.5 hover:bg-emerald-500/10 text-foreground"
              title="Connects Telegram to Vercel via Serverless Webhooks - Runs 24/7 with zero VPS"
            >
              {connectingWebhook ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-emerald-400 fill-current" />
              )}
              <span>Activate 24/7 Webhook (No VPS)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              disabled={testingBot || !settings.telegramBotToken}
              className="rounded-xl border-sky-500/40 text-xs font-semibold gap-1.5 hover:bg-sky-500/10 text-foreground"
            >
              {testingBot ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              ) : (
                <Radio className="h-3.5 w-3.5 text-sky-400" />
              )}
              <span>Send Test Message</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bot Token */}
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-foreground">
                Telegram Bot Token (@BotFather)
              </label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showToken ? "Hide Token" : "Show Token"}</span>
              </button>
            </div>
            <Input
              type={showToken ? "text" : "password"}
              placeholder="e.g. 7123456789:AAHxyz..."
              value={settings.telegramBotToken || ""}
              onChange={(e) =>
                setSettings({ ...settings, telegramBotToken: e.target.value.trim() })
              }
              className="rounded-xl text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Saved securely in your private database. Never exposed to public website visitors.
            </p>
          </div>

          {/* Public Channel ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Public Auto-Post Channel
            </label>
            <Input
              placeholder="@awtmods"
              value={settings.telegramChannelId || "@awtmods"}
              onChange={(e) =>
                setSettings({ ...settings, telegramChannelId: e.target.value.trim() })
              }
              className="rounded-xl text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Channel username (e.g. @awtmods) or numeric ID (-100xxxx).
            </p>
          </div>

          {/* Private APK Channel ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Private APK Storage Channel ID
            </label>
            <Input
              placeholder="e.g. -1002345678901"
              value={settings.telegramPrivateChannelId || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  telegramPrivateChannelId: e.target.value.trim(),
                })
              }
              className="rounded-xl text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Where direct APKs are stored. The bot forwards files from here.
            </p>
          </div>

          {/* Admin Chat ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Admin Telegram Chat ID (For Payment Approvals)
            </label>
            <Input
              placeholder="1343548529"
              value={settings.telegramAdminChatId || "1343548529"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  telegramAdminChatId: e.target.value.trim(),
                })
              }
              className="rounded-xl text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Where the bot forwards UPI screenshots with [ Approve ] / [ Reject ] buttons.
            </p>
          </div>

          {/* Bot Username & VIP Price */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              Telegram VIP Bot Username
            </label>
            <Input
              placeholder="awtmods_bot"
              value={settings.telegramBotUsername || "awtmods_bot"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  telegramBotUsername: e.target.value.replace(/^@/, "").trim(),
                })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-foreground">
              VIP Monthly Price (INR ₹)
            </label>
            <Input
              type="number"
              min={1}
              value={settings.telegramVipPrice || 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  telegramVipPrice: parseInt(e.target.value, 10) || 20,
                })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          {/* Auto Post Toggle */}
          <div className="sm:col-span-2 pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={settings.telegramAutoPostEnabled !== false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    telegramAutoPostEnabled: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-border"
              />
              <span>Automatically post new releases &amp; version updates to Telegram Channel</span>
            </label>
          </div>
        </div>
      </div>

      {/* 💰 Smart Banner & Ad Space Placement Manager */}
      <div className="rounded-3xl border-2 border-emerald-500/30 bg-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
          <div className="space-y-0.5">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span>Smart Banner &amp; Ad Space Placement Manager</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Control your revenue slots (AdSense, Adsterra, Monetag, or custom sponsor banners) with zero code changes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={settings.adsMasterEnabled || false}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    adsMasterEnabled: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-border text-emerald-500"
              />
              <span>Master Ad Switch</span>
            </label>
          </div>
        </div>

        {/* Device Visibility Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-border">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={settings.adsMobileEnabled !== false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  adsMobileEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border"
            />
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span>Show Ads on Mobile Devices</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={settings.adsDesktopEnabled !== false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  adsDesktopEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border"
            />
            <Laptop className="h-4 w-4 text-muted-foreground" />
            <span>Show Ads on Desktop</span>
          </label>
        </div>

        {/* Ad Slots */}
        <div className="space-y-4">
          {/* Header Banner Slot */}
          <div className="space-y-1.5 p-4 rounded-2xl border border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Top Header Banner Ad (728x90 / Responsive)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.adHeaderBannerEnabled || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      adHeaderBannerEnabled: e.target.checked,
                    })
                  }
                  className="h-3.5 w-3.5 rounded border-border"
                />
                <span>Active</span>
              </label>
            </div>
            <Textarea
              rows={2}
              placeholder="<!-- Paste AdSense, Adsterra, or custom HTML banner script here -->"
              value={settings.adHeaderBannerHtml || ""}
              onChange={(e) =>
                setSettings({ ...settings, adHeaderBannerHtml: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          {/* Download Countdown Card Ad */}
          <div className="space-y-1.5 p-4 rounded-2xl border border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Download Page Interstitial Card (Shown During 5s Countdown)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.adCountdownCardEnabled || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      adCountdownCardEnabled: e.target.checked,
                    })
                  }
                  className="h-3.5 w-3.5 rounded border-border"
                />
                <span>Active</span>
              </label>
            </div>
            <Textarea
              rows={2}
              placeholder="<!-- Interstitial banner snippet or 300x250 ad tag -->"
              value={settings.adCountdownCardHtml || ""}
              onChange={(e) =>
                setSettings({ ...settings, adCountdownCardHtml: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>

          {/* In-Feed Native Card Ad */}
          <div className="space-y-1.5 p-4 rounded-2xl border border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Native In-Feed Ad (App Grid &amp; Category Listings)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.adInFeedBannerEnabled || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      adInFeedBannerEnabled: e.target.checked,
                    })
                  }
                  className="h-3.5 w-3.5 rounded border-border"
                />
                <span>Active</span>
              </label>
            </div>
            <Textarea
              rows={2}
              placeholder="<!-- Native in-feed ad script or sponsored card markup -->"
              value={settings.adInFeedBannerHtml || ""}
              onChange={(e) =>
                setSettings({ ...settings, adInFeedBannerHtml: e.target.value })
              }
              className="rounded-xl text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving}
          size="lg"
          className="rounded-xl px-8 font-bold gap-2 shadow-md"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save All Settings</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

