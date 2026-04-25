import { NextRequest, NextResponse } from "next/server";
import { getConvLabels, toggleConvLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });
  const labelIds = await getConvLabels(phone);
  return NextResponse.json({ labelIds });
}

export async function POST(request: NextRequest) {
  const { phone, labelId } = await request.json();
  if (!phone || !labelId) return NextResponse.json({ error: "phone and labelId required" }, { status: 400 });
  const labelIds = await toggleConvLabel(phone, labelId);
  return NextResponse.json({ labelIds });
}
