'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  status: string;
  name?: string;
}

export default function ChatPage({ params }: { params: { phone: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [contactName, setContactName] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { phone } = params;

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?phone=${phone}`);
      const data = await res.json();
      const msgs: Message[] = data.messages || [];
      setMessages(msgs);
      const named = msgs.find((m) => m.direction === 'inbound' && m.name);
      if (named?.name) setContactName(named.name);
    } catch (e) {
      console.error(e);
    }
  }, [phone]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Separate send logic from event handling to avoid type conflicts
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    setError('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text }),
      });
      if (res.ok) {
        await fetchMessages();
      } else {
        const data = await res.json();
        setError(data.error || 'Error al enviar');
        setInput(text);
      }
    } catch {
      setError('Error de conexión');
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, sending, phone, fetchMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Hoy';
    const yday = new Date(now);
    yday.setDate(now.getDate() - 1);
    if (d.toDateString() === yday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  };

  // Group by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const dk = new Date(msg.timestamp).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === dk) last.msgs.push(msg);
    else grouped.push({ date: dk, msgs: [msg] });
  });

  const displayName = contactName || `+${phone}`;

  return (
    <div className="h-screen flex flex-col max-w-md mx-auto bg-[#0b141a]">
      {/* Header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-[#8696a0] hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 bg-[#6b7c85] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-medium truncate">{displayName}</h2>
          <p className="text-[#8696a0] text-xs">+{phone}</p>
        </div>
        <button onClick={fetchMessages} className="text-[#8696a0] hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 chat-bg">
        {messages.length === 0 && (
          <div className="flex justify-center mt-8">
            <span className="bg-[#182229] text-[#8696a0] text-xs px-4 py-2 rounded-full">
              Sin mensajes aún
            </span>
          </div>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-full">
                {fmtDate(msgs[0].timestamp)}
              </span>
            </div>
            {msgs.map((msg, i) => {
              const isOut = msg.direction === 'outbound';
              const showTail =
                i === msgs.length - 1 || msgs[i + 1]?.direction !== msg.direction;
              return (
                <div key={msg.id} className={`flex mb-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] px-3 py-2 shadow-sm ${
                      isOut
                        ? `bg-[#005c4b] text-white ${showTail ? 'rounded-t-lg rounded-bl-lg' : 'rounded-lg'}`
                        : `bg-[#202c33] text-white ${showTail ? 'rounded-t-lg rounded-br-lg' : 'rounded-lg'}`
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-[10px] text-[#8696a0]">{fmtTime(msg.timestamp)}</span>
                      {isOut && (
                        <svg className="w-4 h-3 text-[#53bdeb]" fill="currentColor" viewBox="0 0 16 11">
                          <path d="M11.071.653a.75.75 0 0 1 .025 1.06L4.999 7.88 2.904 5.875a.75.75 0 1 0-1.043 1.078L4.472 9.65a.75.75 0 0 0 1.055-.012l6.49-6.563a.75.75 0 0 0-1.06-1.06z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 text-red-300 text-xs text-center px-4 py-2">
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="bg-[#202c33] px-3 py-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje"
          rows={1}
          className="flex-1 bg-[#2a3942] text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none placeholder-[#8696a0] resize-none max-h-32 overflow-y-auto"
          disabled={sending}
          style={{ lineHeight: '1.4' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#06cf9c] active:bg-[#05b589] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
