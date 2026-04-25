import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const conversations = await getConversations();
  return NextResponse.json({ conversations });
}
