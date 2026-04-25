import { NextRequest, NextResponse } from "next/server";
import { getLabels, createLabel, deleteLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET() {
  const labels = await getLabels();
  return NextResponse.json({ labels });
}

export async function POST(request: NextRequest) {
  const { name, id, action } = await request.json();
  if (action === "delete" && id) {
    await deleteLabel(id);
    return NextResponse.json({ success: true });
  }
  if (name) {
    const label = await createLabel(name);
    return NextResponse.json({ label });
  }
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
