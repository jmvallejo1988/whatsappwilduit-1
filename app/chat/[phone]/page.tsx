"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  text: string;
  direction: string;
  timestamp: number;
  mediaType?: string | null;
  mediaUrl?: string | null;
}

export default function ChatPage({ params }: { params: { phone: string } }) {
  const { phone } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"bot" | "human">("bot");
  const [botCount, setBotCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?phone=${phone}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }, [phone]);

  const fetchBotStatus = useCallback(async () => {
    const res = await fetch(`/api/bot-status?phone=${phone}`);
    if (!res.ok) return;
    const data = await res.json();
    setMode(data.mode);
    setBotCount(data.count || 0);
  }, [phone]);

  useEffect(() => {
    fetchMessages();
    fetchBotStatus();
    const i1 = setInterval(fetchMessages, 3000);
    const i2 = setInterval(fetchBotStatus, 5000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [fetchMessages, fetchBotStatus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File) => {
    setSending(true);
    try {
      const form = new FormData();
      form.append("phone", phone);
      form.append("file", file);
      await fetch("/api/media", { method: "POST", body: form });
      await fetchMessages();
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        await sendFile(new File([blob], "voice.ogg", { type: "audio/ogg" }));
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleTakeover = async () => {
    await fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "takeover", phone }) });
    setMode("human");
  };

  const handleHandback = async () => {
    await fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "handback", phone }) });
    setMode("bot");
    setBotCount(0);
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

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
              <><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span><span className="text-purple-400 text-xs">Bot IA activo · {botCount} msgs</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-[#00a884] inline-block"></span><span className="text-[#00a884] text-xs">Asesor humano</span></>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {mode === "bot" ? (
            <button onClick={handleTakeover} className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors font-medium">Tomar control</button>
          ) : (
            <button onClick={handleHandback} className="bg-[#2a3942] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg hover:bg-[#3d4a52] transition-colors">Activar bot</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {messages.length === 0 && <div className="text-center text-[#8696a0] text-sm mt-20">Sin mensajes aún</div>}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} mb-1`}>
            <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${msg.direction === "outbound" ? "bg-[#005c4b] text-white rounded-tr-sm" : "bg-[#202c33] text-white rounded-tl-sm"}`}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text || (msg.mediaType === "image" ? "📷 Imagen" : msg.mediaType === "audio" ? "🎤 Audio" : "📎 Archivo")}</p>
              <p className="text-[10px] mt-1 text-right text-[#8696a0]">{formatTime(msg.timestamp)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-[#202c33] px-3 py-3 flex items-end gap-2">
        {mode === "bot" && (
          <div className="w-full text-center py-2 text-purple-400 text-xs bg-purple-900/20 rounded-xl">
            El bot está respondiendo · <button onClick={handleTakeover} className="underline">Tomar control</button>
          </div>
        )}
        {mode === "human" && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ""; }} />
            {/* Image button */}
            <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-white hover:bg-[#3d4a52] transition-colors flex-shrink-0 disabled:opacity-40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            {/* Text area */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 bg-[#2a3942] text-white rounded-2xl px-4 py-3 focus:outline-none placeholder-[#8696a0] text-sm resize-none max-h-24"
            />
            {/* Mic / Send button */}
            {input.trim() ? (
              <button onClick={sendMessage} disabled={sending} className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center hover:bg-[#06cf9c] transition-colors disabled:opacity-50 flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            ) : (
              <button
                onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                disabled={sending}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${recording ? "bg-red-500 hover:bg-red-600" : "bg-[#00a884] hover:bg-[#06cf9c]"} disabled:opacity-50`}
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
