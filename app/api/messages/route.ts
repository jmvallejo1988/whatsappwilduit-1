import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const raw = await getMessages(phone);
  // Handle both old format {id, text, direction, timestamp} and new bot format {role, content, ts}
  const messages = (raw as unknown as Record<string, unknown>[]).map((m, i) => {
    const text = (m.text as string) || (m.content as string) || "";
    const direction = (m.direction as string) || (m.role === "assistant" ? "outbound" : "inbound");
    const timestamp = (m.timestamp as number) || (m.ts as number) || 0;
    const id = (m.id as string) || `${timestamp}_${i}`;
    return { id, text, direction, timestamp };
  });
  return NextResponse.json({ messages });
}
