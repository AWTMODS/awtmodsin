import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("awtmods_admin_session")?.value;

  const session = verifyAdminSessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
  });
}

