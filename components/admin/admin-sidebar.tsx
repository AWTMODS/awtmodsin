"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  LayoutGrid,
  Radio,
  Clock,
  Archive,
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
  Terminal,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Applications", href: "/admin/apps", icon: Layers },
  { name: "📱 Android Apps", href: "/admin/apps?type=apps", icon: Smartphone, isSub: true },
  { name: "🎮 Android Games", href: "/admin/apps?type=games", icon: Gamepad2, isSub: true },
  { name: "💻 PC Software", href: "/admin/apps?type=pc", icon: Monitor, isSub: true },
  { name: "Add New App", href: "/admin/apps/new", icon: PlusCircle },
  { name: "Categories", href: "/admin/categories", icon: LayoutGrid },
  { name: "Play Store Radar", href: "/admin/radar", icon: Radio, badgeKey: "active_radar" },
  { name: "Modding Queue", href: "/admin/radar/queue", icon: Clock, isSub: true, badgeKey: "queue" },
  { name: "Release History", href: "/admin/radar/releases", icon: Archive, isSub: true },
  { name: "Mod Requests", href: "/admin/requests", icon: Sparkles },
  { name: "Telegram Bot", href: "/admin/bot", icon: Bot },
  { name: "Radar & Scanner Logs", href: "/admin/radar/logs", icon: Terminal },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Reports", href: "/admin/reports", icon: AlertTriangle },
  { name: "Settings", href: "/admin/settings", icon: Settings },
  { name: "Admin Profile", href: "/admin/profile", icon: User },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarNavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState<{ active_radar?: number; queue?: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/admin/radar/stats")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.stats) {
          const s = data.stats;
          setStats({
            active_radar: s.active_radar,
            queue: (s.modding_started || 0) + (s.modded_completed || 0) + (s.ready_to_publish || 0),
          });
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

  return (
    <div className="flex flex-col justify-between h-full w-full bg-card">
      {/* Top brand header */}
      <div>
        <div className="h-16 sm:h-18 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <span className="font-black text-base tracking-tight text-foreground">
              AWT<span className="text-muted-foreground font-normal">Admin</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              target="_blank"
              className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted transition-colors"
              title="View Public Website"
            >
              <ExternalLink className="h-4.5 w-4.5" />
            </Link>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-thin">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href === "/admin/apps"
                ? pathname === "/admin/apps" ||
                  (pathname.startsWith("/admin/apps/") && !pathname.startsWith("/admin/apps/new"))
                : pathname === item.href || (item.href !== "/admin/radar" && pathname.startsWith(item.href + "/"));

            const isSub = (item as any).isSub;
            const badgeKey = (item as any).badgeKey;
            const badgeCount = badgeKey && stats ? stats[badgeKey as keyof typeof stats] : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (onClose) onClose();
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl transition-colors",
                  isSub
                    ? "pl-8 pr-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    : "px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted",
                  isActive && !isSub && "bg-amber-500 text-black font-extrabold shadow-sm",
                  isActive && isSub && "text-amber-500 font-bold bg-amber-500/10"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={isSub ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
                  <span>{item.name}</span>
                </div>

                {badgeCount && badgeCount > 0 ? (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-md",
                      isActive && !isSub
                        ? "bg-black/20 text-black font-black"
                        : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    )}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin User Card & Logout Button */}
      <div className="p-4 border-t border-border mt-auto bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground shrink-0">
              A
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-foreground truncate">Administrator</div>
              <div className="text-[10px] text-muted-foreground truncate">admin@awtmods.in</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card flex-col justify-between min-h-screen sticky top-0 h-screen overflow-y-auto">
        <SidebarNavContent />
      </aside>

      {/* Mobile Slide-Over Drawer with Animated Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl flex flex-col justify-between z-50 animate-in slide-in-from-left duration-300">
            <SidebarNavContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
