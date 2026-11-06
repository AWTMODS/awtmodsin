"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  Zap,
  Star,
  Download,
  Flame,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Application, AppCategory } from "@/lib/types";
import { getAppUrl, formatNumber } from "@/lib/utils";

interface HeroSectionProps {
  totalApps?: number;
  featuredApps?: Application[];
  trendingApps?: Application[];
  categories?: AppCategory[];
}

function AndroidIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 7.8443 13.8533 7.3333 12 7.3333s-3.5902.511-5.1368 1.6164L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3333 15.2289.3333 19.9167H23.6667c0-4.6878-2.3556-8.73-5.7852-10.5953" />
    </svg>
  );
}

const TRENDING_TAGS = [
  "Spotify",
  "Minecraft",
  "Games",
  "Streaming",
  "Tools",
  "PC Software",
];

export function HeroSection({
  totalApps,
  featuredApps = [],
  trendingApps = [],
  categories = [],
}: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    router.push(`/search?q=${encodeURIComponent(tag)}`);
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const spotlightApps = (featuredApps.length > 0 ? featuredApps : trendingApps).slice(0, 3);
  const carouselApps = (trendingApps.length > 0 ? trendingApps : featuredApps).slice(0, 10);

  return (
    <section className="relative overflow-hidden pt-6 pb-12 md:pt-12 md:pb-16 border-b border-border/60 bg-gradient-to-b from-background via-background to-secondary/15">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[420px] bg-neutral-200/20 dark:bg-neutral-800/15 blur-3xl rounded-full pointer-events-none -z-10" />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Top Hero Grid: Android Focus Copy & Android Spotlight Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Android-Optimized Copy & Search */}
          <div className="lg:col-span-7 space-y-5 text-left">
            {/* Android Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-secondary/80 text-xs font-semibold text-foreground">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <AndroidIcon className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Android Modded APKs & Safe Downloads</span>
            </div>

            {/* Main Android Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Download Modded Apps <br />
              <span className="text-muted-foreground">& Games for Android</span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
              Direct high-speed APK downloads for your Android phone or tablet. All mods are tested for safety, 100% ad-free, and require no root access.
            </p>

            {/* Android Search Form */}
            <form onSubmit={handleSearch} className="max-w-xl relative">
              <div className="flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-foreground focus-within:border-transparent transition-all">
                <Search className="h-5 w-5 text-muted-foreground ml-3 shrink-0" />
                <input
                  type="text"
                  placeholder="Search Android apps, games, mods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent px-3 py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <Button type="submit" size="default" className="rounded-xl px-5 h-11 shrink-0 font-semibold">
                  Search
                </Button>
              </div>
            </form>

            {/* Quick Trending Android Search Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1 max-w-xl">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                <span>Trending:</span>
              </span>
              {TRENDING_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border/80 bg-secondary/50 hover:bg-secondary text-foreground/90 hover:text-foreground transition-colors font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Android Trust & Safety Features */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 max-w-xl">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-foreground">
                <AndroidIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>No Root Needed</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-foreground">
                <Zap className="h-4 w-4 text-foreground shrink-0" />
                <span>Direct APK</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-foreground shrink-0" />
                <span>Virus Scanned</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-foreground shrink-0" />
                <span>Anti-Ban Safe</span>
              </div>
            </div>
          </div>

          {/* Right Column: Android Spotlight Showcase (Replaces Phone Mockup) */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-border bg-card/90 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                    <AndroidIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Android Spotlight</h2>
                    <p className="text-[11px] text-muted-foreground">Most popular verified mods</p>
                  </div>
                </div>
                <Link
                  href="/apps?sort=downloads"
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  View All &rarr;
                </Link>
              </div>

              {/* Spotlight App Cards */}
              <div className="space-y-2.5">
                {spotlightApps.length > 0 ? (
                  spotlightApps.map((app) => (
                    <Link
                      key={app.id}
                      href={getAppUrl(app.slug)}
                      className="group flex items-center justify-between p-3 rounded-2xl border border-border/70 bg-secondary/30 hover:bg-secondary/70 hover:border-neutral-500/40 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-card shrink-0">
                          <img
                            src={app.icon_url || "/icon.svg"}
                            alt={app.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {app.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {app.rating ? Number(app.rating).toFixed(1) : "5.0"}
                            </span>
                            <span>•</span>
                            <span className="truncate">{app.category?.name || "Android Mod"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-bold shadow-xs group-hover:opacity-90 transition-opacity">
                          <Download className="h-3.5 w-3.5" />
                          <span>APK</span>
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Discover Android applications below.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Horizontal Swiper Strip: Trending on Android (Just like modplays.com) */}
        {carouselApps.length > 0 && (
          <div className="pt-4 border-t border-border/50 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5">
                  <span>Trending on Android</span>
                  <Flame className="h-4 w-4 text-amber-500" />
                </h2>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  • Swipe to explore popular modded APKs
                </span>
              </div>

              {/* Navigation Arrows for Desktop */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  aria-label="Scroll left"
                  className="p-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  aria-label="Scroll right"
                  className="p-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Touch Scroll Row */}
            <div
              ref={scrollRef}
              className="flex items-stretch gap-3.5 overflow-x-auto pb-2 scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {carouselApps.map((app) => (
                <Link
                  key={app.id}
                  href={getAppUrl(app.slug)}
                  className="group flex-shrink-0 w-36 sm:w-44 flex flex-col items-center text-center p-3 sm:p-3.5 rounded-2xl border border-border bg-card/80 hover:bg-card hover:border-neutral-500/50 transition-all duration-200 select-none shadow-xs"
                >
                  <div className="relative mb-2">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border border-border/80 bg-secondary/50 shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <img
                        src={app.icon_url || "/icon.svg"}
                        alt={app.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {app.is_trending && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-extrabold text-black uppercase tracking-wider shadow">
                        HOT
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-foreground truncate w-full group-hover:text-primary transition-colors">
                    {app.name}
                  </h3>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-foreground">
                      {app.rating ? Number(app.rating).toFixed(1) : "5.0"}
                    </span>
                    {app.downloads_count && app.downloads_count > 0 ? (
                      <>
                        <span>•</span>
                        <span>{formatNumber(app.downloads_count)}</span>
                      </>
                    ) : null}
                  </div>

                  {app.mod_features && app.mod_features.length > 0 ? (
                    <span className="mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary text-foreground/90 border border-border/80 truncate max-w-full">
                      {app.mod_features[0]}
                    </span>
                  ) : (
                    <span className="mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-full">
                      Verified APK
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
