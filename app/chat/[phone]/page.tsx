"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  text: string;
  direction: string;
  timestamp: number;
}

export default function ChatPage({ params }: { params: { phone: string } }) {
  const { phone } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"bot" | "human">("bot");
  const [botCount, setBotCount] = useState(0);
  const [labels, setLabels] = useState<Array<{id:string;name:string;color:string}>>([]);
  const [convLabelIds, setConvLabelIds] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?phone=${phone}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) { console.error("fetchMessages error:", e); }
  }, [phone]);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/bot-status?phone=${phone}`);
      if (!res.ok) return;
      const data = await res.json();
      setMode(data.mode);
      setBotCount(data.count || 0);
    } catch (e) { console.error("fetchBotStatus error:", e); }
  }, [phone]);

  useEffect(() => {
    fetchMessages();
    fetchBotStatus();
    Promise.all([
      fetch("/api/labels").then(r => r.json()).then(d => setLabels(d.labels || [])),
      fetch(`/api/conv-labels?phone=${phone}`).then(r => r.json()).then(d => setConvLabelIds(d.labelIds || [])),
    ]).catch(()=>{});
    const i1 = setInterval(fetchMessages, 3000);
    const i2 = setInterval(fetchBotStatus, 5000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [fetchMessages, fetchBotStatus, phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleLabel = async (labelId: string) => {
    try {
      const res = await fetch("/api/conv-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, labelId }),
      });
      const data = await res.json();
      setConvLabelIds(data.labelIds || []);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text }),
      });
      await fetchMessages();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleTakeover = async () => {
    try {
      await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "takeover", phone }),
      });
      setMode("human");
    } catch (e) { console.error(e); }
  };

  const handleHandback = async () => {
    try {
      await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "handback", phone }),
      });
      setMode("bot");
      setBotCount(0);
    } catch (e) { console.error(e); }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-screen bg-[#111b21] flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[#202c33] px-3 py-2 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push("/chat")} className="text-[#8696a0] hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">+{phone}</p>
          <div className="flex items-center gap-1.5">
            {mode === "bot" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                <span className="text-purple-400 text-xs">Bot IA activo · {botCount} msgs</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#00a884] inline-block"></span>
                <span className="text-[#00a884] text-xs">Asesor humano</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="text-[#8696a0] hover:text-white p-1"
            title="Etiquetas"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          </button>
          {mode === "bot" ? (
            <button onClick={handleTakeover}
              className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors font-medium">
              Tomar control
            </button>
          ) : (
            <button onClick={handleHandback}
              className="bg-[#2a3942] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg hover:bg-[#3d4a52] transition-colors">
              Activar bot
            </button>
          )}
        </div>
      </div>

      {/* Label panel */}
      {showLabels && labels.length > 0 && (
        <div className="bg-[#1a2530] border-b border-[#2a3942] px-4 py-2 flex flex-wrap gap-1.5">
          {labels.map((l) => {
            const active = convLabelIds.includes(l.id);
            return (
              <button key={l.id} onClick={() => toggleLabel(l.id)}
                className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
                style={{
                  backgroundColor: active ? l.color : l.color + "22",
                  color: active ? "#fff" : l.color,
                  border: `1px solid ${l.color}`,
                  opacity: active ? 1 : 0.7,
                }}>
                {active ? "✓ " : ""}{l.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-[#8696a0] text-sm mt-20">Sin mensajes aún</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} mb-1`}>
            <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
              msg.direction === "outbound"
                ? "bg-[#005c4b] text-white rounded-tr-sm"
                : "bg-[#202c33] text-white rounded-tl-sm"
            }`}>
              <p className="leading-relaxed">{msg.text}</p>
              <p className="text-[10px] mt-1 text-right text-[#8696a0]">
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-[#202c33] px-3 py-3 flex items-end gap-2">
        {mode === "bot" && (
          <div className="w-full text-center py-2 text-purple-400 text-xs bg-purple-900/20 rounded-xl">
            El bot está respondiendo automáticamente ·{" "}
            <button onClick={handleTakeover} className="underline">Tomar control</button>
          </div>
        )}
        {mode === "human" && (
          <>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 bg-[#2a3942] text-white rounded-2xl px-4 py-3 focus:outline-none placeholder-[#8696a0] text-sm resize-none max-h-24"
            />
            <button onClick={sendMessage} disabled={sending || !input.trim()}
              className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center hover:bg-[#06cf9c] transition-colors disabled:opacity-50 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
