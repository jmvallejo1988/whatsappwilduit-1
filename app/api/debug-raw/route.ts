import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  const raw = await redis.lrange(`messages:${phone}`, 0, 4);
  const debug = raw.map((r: unknown) => ({
    type: typeof r,
    isArray: Array.isArray(r),
    keys: (r && typeof r === "object") ? Object.keys(r as object) : null,
    value: r,
  }));
  return NextResponse.json({ count: raw.length, debug });
}
