import { NextRequest, NextResponse } from "next/server";
import { getMessages, saveOutboundMessage } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";

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

  // Save to KV first
  const tempId = `local_${Date.now()}`;
  const message = await saveOutboundMessage(phone, text, tempId);

  // Send via WhatsApp
  let waError: string | null = null;
  try {
    const result = await sendTextMessage(phone, text);
    console.log("WA send OK:", JSON.stringify(result));
  } catch (error) {
    waError = error instanceof Error ? error.message : String(error);
    // Log the FULL error so we can see it in Vercel logs
    console.error("WA SEND FAILED:", waError);
  }

  return NextResponse.json({
    success: !waError,
    message,
    whatsappError: waError,
  });
}

// Diagnostic endpoint: GET /api/messages?diag=1
// Returns env var status (masked) and a test send result
