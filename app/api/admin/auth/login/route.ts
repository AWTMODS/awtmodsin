import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createAdminSessionToken } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

const DEFAULT_SUPABASE_URL = "https://uzmskxruuvfgokststox.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "sb_publishable_GDnnEMuWJQLDOMSlvox7CA_e-bPy7LR";

function getSupabaseAdmin() {
  const url =
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const { email, password, rememberMe } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    // 30 days if rememberMe is true, otherwise 24 hours
    const sessionMaxAge = rememberMe ? 86400 * 30 : 86400 * 1;

    const supabase = getSupabaseAdmin();

    // 1. Authenticate & Authorize via secure PostgreSQL RPC over HTTPS
    // Verifies bcrypt password in auth.users, checks public.admins, enforces 3-admin limit,
    // and records the login event in admin_activity_logs (SECURITY DEFINER)
    const { data: authData, error: rpcError } = await supabase.rpc(
      "verify_admin_login",
      {
        p_email: cleanEmail,
        p_password: password.trim(),
      }
    );

    if (rpcError) {
      console.error("Supabase RPC error:", rpcError);
      return NextResponse.json(
        { error: "Authentication system error: " + rpcError.message },
        { status: 500 }
      );
    }

    if (!authData || !authData.success) {
      const errorMsg =
        authData?.error || "Invalid administrator credentials or access denied.";
      const status =
        errorMsg.includes("Access Denied") || errorMsg.includes("Security Policy")
          ? 403
          : 401;
      return NextResponse.json({ error: errorMsg }, { status });
    }

    const admin = authData.admin;

    // 2. Generate Signed Server Session Token (HMAC SHA-256)
    const sessionToken = createAdminSessionToken(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      sessionMaxAge
    );

    // 3. Set Secure, HttpOnly Session Cookie
    const cookieStore = cookies();
    cookieStore.set("awtmods_admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionMaxAge,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err: any) {
    console.error("Admin authentication exception:", err);
    return NextResponse.json(
      { error: err.message || "Authentication system error" },
      { status: 500 }
    );
  }
}
