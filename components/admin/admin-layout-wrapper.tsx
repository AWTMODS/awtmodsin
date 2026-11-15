"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, ExternalLink } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AdminSidebar } from "./admin-sidebar";
import { Button } from "@/components/ui/button";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Automatically close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col lg:flex-row">
      {/* Mobile & Tablet Top Bar (Hidden on Desktop lg:hidden) */}
      <header className="lg:hidden sticky top-0 z-40 w-full h-15 border-b border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl text-foreground hover:bg-muted h-9 w-9"
            aria-label="Open Admin Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href="/admin" className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              AWT<span className="text-muted-foreground font-normal">Admin</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Console
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/"
            target="_blank"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="View Public Website"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          <Link
            href="/admin/profile"
            className="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-xs text-foreground ml-0.5"
            title="Administrator Profile"
          >
            A
          </Link>
        </div>
      </header>

      {/* Admin Sidebar (Desktop Sticky + Mobile Off-Canvas Drawer) */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Admin Content Container */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
