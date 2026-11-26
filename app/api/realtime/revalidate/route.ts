import { NextResponse } from "next/server";
import { invalidateDbCache } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  invalidateDbCache();
  return NextResponse.json({ ok: true });
}
