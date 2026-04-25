import { NextRequest, NextResponse } from "next/server";
import { getConversations } from "@/lib/redis";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const conversations = await getConversations();
  return NextResponse.json({ conversations });
}

// Create/touch a conversation entry so it appears in the list
export async function POST(request: NextRequest) {
  const { phone, name } = await request.json();
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const phoneKey = phone.replace(/[^0-9]/g, "");
  const now = Date.now();

  // Only create if it does not already exist
  const existing = await kv.hgetall(`conversation:${phoneKey}`);
  if (!existing) {
    await kv.hset(`conversation:${phoneKey}`, {
      phone: phoneKey,
      name: name || phoneKey,
      lastMessage: "",
      lastTimestamp: now,
    });
    await kv.zadd("conversations", { score: now, member: phoneKey });
  }

  return NextResponse.json({ success: true });
}
