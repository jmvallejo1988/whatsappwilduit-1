import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveConversationMeta } from "@/lib/redis";
import { saveMessage } from "@/lib/bot";
import { sendTextMessage } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const raw = await getMessages(phone);
  const messages = (raw as unknown as Record<string, unknown>[]).map((m, i) => {
    const text = (m.text as string) || (m.content as string) || "";
    const direction = (m.direction as string) || (m.role === "assistant" ? "outbound" : "inbound");
    const timestamp = (m.timestamp as number) || (m.ts as number) || 0;
    const id = (m.id as string) || `${timestamp}_${i}`;
    const mediaType = (m.mediaType as string) || null;
    const mediaUrl = (m.mediaUrl as string) || null;
    return { id, text, direction, timestamp, mediaType, mediaUrl };
  });
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, text } = body;
    if (!phone || !text) return NextResponse.json({ error: "phone and text required" }, { status: 400 });

    await sendTextMessage(phone, text);
    await saveMessage(phone, "assistant", text);
    await saveConversationMeta(phone, phone, text);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SEND_MSG_ERROR", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
