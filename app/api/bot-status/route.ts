import { NextRequest, NextResponse } from "next/server";
import { getConversationMode, getBotCount } from "@/lib/bot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const mode = await getConversationMode(phone);
  const count = await getBotCount(phone);
  return NextResponse.json({ mode, count });
}
