"use client";

import { useState } from "react";
import { SiteSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsManager({
  initialSettings,
}: {
  initialSettings: SiteSettings;
}) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

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

