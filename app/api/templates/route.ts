import { NextRequest, NextResponse } from 'next/server'
import { getAllTemplates, setTemplate, TemplateType } from '@/lib/templates'

const VALID_TYPES: TemplateType[] = ['confirm', 'reminder', 'post']

// GET /api/templates
export async function GET() {
  const templates = await getAllTemplates()
  return NextResponse.json({ templates })
}

// PUT /api/templates
// body: { type: 'confirm'|'reminder'|'post', body: string }
export async function PUT(req: NextRequest) {
  const { type, body } = await req.json()

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be confirm, reminder, or post' }, { status: 400 })
  }
  if (!body || typeof body !== 'string') {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  await setTemplate(type as TemplateType, body)
  return NextResponse.json({ ok: true })
}
