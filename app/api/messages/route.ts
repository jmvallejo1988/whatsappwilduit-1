import { NextRequest, NextResponse } from 'next/server';
import { getMessages, saveOutboundMessage } from '@/lib/redis';
import { sendTextMessage } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone');
  if (\!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 });

  const messages = await getMessages(phone);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const { phone, text } = await request.json();
  if (\!phone || \!text) {
    return NextResponse.json({ error: 'Phone and text required' }, { status: 400 });
  }

  try {
    const result = await sendTextMessage(phone, text);
    const messageId = result.messages?.[0]?.id ?? `local_${Date.now()}`;
    const message = await saveOutboundMessage(phone, text, messageId);
    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send' },
      { status: 500 }
    );
  }
}
