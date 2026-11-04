import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete("awtmods_admin_session");

  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ success: true });
}

