import { NextRequest, NextResponse } from "next/server";
import { getBotConfig, saveBotConfig } from "@/lib/bot";
import { activateHumanMode, deactivateHumanMode } from "@/lib/bot";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getBotConfig();
  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === "takeover" && body.phone) {
    await activateHumanMode(body.phone);
    return NextResponse.json({ success: true, mode: "human" });
  }

  if (body.action === "handback" && body.phone) {
    await deactivateHumanMode(body.phone);
    return NextResponse.json({ success: true, mode: "bot" });
  }

  if (body.config) {
    await saveBotConfig(body.config);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
