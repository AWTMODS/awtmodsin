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
 * Subscribes to Supabase Realtime postgres_changes and triggers a soft
 * Next.js router.refresh() whenever database rows are inserted, updated,
 * or deleted (e.g., from the Telegram bot or another admin session)
 * without a full browser page reload.
 */
export function RealtimeSync() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const triggerRefresh = (table: string, eventType: string) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("awtmods:db-change", { detail: { table, eventType } })
        );
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        try {
          await fetch("/api/realtime/revalidate", {
            method: "POST",
            cache: "no-store",
          });
        } catch {
          // Non-fatal: still refresh the router
        }
        routerRef.current.refresh();
      }, 400);
    };

    const channel = supabase.channel("awtmods-realtime-sync");

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: { eventType: string }) => {
          triggerRefresh(table, payload.eventType);
        }
      );
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
