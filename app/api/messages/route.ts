import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveOutboundMessage } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const raw = await getMessages(phone);
  const messages = raw.map((m: { role: string; content: string; ts: number }, i: number) => ({
    id: `${m.ts}_${i}`,
    text: m.content,
    direction: m.role === "assistant" ? "outbound" : "inbound",
    timestamp: m.ts,
  }));
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const { phone, text } = await request.json();
  if (!phone || !text) {
    return NextResponse.json({ error: "Phone and text required" }, { status: 400 });
  }

  // Save outbound message to Redis (phone used as name fallback)
  await saveOutboundMessage(phone, phone, text);

  // Send via WhatsApp
  let waError: string | null = null;
  try {
    const result = await sendTextMessage(phone, text);
    console.log("WA send OK:", JSON.stringify(result));
  } catch (error) {
    waError = error instanceof Error ? error.message : String(error);
    console.error("WA SEND FAILED:", waError);
  }

  return NextResponse.json({
    success: !waError,
    whatsappError: waError,
  });
}
