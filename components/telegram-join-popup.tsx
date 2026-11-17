"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

interface TelegramJoinPopupProps {
  telegramUrl?: string;
  enabled?: boolean;
  delaySeconds?: number;
  title?: string;
  description?: string;
}

export function TelegramJoinPopup({
  telegramUrl = "https://t.me/awtmods",
  enabled = true,
  delaySeconds = 3,
  title = "Join our Telegram",
  description = "Get new premium unlocked apps first, plus update alerts and support from the community.",
}: TelegramJoinPopupProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [popupUrl, setPopupUrl] = useState(telegramUrl);
  const [popupEnabled, setPopupEnabled] = useState(enabled);
  const [popupDelay, setPopupDelay] = useState(delaySeconds);
  const [popupTitle, setPopupTitle] = useState(title);
  const [popupDesc, setPopupDesc] = useState(description);

  // Fetch real-time public settings from admin config
  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.telegramUrl) setPopupUrl(data.telegramUrl);
          if (typeof data.telegramPopupEnabled === "boolean")
            setPopupEnabled(data.telegramPopupEnabled);
          if (typeof data.telegramPopupDelay === "number")
            setPopupDelay(data.telegramPopupDelay);
          if (data.telegramPopupTitle) setPopupTitle(data.telegramPopupTitle);
          if (data.telegramPopupDesc) setPopupDesc(data.telegramPopupDesc);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);

    // Never show inside admin console
    if (pathname && pathname.startsWith("/admin")) {
      return;
    }

    if (!popupEnabled) return;

    // Check localStorage status
    try {
      const isJoined = localStorage.getItem("awtmods_tg_joined");
      if (isJoined === "true") {
        return;
      }

      const snoozeUntil = localStorage.getItem("awtmods_tg_snooze_until");
      if (snoozeUntil && Number(snoozeUntil) > Date.now()) {
        return;
      }
    } catch {
      // LocalStorage access might fail in private browsing mode
    }

    // Trigger timer after configured delay
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, Math.max(1, popupDelay) * 1000);

    // Allow manual opening (e.g. from admin preview or header links)
    const handleManualOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("awtmods_open_tg_popup", handleManualOpen);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("awtmods_open_tg_popup", handleManualOpen);
    };
  }, [pathname, popupEnabled, popupDelay]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleNotNow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const handleJoin = () => {
    try {
      localStorage.setItem("awtmods_tg_joined", "true");
    } catch {}

    window.open(popupUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
    toast.success("Welcome to AWTMods Telegram Community! 🚀");
  };

  const handleAlreadyJoined = () => {
    try {
      localStorage.setItem("awtmods_tg_joined", "true");
    } catch {}

    setIsOpen(false);
    toast.success("Great to have you in our community! ❤️");
  };

  const handleNotNow = () => {
    try {
      // Snooze for 24 hours
      localStorage.setItem(
        "awtmods_tg_snooze_until",
        String(Date.now() + 24 * 60 * 60 * 1000)
      );
    } catch {}

    setIsOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-popup-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop overlay */}
      <div
        onClick={handleNotNow}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
      />

      {/* Modal / Bottom Sheet Card */}
      <div className="relative z-10 w-full sm:max-w-[420px] bg-[#161619] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-8 sm:zoom-in-95">
        {/* Mobile handle indicator */}
        <div className="sm:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Telegram Icon in rounded container */}
        <div className="w-14 h-14 rounded-2xl bg-[#232328] border border-white/5 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <svg
            className="w-7 h-7 text-[#24A1DE]"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21.928 2.548a1.278 1.278 0 0 0-1.332-.234L2.345 9.771a1.282 1.282 0 0 0 .098 2.404l5.127 1.637 2.052 6.386a1.28 1.28 0 0 0 2.158.468l3.14-3.044 5.348 3.935a1.28 1.28 0 0 0 2.022-.728l3.415-16.16a1.28 1.28 0 0 0-.777-1.521zM9.467 13.064l8.847-6.966-7.227 8.047-.323 3.65-1.297-4.731z" />
          </svg>
        </div>

        {/* Content */}
        <div className="text-center space-y-2 mb-6">
          <h2
            id="tg-popup-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-white"
          >
            {popupTitle}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
            {popupDesc}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          {/* 1. Join Telegram Button */}
          <button
            type="button"
            onClick={handleJoin}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#24A1DE] hover:bg-[#2092c9] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#24A1DE]/25 transition-all cursor-pointer"
          >
            <svg
              className="w-4 h-4 fill-white"
              viewBox="0 0 24 24"
            >
              <path d="M21.928 2.548a1.278 1.278 0 0 0-1.332-.234L2.345 9.771a1.282 1.282 0 0 0 .098 2.404l5.127 1.637 2.052 6.386a1.28 1.28 0 0 0 2.158.468l3.14-3.044 5.348 3.935a1.28 1.28 0 0 0 2.022-.728l3.415-16.16a1.28 1.28 0 0 0-.777-1.521zM9.467 13.064l8.847-6.966-7.227 8.047-.323 3.65-1.297-4.731z" />
            </svg>
            <span>Join Telegram</span>
          </button>

          {/* 2. I already joined */}
          <button
            type="button"
            onClick={handleAlreadyJoined}
            className="w-full py-3 px-6 rounded-2xl bg-[#232328] hover:bg-[#2c2c33] active:scale-[0.98] text-[#38bdf8] hover:text-[#0ea5e9] font-medium text-sm transition-all text-center cursor-pointer"
          >
            I already joined
          </button>

          {/* 3. Not now */}
          <div className="text-center pt-1.5">
            <button
              type="button"
              onClick={handleNotNow}
              className="text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 font-medium py-1 transition cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
