import { NextRequest, NextResponse } from "next/server";
import { getBotCount } from "@/lib/bot";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const humanMode = await redis.get<boolean>(`bot:human:${phone}`);
  const count = await getBotCount(phone);
  const mode: "bot" | "human" = humanMode ? "human" : "bot";

  return NextResponse.json({ mode, count });
}
