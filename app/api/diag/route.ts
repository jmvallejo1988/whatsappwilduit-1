import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const tokenStatus = !token
    ? "❌ MISSING"
    : token.startsWith("EAA")
    ? `✅ OK (${token.slice(0, 20)}...)`
    : `⚠️ SET but unusual prefix: ${token.slice(0, 10)}...`;

  const phoneIdStatus = !phoneId ? "❌ MISSING" : `✅ OK: ${phoneId}`;

  let apiTest: Record<string, unknown> = {};
  let sendTest: Record<string, unknown> = {};

  // Test 1: GET phone number info
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    apiTest = await res.json();
  } catch (e: unknown) {
    apiTest = { fetchError: e instanceof Error ? e.message : String(e) };
  }

  // Test 2: Try sending a message to the phone number itself (loopback test)
  // This will fail gracefully but reveal the exact error code
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: "1234567890", // dummy number to get real API errors
          type: "text",
          text: { body: "diag test" },
        }),
      }
    );
    sendTest = await res.json();
  } catch (e: unknown) {
    sendTest = { fetchError: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    token: tokenStatus,
    phoneNumberId: phoneIdStatus,
    phoneInfoTest: apiTest,
    sendApiTest: sendTest,
  });
}
