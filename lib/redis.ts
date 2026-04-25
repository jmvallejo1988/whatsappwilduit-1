import { createClient } from '@vercel/kv';

export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'received';
  name?: string;
  type?: string;
}

export interface Conversation {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: number;
}

const OUR_NUMBER = process.env.OUR_PHONE_NUMBER || '12013619941';

// Lazy KV client — only created when first used (avoids build-time crash)
let _kv: ReturnType<typeof createClient> | null = null;
function getKv() {
  if (!_kv) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required');
    }
    _kv = createClient({ url, token });
  }
  return _kv;
}

export async function saveInboundMessage(
  from: string,
  text: string,
  messageId: string,
  contactName?: string,
  timestamp?: number
): Promise<Message> {
  const kv = getKv();
  const phoneKey = from.replace(/[^0-9]/g, '');
  const message: Message = {
    id: messageId,
    from: phoneKey,
    to: OUR_NUMBER,
    text,
    timestamp: timestamp ?? Date.now(),
    direction: 'inbound',
    status: 'received',
    name: contactName,
  };

  await kv.lpush(`messages:${phoneKey}`, JSON.stringify(message));
  await kv.ltrim(`messages:${phoneKey}`, 0, 199);

  await kv.hset(`conversation:${phoneKey}`, {
    phone: phoneKey,
    name: contactName || phoneKey,
    lastMessage: text.substring(0, 80),
    lastTimestamp: message.timestamp,
  });
  await kv.zadd('conversations', { score: message.timestamp, member: phoneKey });

  return message;
}

export async function saveOutboundMessage(
  to: string,
  text: string,
  messageId: string
): Promise<Message> {
  const kv = getKv();
  const phoneKey = to.replace(/[^0-9]/g, '');
  const message: Message = {
    id: messageId,
    from: OUR_NUMBER,
    to: phoneKey,
    text,
    timestamp: Date.now(),
    direction: 'outbound',
    status: 'sent',
  };

  await kv.lpush(`messages:${phoneKey}`, JSON.stringify(message));
  await kv.ltrim(`messages:${phoneKey}`, 0, 199);

  await kv.hset(`conversation:${phoneKey}`, {
    phone: phoneKey,
    lastMessage: text.substring(0, 80),
    lastTimestamp: message.timestamp,
  });
  await kv.zadd('conversations', { score: message.timestamp, member: phoneKey });

  return message;
}

export async function getMessages(phone: string, limit = 60): Promise<Message[]> {
  const kv = getKv();
  const phoneKey = phone.replace(/[^0-9]/g, '');
  const raw = await kv.lrange(`messages:${phoneKey}`, 0, limit - 1);
  const messages = raw.map((m) =>
    typeof m === 'string' ? (JSON.parse(m) as Message) : (m as Message)
  );
  return messages.reverse();
}

export async function getConversations(): Promise<Conversation[]> {
  const kv = getKv();
  const phones = (await kv.zrange('conversations', 0, 49, { rev: true })) as string[];
  if (!phones.length) return [];

  const conversations: Conversation[] = [];
  for (const phone of phones) {
    const conv = await kv.hgetall(`conversation:${phone}`);
    if (conv) conversations.push(conv as unknown as Conversation);
  }
  return conversations;
}
