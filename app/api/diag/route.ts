import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const tokenStatus = !token ? "MISSING" : token.startsWith("EAA") ? `OK (${token.slice(0,10)}...)` : `SET but unusual (${token.slice(0,6)}...)`;
  const phoneIdStatus = !phoneId ? "MISSING" : `OK: ${phoneId}`;

  // Test a call to the WhatsApp API to verify token
  let apiTest: any = null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    apiTest = await res.json();
  } catch (e: any) {
    apiTest = { fetchError: e.message };
  }

  return NextResponse.json({
    token: tokenStatus,
    phoneNumberId: phoneIdStatus,
    apiTest,
  });
}
