import type { Metadata } from "next";
import Link from "next/link";
import { Home, Search, Music, Image as ImageIcon, Wrench, Gamepad2 } from "lucide-react";
import { NotFoundIllustration } from "@/components/not-found-illustration";

export const metadata: Metadata = {
  title: "404: Page Not Found",
  description: "Sorry, the page you're looking for doesn't exist or has been moved.",
};

const popularCategories = [
  {
    name: "Social",
    href: "/categories/social",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-foreground transition-transform duration-200 group-hover:scale-110"
        aria-hidden="true"
      >
        <path d="M5 16a7 7 0 0 1 14 0Z" />
        <circle cx="8.5" cy="12.5" r="1" fill="currentColor" />
        <circle cx="15.5" cy="12.5" r="1" fill="currentColor" />
        <line x1="7" y1="8" x2="5" y2="5" />
        <line x1="17" y1="8" x2="19" y2="5" />
      </svg>
    ),
  },
  {
    name: "Music & Audio",
    href: "/categories/music-audio",
    icon: <Music className="w-5 h-5 text-foreground transition-transform duration-200 group-hover:scale-110" />,
  },
  {
    name: "Photography",
    href: "/categories/photography",
    icon: <ImageIcon className="w-5 h-5 text-foreground transition-transform duration-200 group-hover:scale-110" />,
  },
  {
    name: "Tools",
    href: "/categories/tools",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-foreground transition-transform duration-200 group-hover:scale-110"
        aria-hidden="true"
      >
        {/* Crossed Tools (Wrench + Screwdriver style) */}
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        <line x1="4" y1="20" x2="9" y2="15" />
      </svg>
    ),
  },
  {
    name: "Games",
    href: "/categories/games",
    icon: <Gamepad2 className="w-5 h-5 text-foreground transition-transform duration-200 group-hover:scale-110" />,
  },
];

export default function NotFound() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12 sm:py-16 lg:py-20 bg-background text-foreground overflow-hidden">
      <div className="container max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* 1. Main 404 Illustration matching reference mockup */}
        <div className="w-full flex justify-center mb-6 sm:mb-8">
          <NotFoundIllustration className="w-full max-w-[460px] sm:max-w-[520px]" />
        </div>

        {/* 2. Main Error Content */}
        <div className="space-y-3 mb-8 sm:mb-10 max-w-xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Page Not Found
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-normal leading-relaxed">
            Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* 3. Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-12 sm:mb-16">
          {/* Primary Button: Go to Homepage */}
          <Link href="/" className="w-full sm:w-auto">
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 shadow-sm active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              <span>Go to Homepage</span>
            </button>
          </Link>

          {/* Secondary Button: Search Apps */}
          <Link href="/search" className="w-full sm:w-auto">
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 dark:bg-[#171717] dark:text-white dark:border-[#292929] dark:hover:bg-[#222222] shadow-sm active:scale-[0.98]"
            >
              <Search className="w-4 h-4" />
              <span>Search Apps</span>
            </button>
          </Link>
        </div>

        {/* 4. Popular Categories Section */}
        <div className="w-full max-w-3xl mx-auto">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-4 sm:mb-5">
            You can also browse popular categories:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {popularCategories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="group flex flex-col items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#292929] shadow-sm hover:shadow-md hover:border-neutral-400 dark:hover:border-neutral-600 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {cat.icon}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-foreground tracking-tight whitespace-nowrap">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
