"use client";

import { useState } from "react";
import Image from "next/image";
import { SiteSettings } from "@/lib/types";
import { VipUser } from "@/lib/telegram-vip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Zap,
  Radio,
  QrCode,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Users,
  ExternalLink,
  Smartphone,
  Sparkles,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  CalendarPlus,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface BotManagerProps {
  initialSettings: SiteSettings;
  initialVipUsers: VipUser[];
}

export function BotManager({ initialSettings, initialVipUsers }: BotManagerProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [vipUsers, setVipUsers] = useState<VipUser[]>(initialVipUsers);
  const [saving, setSaving] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [connectingWebhook, setConnectingWebhook] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // VIP User Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addFullName, setAddFullName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addDays, setAddDays] = useState("30");
  const [addingUser, setAddingUser] = useState(false);

  // User Actions
  const handleUserAction = async (
    userId: number,
    action: "grant" | "revoke" | "extend" | "delete",
    days = 30
  ) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch("/api/admin/bot/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, days }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      if (action === "delete") {
        setVipUsers((prev) => prev.filter((u) => u.userId !== userId));
        toast.success(`User ${userId} deleted from VIP list`);
      } else if (data.user) {
        setVipUsers((prev) =>
          prev.map((u) => (u.userId === userId ? data.user : u))
        );
        toast.success(
          action === "grant"
            ? `Granted ${days} days VIP to user ${userId}!`
            : action === "extend"
            ? `Extended VIP by ${days} days!`
            : `Revoked VIP access for user ${userId}`
        );
      } else {
        // Fallback local update
        if (action === "revoke") {
          setVipUsers((prev) =>
            prev.map((u) => (u.userId === userId ? { ...u, isVip: false } : u))
          );
          toast.success(`Revoked VIP access`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update VIP user");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = parseInt(addUserId.trim(), 10);
    if (isNaN(parsedId)) {
      toast.error("Please enter a valid numeric Telegram User ID");
      return;
    }

    setAddingUser(true);
    try {
      const res = await fetch("/api/admin/bot/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grant",
          userId: parsedId,
          days: parseInt(addDays, 10) || 30,
          fullName: addFullName.trim(),
          username: addUsername.replace(/^@/, "").trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant VIP");

      if (data.user) {
        setVipUsers((prev) => [
          data.user,
          ...prev.filter((u) => u.userId !== parsedId),
        ]);
      }

      setShowAddModal(false);
      setAddUserId("");
      setAddFullName("");
      setAddUsername("");
      setAddDays("30");
      toast.success(`VIP access granted to User ID ${parsedId}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add VIP user");
    } finally {
      setAddingUser(false);
    }
  };

  // Filtered Users
  const filteredUsers = vipUsers.filter((u) => {
    if (statusFilter === "active" && !u.isVip) return false;
    if (statusFilter === "expired" && u.isVip) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    return (
      String(u.userId).includes(q) ||
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.pendingApp && u.pendingApp.toLowerCase().includes(q))
    );
  });

  const activeVipCount = vipUsers.filter((u) => u.isVip).length;
  const estimatedRevenue = activeVipCount * (settings.telegramVipPrice || 20);

  // Compute live UPI QR Code
  const upiId = settings.telegramUpiId || "awtmods@upi";
  const upiName = settings.telegramUpiName || "AWTMods VIP";
  const vipPrice = settings.telegramVipPrice || 20;

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    upiName
  )}&am=${vipPrice}&cu=INR&tn=${encodeURIComponent("AWTMods VIP Access")}`;

  const liveQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    upiUri
  )}`;

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Telegram Bot & UPI settings saved successfully!");
    } catch {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectWebhook = async () => {
    if (!settings.telegramBotToken) {
      toast.error("Please enter a Telegram Bot Token first.");
      return;
    }
    setConnectingWebhook(true);
    try {
      await handleSaveSettings();

      const res = await fetch("/api/telegram/set-webhook", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set webhook");
      }
      toast.success(data.message || "Webhook activated! @awtmods_bot is running 24/7 with No VPS.");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect webhook");
    } finally {
      setConnectingWebhook(false);
    }
  };

  const handleTestMessage = async () => {
    if (!settings.telegramBotToken) {
      toast.error("Please enter a Telegram Bot Token first.");
      return;
    }
    setTestingBot(true);
    try {
      await handleSaveSettings();

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

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl border border-sky-500/30 bg-card shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 shrink-0">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                @{settings.telegramBotUsername || "awtmods_bot"}
              </h2>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Serverless Webhook Ready (No VPS)</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Handles user requests, generates dynamic UPI QR codes, and delivers VIP APKs 24/7/365.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConnectWebhook}
            disabled={connectingWebhook || !settings.telegramBotToken}
            className="rounded-xl border-emerald-500/40 text-xs font-semibold gap-1.5 hover:bg-emerald-500/10 text-foreground"
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
            onClick={handleTestMessage}
            disabled={testingBot || !settings.telegramBotToken}
            className="rounded-xl border-sky-500/40 text-xs font-semibold gap-1.5 hover:bg-sky-500/10 text-foreground"
          >
            {testingBot ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
            ) : (
              <Radio className="h-3.5 w-3.5 text-sky-400" />
            )}
            <span>Send Test Ping</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* 💳 UPI Payment & Auto-Generated QR Code Card */}
        <div className="rounded-3xl border-2 border-amber-500/30 bg-card p-6 sm:p-8 space-y-6">
          <div className="pb-3 border-b border-border">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 block">
              Automated Payment Gateway
            </span>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <QrCode className="h-5 w-5 text-amber-500" />
              <span>UPI Payment Details &amp; Auto-Generated QR Code</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your UPI ID and price. The bot dynamically creates and sends this exact QR code to users inside Telegram when they start or request an app!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form inputs */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Your UPI ID (GPay / PhonePe / Paytm) *
                </label>
                <Input
                  placeholder="e.g. yourname@okaxis, aadith@paytm, 9876543210@upi"
                  value={settings.telegramUpiId || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, telegramUpiId: e.target.value.trim() })
                  }
                  className="rounded-xl text-xs font-mono"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  100% of payments go directly into your linked bank account with 0% gateway commission.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Payee Business / Name Displayed on Scan *
                </label>
                <Input
                  placeholder="e.g. Aadith C V or AWTMods"
                  value={settings.telegramUpiName || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, telegramUpiName: e.target.value })
                  }
                  className="rounded-xl text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  VIP Monthly Price (INR ₹) *
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
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Amount pre-filled in the UPI QR Code for instant 1-click payment.
                </p>
              </div>
            </div>

            {/* Right Column: Live Generated QR Preview Card */}
            <div className="lg:col-span-5 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-5 text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 fill-current" />
                Live Generated QR Code
              </div>

              {/* QR Image Box */}
              <div className="relative mx-auto h-48 w-48 rounded-2xl overflow-hidden bg-white p-2 shadow-md border border-neutral-300 flex items-center justify-center">
                {settings.telegramUpiId ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={liveQrUrl}
                    alt="UPI QR Code"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-neutral-400 font-medium">
                    Enter UPI ID to preview QR
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground">
                  Amount: ₹{vipPrice} • {settings.telegramUpiName || "AWTMods VIP"}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate px-2">
                  {settings.telegramUpiId || "awtmods@upi"}
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <Smartphone className="h-3 w-3 text-emerald-500" />
                <span>Compatible with GPay, PhonePe, Paytm, BHIM &amp; Cred</span>
              </div>
            </div>
          </div>
        </div>

        {/* 🤖 Bot Credentials & Channels */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
          <div className="pb-3 border-b border-border">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-sky-400" />
              <span>Bot Credentials &amp; Channel IDs</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Securely configure Telegram Bot Token and channel links.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bot Token */}
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Telegram Bot Token (@BotFather) *
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
                Saved securely in Supabase. Never exposed to public website visitors.
              </p>
            </div>

            {/* Admin Chat ID */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Admin Chat ID (For 1-Tap Approvals) *
              </label>
              <Input
                placeholder="1343548529"
                value={settings.telegramAdminChatId || "1343548529"}
                onChange={(e) =>
                  setSettings({ ...settings, telegramAdminChatId: e.target.value.trim() })
                }
                className="rounded-xl text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Where the bot forwards user payment screenshots with [ Approve ] / [ Reject ] buttons.
              </p>
            </div>

            {/* Public Channel ID */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Public Broadcast Channel
              </label>
              <Input
                placeholder="@awtmods"
                value={settings.telegramChannelId || "@awtmods"}
                onChange={(e) =>
                  setSettings({ ...settings, telegramChannelId: e.target.value.trim() })
                }
                className="rounded-xl text-xs font-mono"
              />
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
                Private channel where you store raw .apk files for bot delivery.
              </p>
            </div>

            {/* Bot Username */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-foreground">
                Bot Username
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
                  className="h-4 w-4 rounded border-border text-sky-500"
                />
                <span>Auto-post updates &amp; new apps to Public Channel</span>
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
            className="rounded-2xl px-8 font-bold gap-2 shadow-md"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Bot &amp; UPI Configuration</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* 👑 Active VIP Subscribers Table & Control Hub */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-4">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              <span>VIP Subscribers &amp; Access Controls ({vipUsers.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Full administrative control: Manually grant, extend, or revoke VIP access per user.
            </p>
          </div>

          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="rounded-2xl font-bold text-xs gap-1.5 self-start sm:self-auto shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Manually Grant VIP</span>
          </Button>
        </div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Active VIP Members
            </span>
            <div className="text-2xl font-black text-emerald-500 font-mono mt-0.5">
              {activeVipCount}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Uncapped 5G direct Telegram downloads
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Monthly Run-Rate (MRR)
            </span>
            <div className="text-2xl font-black text-foreground font-mono mt-0.5">
              ₹{estimatedRevenue}
            </div>
            <span className="text-[10px] text-muted-foreground">
              At ₹{settings.telegramVipPrice || 20}/mo per subscriber
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Total Bot Registrations
            </span>
            <div className="text-2xl font-black text-foreground font-mono mt-0.5">
              {vipUsers.length}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Users who have accessed @{settings.telegramBotUsername || "awtmods_bot"}
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by User ID, Name, Username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-border bg-secondary text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Users ({vipUsers.length})</option>
              <option value="active">Active VIP ({activeVipCount})</option>
              <option value="expired">Expired / Pending ({vipUsers.length - activeVipCount})</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-secondary/20">
            <p className="text-xs text-muted-foreground">
              No matching Telegram users found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Telegram ID</th>
                  <th className="py-2.5 px-3">Requested App</th>
                  <th className="py-2.5 px-3">VIP Status</th>
                  <th className="py-2.5 px-3">Expires At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.map((u) => {
                  const isLoading = actionLoadingId === u.userId;
                  return (
                    <tr key={u.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">
                          {u.fullName || "User"}
                        </div>
                        {u.username && (
                          <div className="text-[11px] text-muted-foreground">
                            @{u.username}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {u.userId}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs text-foreground uppercase">
                          {u.pendingApp || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {u.isVip ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Active VIP
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px]">
                            Expired / Pending
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {u.vipExpiresAt ? formatDate(u.vipExpiresAt) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Extend / Grant +30 Days */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleUserAction(u.userId, "extend", 30)}
                            className="h-8 px-2.5 rounded-lg text-[11px] font-semibold border-border hover:bg-emerald-500/10 text-foreground"
                            title="Extend VIP by 30 days"
                          >
                            <CalendarPlus className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                            <span>+30d</span>
                          </Button>

                          {/* Revoke VIP */}
                          {u.isVip && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => handleUserAction(u.userId, "revoke")}
                              className="h-8 px-2 rounded-lg text-[11px] font-semibold border-border hover:bg-amber-500/10 text-amber-600"
                              title="Revoke VIP Access"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Delete User Record */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => {
                              if (confirm(`Remove user ${u.userId} from VIP records?`)) {
                                handleUserAction(u.userId, "delete");
                              }
                            }}
                            className="h-8 px-2 rounded-lg text-[11px] font-semibold border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete User Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manually Add / Grant VIP Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 text-left shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 block">
                VIP Manual Override
              </span>
              <h3 className="text-xl font-bold text-foreground">
                Grant VIP Access Manually
              </h3>
              <p className="text-xs text-muted-foreground">
                Manually activate VIP status for any user who paid offline or requires complimentary access.
              </p>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Telegram User ID (Numeric) *
                </label>
                <Input
                  required
                  placeholder="e.g. 1343548529"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value.trim())}
                  className="rounded-xl text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Users can find their ID by messaging @userinfobot on Telegram.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Subscriber Full Name (Optional)
                </label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  Telegram Username (Optional)
                </label>
                <Input
                  placeholder="e.g. rahul_dev"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value.trim())}
                  className="rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-foreground">
                  VIP Duration (Days) *
                </label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={addDays}
                  onChange={(e) => setAddDays(e.target.value)}
                  className="rounded-xl text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl text-xs px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addingUser}
                  className="rounded-xl text-xs font-bold px-6 shadow-md"
                >
                  {addingUser ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <span>Grant VIP Pass</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
