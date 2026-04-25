import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveOutboundMessage, getConversations } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const messages = await getMessages(phone);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const { phone, text } = await request.json();
  if (!phone || !text) {
    return NextResponse.json({ error: "Phone and text required" }, { status: 400 });
  }

  // Save to KV first (regardless of WhatsApp success)
  const tempId = `local_${Date.now()}`;
  const message = await saveOutboundMessage(phone, text, tempId);

  // Then try to send via WhatsApp
  let waError: string | null = null;
  try {
    const result = await sendTextMessage(phone, text);
    const waMessageId = result.messages?.[0]?.id;
    if (waMessageId && waMessageId !== tempId) {
      // Update message id in place (best effort)
    }
  } catch (error) {
    waError = error instanceof Error ? error.message : "Failed to send";
    console.error("Send error:", error);
  }

  return NextResponse.json({
    success: true,
    message,
    whatsappError: waError,
  });
}
