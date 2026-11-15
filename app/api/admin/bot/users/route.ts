import { NextResponse } from "next/server";
import {
  getVipUsers,
  activateUserVip,
  revokeUserVip,
  extendUserVip,
  deleteVipUser,
} from "@/lib/telegram-vip";

export async function GET() {
  try {
    const users = await getVipUsers();
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, days = 30, fullName, username } = body;

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return NextResponse.json({ error: "Valid numeric Telegram User ID is required" }, { status: 400 });
    }

    if (action === "grant") {
      const user = await activateUserVip(parsedUserId, parseInt(days, 10) || 30);
      return NextResponse.json({ success: true, user });
    }

    if (action === "revoke") {
      const success = await revokeUserVip(parsedUserId);
      return NextResponse.json({ success });
    }

    if (action === "extend") {
      const user = await extendUserVip(parsedUserId, parseInt(days, 10) || 30);
      return NextResponse.json({ success: true, user });
    }

    if (action === "delete") {
      const success = await deleteVipUser(parsedUserId);
      return NextResponse.json({ success });
    }

    if (action === "manual_add") {
      const user = await activateUserVip(parsedUserId, parseInt(days, 10) || 30);
      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
