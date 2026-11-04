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

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col justify-between min-h-screen">
      {/* Top brand header */}
      <div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              AWT<span className="text-muted-foreground font-normal">Admin</span>
            </span>
          </div>
          <Link
            href="/"
            target="_blank"
            className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
            title="View Public Website"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
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
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground">
              A
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Administrator</div>
              <div className="text-[10px] text-muted-foreground">admin@awtmods.in</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

