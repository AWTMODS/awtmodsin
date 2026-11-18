"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  LayoutGrid,
  GitBranch,
  BarChart3,
  AlertTriangle,
  Settings,
  User,
  LogOut,
  ExternalLink,
  X,
  Sparkles,
  Bot,
  Smartphone,
  Gamepad2,
  Monitor,
  Radio,
  Clock,
  Archive,
  Terminal,
  Activity,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RadarStatsSnapshot {
  active_radar: number;
  updates_detected: number;
  modding_started: number;
  modded_completed: number;
  ready_to_publish: number;
  total_released: number;
}

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarNavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState<RadarStatsSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/admin/radar/stats")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    if (onClose) onClose();
    router.push("/admin/login");
    router.refresh();
  };

  const navSectionClass = "px-3 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70";

  return (
    <div className="flex flex-col justify-between h-full w-full bg-[#101512]">
      {/* Top brand header */}
      <div>
        <div className="h-16 sm:h-18 flex items-center justify-between px-6 border-b border-[#263129]">
          <div className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <span className="font-black text-base tracking-tight text-[#F5F7F4]">
              AWT<span className="text-[#B6F23A] font-normal">Radar</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              target="_blank"
              className="text-[#929B94] hover:text-[#F5F7F4] p-2 rounded-xl hover:bg-[#141B17] transition-colors"
              title="View Public Website"
            >
              <ExternalLink className="h-4.5 w-4.5" />
            </Link>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17] transition-colors"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Links Grouped by Spec #16 */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-thin">
          {/* SECTION: OVERVIEW */}
          <div className={navSectionClass}>Overview</div>
          <Link
            href="/admin"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Admin Dashboard</span>
          </Link>

          <Link
            href="/admin/radar"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center justify-between px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Radio className="h-4 w-4 shrink-0 text-[#B6F23A]" />
              <span className="font-bold">Version Radar Hub</span>
            </div>
            {stats && stats.active_radar > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-[#B6F23A]/20 text-[#B6F23A] border border-[#B6F23A]/30">
                {stats.active_radar}
              </span>
            )}
          </Link>

          {/* SECTION: MONITORING */}
          <div className={navSectionClass}>Monitoring</div>
          <Link
            href="/admin/radar/apps"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center justify-between px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar/apps"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Radio className="h-4 w-4 shrink-0" />
              <span>Version Radar</span>
            </div>
            {stats && stats.updates_detected > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {stats.updates_detected} new
              </span>
            )}
          </Link>

          {/* SECTION: MODDING WORKFLOW */}
          <div className={navSectionClass}>Modding Pipeline</div>
          <Link
            href="/admin/radar/queue"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center justify-between px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar/queue"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 shrink-0 text-blue-400" />
              <span>Modding Queue</span>
            </div>
            {stats && (stats.modding_started + stats.modded_completed + stats.ready_to_publish) > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {stats.modding_started + stats.modded_completed + stats.ready_to_publish}
              </span>
            )}
          </Link>

          <Link
            href="/admin/radar/queue?status=READY_TO_PUBLISH"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center justify-between pl-8 pr-3.5 py-1.5 text-[11px] font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar/queue" && typeof window !== "undefined" && window.location.search.includes("READY_TO_PUBLISH")
                ? "text-[#B6F23A] font-bold"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <div className="flex items-center gap-2">
              <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ready to Publish</span>
            </div>
            {stats && stats.ready_to_publish > 0 && (
              <span className="text-[10px] font-bold px-1.5 rounded-md bg-emerald-500/20 text-emerald-400">
                {stats.ready_to_publish}
              </span>
            )}
          </Link>

          {/* SECTION: RELEASES */}
          <div className={navSectionClass}>Releases Archive</div>
          <Link
            href="/admin/radar/releases"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center justify-between px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar/releases"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 shrink-0 text-[#B6F23A]" />
              <span>Release History</span>
            </div>
            {stats && stats.total_released > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#263129] text-[#F5F7F4]">
                {stats.total_released}
              </span>
            )}
          </Link>

          {/* SECTION: CATALOG & SITE MANAGEMENT */}
          <div className={navSectionClass}>Catalog Management</div>
          <Link
            href="/admin/apps"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/apps" && !pathname.includes("/admin/radar")
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span>All Applications</span>
          </Link>

          <Link
            href="/admin/apps?type=apps"
            onClick={() => onClose && onClose()}
            className="flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-[11px] font-medium text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17] rounded-xl transition-colors"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            <span>Android Apps</span>
          </Link>

          <Link
            href="/admin/apps?type=games"
            onClick={() => onClose && onClose()}
            className="flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-[11px] font-medium text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17] rounded-xl transition-colors"
          >
            <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
            <span>Android Games</span>
          </Link>

          <Link
            href="/admin/apps?type=pc"
            onClick={() => onClose && onClose()}
            className="flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-[11px] font-medium text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17] rounded-xl transition-colors"
          >
            <Monitor className="h-3.5 w-3.5 shrink-0" />
            <span>PC Software</span>
          </Link>

          <Link
            href="/admin/apps/new"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/apps/new"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>Add New App</span>
          </Link>

          <Link
            href="/admin/categories"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/categories"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span>Categories</span>
          </Link>

          <Link
            href="/admin/requests"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/requests"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Mod Requests</span>
          </Link>

          <Link
            href="/admin/bot"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/bot"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <Bot className="h-4 w-4 shrink-0 text-[#B6F23A]" />
            <span>Telegram Bot & VIP</span>
          </Link>

          {/* SECTION: SYSTEM & LOGS */}
          <div className={navSectionClass}>System & Logs</div>
          <Link
            href="/admin/radar/logs"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/radar/logs"
                ? "bg-[#B6F23A] text-[#080B0A] font-bold shadow-xs"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <Terminal className="h-4 w-4 shrink-0" />
            <span>Scanner & Activity Logs</span>
          </Link>

          <Link
            href="/admin/settings"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/settings"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>

          <Link
            href="/admin/profile"
            onClick={() => onClose && onClose()}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors",
              pathname === "/admin/profile"
                ? "bg-[#141B17] text-[#F5F7F4] font-bold border border-[#263129]"
                : "text-[#929B94] hover:text-[#F5F7F4] hover:bg-[#141B17]"
            )}
          >
            <User className="h-4 w-4 shrink-0" />
            <span>Admin Profile</span>
          </Link>
        </nav>
      </div>

      {/* Admin User Card & Logout Button */}
      <div className="p-4 border-t border-[#263129] mt-auto bg-[#101512]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-[#141B17] border border-[#263129] flex items-center justify-center font-black text-xs text-[#B6F23A] shrink-0">
              A
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-[#F5F7F4] truncate">Administrator</div>
              <div className="text-[10px] text-[#929B94] truncate">admin@awtmods.in</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#263129] bg-[#101512] flex-col justify-between min-h-screen sticky top-0 h-screen overflow-y-auto">
        <SidebarNavContent />
      </aside>

      {/* Mobile Slide-Over Drawer with Animated Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#101512] border-r border-[#263129] shadow-2xl flex flex-col justify-between z-50 animate-in slide-in-from-left duration-300">
            <SidebarNavContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
