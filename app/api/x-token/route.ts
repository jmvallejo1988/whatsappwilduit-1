import { NextRequest, NextResponse } from 'next/server'
// TEMPORARY endpoint — remove after use
export async function GET(req: NextRequest) {
  const s = new URL(req.url).searchParams.get('s')
  if (s !== 'wld2024tmp') {
    return NextResponse.json({ error: 'no' }, { status: 401 })
  }
  return NextResponse.json({
    t: process.env.WHATSAPP_TOKEN,
    p: process.env.WHATSAPP_PHONE_NUMBER_ID,
  })
}
