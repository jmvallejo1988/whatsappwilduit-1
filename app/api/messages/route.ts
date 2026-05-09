import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveOutboundMessage } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const raw = await getMessages(phone);
  // Handle both old format {id, text, direction, timestamp} and new bot format {role, content, ts}
  const messages = (raw as Record<string, unknown>[]).map((m, i) => {
    const text = (m.text as string) || (m.content as string) || "";
    const direction = (m.direction as string) || (m.role === "assistant" ? "outbound" : "inbound");
    const timestamp = (m.timestamp as number) || (m.ts as number) || 0;
    const id = (m.id as string) || `${timestamp}_${i}`;
    return { id, text, direction, timestamp };
  });
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
