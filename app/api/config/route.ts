import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const CONFIG_KEY = 'config:whatsapp'

export async function GET() {
  try {
    const stored = await redis.get<Record<string, string>>(CONFIG_KEY)
    return NextResponse.json({
      phoneNumberId: stored?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      ...(stored || {}),
    })
  } catch {
    return NextResponse.json({ phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '' })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const existing = await redis.get<Record<string, string>>(CONFIG_KEY) || {}
  const updated = { ...existing, ...body }
  await redis.set(CONFIG_KEY, updated)
  return NextResponse.json({ ok: true, config: updated })
}
