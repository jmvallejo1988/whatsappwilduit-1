import { NextRequest, NextResponse } from "next/server";
import { getConversations } from "@/lib/redis";
import { sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent public access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await getConversations();
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const reminders: string[] = [];

  for (const conv of conversations) {
    const elapsed = now - conv.lastTimestamp;
    if (elapsed >= h24 && elapsed < h24 * 2) {
      // Exactly in the 24-48h window — send reminder
      reminders.push(conv.phone);
      const name = conv.name && conv.name !== conv.phone ? conv.name : `+${conv.phone}`;
      await sendPushToAll(
        "Seguimiento pendiente",
        `Han pasado 24h sin respuesta de ${name}`,
        { phone: conv.phone, url: `/chat/${conv.phone}` }
      );
    }
  }

  return NextResponse.json({ checked: conversations.length, reminders });
}
