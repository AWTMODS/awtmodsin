"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ShieldCheck, Zap, RefreshCw, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24 border-b border-border/60">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-neutral-200/40 dark:bg-neutral-800/20 blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Copy & Search */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/80 text-xs font-semibold text-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              #1 App Mods Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Download Modded Apps <br />
              <span className="text-muted-foreground">& Premium APKs</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Discover the latest Android applications, useful tools and premium app experiences. Explore new releases, verified builds, and updated applications.
            </p>

            {/* Large Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl relative">
              <div className="flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
                <Search className="h-5 w-5 text-muted-foreground ml-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Search for apps, games, mods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <Button type="submit" size="default" className="rounded-xl px-5 shrink-0">
                  Search
                </Button>
              </div>
            </form>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 max-w-xl">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-muted-foreground">
                <Layers className="h-4 w-4 text-foreground shrink-0" />
                <span>1000+ Apps</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-muted-foreground">
                <Zap className="h-4 w-4 text-foreground shrink-0" />
                <span>Fast Download</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-foreground shrink-0" />
                <span>Safe & Verified</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-muted-foreground">
                <RefreshCw className="h-4 w-4 text-foreground shrink-0" />
                <span>Regular Updates</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Smartphone Device Display */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-64 sm:w-72 aspect-[9/19] rounded-[44px] p-3 border-4 border-neutral-300 dark:border-neutral-800 bg-neutral-900 shadow-2xl shadow-neutral-950/20 dark:shadow-black/60 rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Dynamic Island Notch */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20 flex items-center justify-end px-2">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
              </div>

              {/* Screen Mockup Inner Content */}
              <div className="relative w-full h-full rounded-[34px] overflow-hidden bg-neutral-950 text-white p-4 flex flex-col justify-between select-none">
                {/* Header inside phone */}
                <div className="pt-7 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-white">
                    <div className="w-4 h-4 bg-white rounded-md flex items-center justify-center text-black font-black text-[9px]">
                      A
                    </div>
                    <span>AWTMods</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">5G • 100%</div>
                </div>

                {/* Center Phone Graphic */}
                <div className="my-auto py-6 text-center space-y-3">
                  <div className="mx-auto w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-inner">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 32 32"
                      fill="none"
                      className="text-white"
                    >
                      <path
                        d="M16 2L3 28H10.5L16 16.5L21.5 28H29L16 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
                    AWTMODS.IN
                  </div>
                  <div className="text-sm font-bold text-white px-2">
                    Verified Android APKs & Mod Platform
                  </div>
                </div>

                {/* Mini bottom action card */}
                <div className="p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-300">AWTMods Platform</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Ready</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div className="w-full h-full bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

