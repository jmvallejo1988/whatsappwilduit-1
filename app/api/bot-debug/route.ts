import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getBotConfig } from "@/lib/bot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  const config = await getBotConfig();

  const result: Record<string, unknown> = {
    globalConfig: config,
    openrouterKeySet: !!process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini (default)",
  };

  if (phone) {
    const humanMode = await kv.get(`bot:human:${phone}`);
    const count = await kv.get(`bot:count:${phone}`);
    result.phone = phone;
    result.humanMode = humanMode;
    result.botCount = count;
    result.willBotActivate =
      config.active && !humanMode && Number(count || 0) < config.maxMessages;
    result.reason = !config.active
      ? "PROBLEMA: bot:config.active = false"
      : humanMode
      ? `PROBLEMA: bot:human:${phone} = true (asesor tomó control, usar handback)`
      : Number(count || 0) >= config.maxMessages
      ? `PROBLEMA: bot:count = ${count} >= maxMessages (${config.maxMessages}) — resetear`
      : "OK — bot deberia activarse";
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === "reset-all") {
    const config = await getBotConfig();
    config.active = true;
    await kv.set("bot:config", config);
    return NextResponse.json({ success: true, message: "Bot activado globalmente" });
  }

  if (body.action === "reset" && body.phone) {
    await kv.del(`bot:human:${body.phone}`);
    await kv.set(`bot:count:${body.phone}`, 0);
    return NextResponse.json({ success: true, message: `Bot reseteado para ${body.phone}` });
  }

  return NextResponse.json({ error: "action: reset | reset-all" }, { status: 400 });
}
