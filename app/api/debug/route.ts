import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {};

  // Check env vars
  checks.GEMINI_API_KEY = process.env.GEMINI_API_KEY ? "SET (" + process.env.GEMINI_API_KEY.slice(0,8) + "...)" : "MISSING";
  checks.KV_REST_API_URL = process.env.KV_REST_API_URL ? "SET" : "MISSING";
  checks.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN ? "SET" : "MISSING";
  checks.WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN ? "SET" : "MISSING";
  checks.WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "MISSING";

  // Check KV connection
  try {
    await kv.set("debug:ping", "pong");
    const val = await kv.get("debug:ping");
    checks.KV_CONNECTION = val === "pong" ? "OK" : "FAIL (unexpected value)";
  } catch (e: unknown) {
    checks.KV_CONNECTION = "ERROR: " + (e instanceof Error ? e.message : String(e));
  }

  // Check bot config in KV
  try {
    const config = await kv.get("bot:config");
    checks.BOT_CONFIG_IN_KV = config ? "FOUND" : "NOT SET (using defaults)";
  } catch (e: unknown) {
    checks.BOT_CONFIG_IN_KV = "ERROR: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks, { status: 200 });
}
