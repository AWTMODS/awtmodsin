"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WATCHED_TABLES = [
  "applications",
  "application_versions",
  "categories",
  "mod_requests",
] as const;

/**
 * Keeps the website in sync with database changes (e.g. apps created or updated
 * from the Telegram bot) without a full page reload:
 * 1. Subscribes to Supabase Realtime postgres_changes for instant (<400ms) updates.
 * 2. Checks a lightweight heartbeat on tab focus / every 5s while visible so
 *    updates still arrive immediately even if Supabase Realtime publication is
 *    disabled or the WebSocket slept in a background tab.
 */
export function RealtimeSync() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  const lastSignatureRef = useRef<string | null>(null);
  const lastCheckAtRef = useRef<number>(0);
  routerRef.current = router;

  useEffect(() => {
    let active = true;

    const triggerRefresh = (table: string, eventType: string) => {
      if (!active) return;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("awtmods:db-change", { detail: { table, eventType } })
        );
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        if (!active) return;
        try {
          await fetch("/api/realtime/revalidate", {
            method: "POST",
            cache: "no-store",
          });
        } catch {
          // Non-fatal
        }
        if (active) {
          routerRef.current.refresh();
        }
      }, 350);
    };

    const checkHeartbeat = async (force = false) => {
      if (!active) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const now = Date.now();
      if (!force && now - lastCheckAtRef.current < 3000) return;
      lastCheckAtRef.current = now;

      try {
        const res = await fetch("/api/realtime/heartbeat", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const sig = data?.signature;
        if (!sig || sig === "offline" || sig === "error") return;

        if (lastSignatureRef.current === null) {
          lastSignatureRef.current = sig;
        } else if (lastSignatureRef.current !== sig) {
          lastSignatureRef.current = sig;
          triggerRefresh("applications", "HEARTBEAT");
        }
      } catch {
        // Ignore transient network errors
      }
    };

    // 1. Supabase Realtime subscription
    const supabase = createClient();
    const channel = supabase ? supabase.channel("awtmods-realtime-sync") : null;

    if (channel) {
      for (const table of WATCHED_TABLES) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload: { eventType: string }) => {
            lastSignatureRef.current = null; // reset baseline
            triggerRefresh(table, payload.eventType);
          }
        );
      }
      channel.subscribe();
    }

    // 2. Initial heartbeat baseline + 5s visible-tab polling + instant tab-focus check
    checkHeartbeat(true);
    const intervalId = setInterval(() => checkHeartbeat(false), 5000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        checkHeartbeat(true);
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      active = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return null;
}
