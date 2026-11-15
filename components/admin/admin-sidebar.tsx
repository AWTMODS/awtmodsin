"use client";

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
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Applications", href: "/admin/apps", icon: Layers },
  { name: "Add New App", href: "/admin/apps/new", icon: PlusCircle },
  { name: "Categories", href: "/admin/categories", icon: LayoutGrid },
  { name: "Version Management", href: "/admin/versions", icon: GitBranch },
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
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" showText={false} />
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              AWT<span className="text-muted-foreground font-normal">Admin</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="View Public Website"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
            // Prevent parent route (e.g. /admin/apps) from matching child routes (e.g. /admin/apps/new)
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : item.href === "/admin/apps"
                ? pathname === "/admin/apps" ||
                  (pathname.startsWith("/admin/apps/") && !pathname.startsWith("/admin/apps/new"))
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (onClose) onClose();
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
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
      {/* Desktop Persistent Sidebar (Only visible on lg screens and wider) */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card flex-col justify-between min-h-screen sticky top-0 h-screen overflow-y-auto">
        <SidebarNavContent />
      </aside>

      {/* Mobile Slide-Over Drawer with Animated Backdrop (Only on < lg screens) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />

          {/* Slide-over sidebar container */}
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl flex flex-col justify-between z-50 animate-in slide-in-from-left duration-300">
            <SidebarNavContent onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
