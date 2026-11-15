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
      <header className="lg:hidden sticky top-0 z-40 w-full h-16 sm:h-18 border-b border-border bg-card/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="rounded-2xl text-foreground hover:bg-muted active:scale-95 h-11 w-11 border border-border/40"
            aria-label="Open Admin Menu"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <Link href="/admin" prefetch={true} className="flex items-center gap-2.5">
            <Logo size="md" showText={false} />
            <span className="font-black text-base sm:text-lg tracking-tight text-foreground">
              AWT<span className="text-muted-foreground font-normal">Admin</span>
            </span>
            <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
              Console
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            target="_blank"
            className="h-10 w-10 flex items-center justify-center rounded-2xl border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="View Public Website"
          >
            <ExternalLink className="h-5 w-5" />
          </Link>
          <Link
            href="/admin/profile"
            prefetch={true}
            className="h-10 w-10 rounded-2xl bg-secondary border border-border/80 flex items-center justify-center font-black text-sm text-foreground shadow-2xs hover:border-primary/50 transition-colors"
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
