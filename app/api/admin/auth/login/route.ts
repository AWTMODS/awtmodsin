import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db/postgres";
import { createAdminSessionToken } from "@/lib/auth/session";

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

    // 1. Authenticate against Supabase Auth (auth.users) using bcrypt
    const authResult = await pool.query(
      `
      SELECT 
        id, 
        email, 
        (crypt($2, encrypted_password) = encrypted_password) as password_matches 
      FROM auth.users 
      WHERE lower(email) = $1
      LIMIT 1;
      `,
      [cleanEmail, password.trim()]
    );

    if (authResult.rows.length === 0 || !authResult.rows[0].password_matches) {
      return NextResponse.json(
        { error: "Invalid administrator credentials" },
        { status: 401 }
      );
    }

    const authUser = authResult.rows[0];

    // 2. Strict Administrator Authorization: Check public.admins table
    const adminResult = await pool.query(
      `
      SELECT id, auth_user_id, email, role, is_active 
      FROM public.admins 
      WHERE auth_user_id = $1 AND lower(email) = $2
      LIMIT 1;
      `,
      [authUser.id, cleanEmail]
    );

    if (adminResult.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Access Denied: This account is not an authorized AWTMods administrator.",
        },
        { status: 403 }
      );
    }

    const admin = adminResult.rows[0];

    // 3. Verify Account Status is Active
    if (!admin.is_active) {
      return NextResponse.json(
        {
          error:
            "Access Denied: This administrator account has been deactivated by the Superadmin.",
        },
        { status: 403 }
      );
    }

    // 4. Verify Strict Three-Administrator Limit
    const totalAdminsCountRes = await pool.query(
      "SELECT COUNT(*) as count FROM public.admins;"
    );
    const totalAdmins = parseInt(totalAdminsCountRes.rows[0].count, 10);
    if (totalAdmins > 3) {
      return NextResponse.json(
        {
          error:
            "Security Policy Violation: More than 3 administrator accounts detected. Access blocked.",
        },
        { status: 403 }
      );
    }

    // 5. Generate Signed Server Session Token
    const sessionToken = createAdminSessionToken(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      sessionMaxAge
    );

    // 6. Set Secure, HttpOnly Cookie
    const cookieStore = cookies();
    cookieStore.set("awtmods_admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionMaxAge,
      path: "/",
    });

    // 7. Log activity in admin_activity_logs (non-blocking)
    pool
      .query(
        `
        INSERT INTO public.admin_activity_logs (admin_id, action, entity_type, details)
        VALUES ($1, 'login', 'auth', $2);
        `,
        [
          admin.id,
          JSON.stringify({
            ip: req.headers.get("x-forwarded-for") || "local",
            userAgent: req.headers.get("user-agent") || "unknown",
            rememberMe: !!rememberMe,
          }),
        ]
      )
      .catch((err) => console.error("Activity log error:", err));

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err: any) {
    console.error("Admin authentication error:", err);
    return NextResponse.json(
      { error: err.message || "Authentication system error" },
      { status: 500 }
    );
  }
}
