import { NextRequest, NextResponse } from "next/server";
import { saveMessage } from "@/lib/bot";
import { saveConversationMeta } from "@/lib/redis";

const TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const API = `https://graph.facebook.com/v20.0/${PHONE_ID}`;

export const dynamic = "force-dynamic";

// Upload media file to WhatsApp and return media_id
async function uploadToWhatsApp(blob: Blob, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "media");
  form.append("type", mimeType);
  form.append("messaging_product", "whatsapp");

  const res = await fetch(`${API}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!data.id) throw new Error(`WA media upload failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

// Send media message via WhatsApp
async function sendMedia(to: string, mediaId: string, type: "image" | "audio" | "document", caption?: string) {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type,
    [type]: { id: mediaId, ...(caption && type === "image" ? { caption } : {}) },
  };
  const res = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const phone = form.get("phone") as string;
    const file = form.get("file") as File;
    const caption = (form.get("caption") as string) || "";

    if (!phone || !file) return NextResponse.json({ error: "phone and file required" }, { status: 400 });

    const mimeType = file.type || "application/octet-stream";
    let waType: "image" | "audio" | "document" = "document";
    if (mimeType.startsWith("image/")) waType = "image";
    else if (mimeType.startsWith("audio/")) waType = "audio";

    const mediaId = await uploadToWhatsApp(file, mimeType);
    await sendMedia(phone, mediaId, waType, caption);

    const label = waType === "image" ? (caption || "📷 Imagen") : waType === "audio" ? "🎤 Nota de voz" : `📄 ${file.name}`;
    await saveMessage(phone, "assistant", label);
    await saveConversationMeta(phone, phone, label);

    return NextResponse.json({ ok: true, mediaId, type: waType });
  } catch (err) {
    console.error("MEDIA_SEND_ERROR", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
