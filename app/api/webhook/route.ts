import { NextRequest, NextResponse } from 'next/server';
import { saveInboundMessage } from '@/lib/redis';

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'wilduit-webhook-2024';

// Meta webhook verification
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Receive messages from Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object \!== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ok' });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (\!value?.messages) continue;

        // Map contact names
        const contactMap: Record<string, string> = {};
        for (const c of value.contacts ?? []) {
          contactMap[c.wa_id] = c.profile?.name ?? c.wa_id;
        }

        for (const msg of value.messages) {
          let text = '';

          if (msg.type === 'text') {
            text = msg.text?.body ?? '';
          } else if (msg.type === 'image') {
            text = '📷 Imagen';
          } else if (msg.type === 'audio') {
            text = '🎵 Audio';
          } else if (msg.type === 'video') {
            text = '🎥 Video';
          } else if (msg.type === 'document') {
            text = `📄 ${msg.document?.filename ?? 'Documento'}`;
          } else if (msg.type === 'location') {
            text = '📍 Ubicación';
          } else if (msg.type === 'sticker') {
            text = '🖼️ Sticker';
          } else {
            text = `[${msg.type}]`;
          }

          await saveInboundMessage(
            msg.from,
            text,
            msg.id,
            contactMap[msg.from],
            parseInt(msg.timestamp) * 1000
          );
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
