import { NextRequest, NextResponse } from "next/server";
import { saveSubscription, sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.subscription) {
    await saveSubscription(body.subscription);
    return NextResponse.json({ success: true });
  }
  if (body.title) {
    await sendPushToAll(body.title, body.body || "", body.data);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Invalid" }, { status: 400 });
}
