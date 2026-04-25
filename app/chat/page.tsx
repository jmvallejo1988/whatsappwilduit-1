"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Conversation {
  phone: string;
  name: string;
  lastMessage: string;
  lastTimestamp: number;
}

export default function ChatListPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState("");
  const [botActive, setBotActive] = useState(true);
  const router = useRouter();

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bot");
      const data = await res.json();
      setBotActive(data.config?.active ?? true);
    } catch {}
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchBotStatus();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchBotStatus]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleNewChat = async () => {
    const clean = newPhone.replace(/[^0-9]/g, "");
    if (clean.length >= 7) {
      // Persist conversation in KV so it survives refresh
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      router.push(`/chat/${clean}`);
    }
  };

  const avatarColor = (name: string) => {
    const colors = ["#6b7c85", "#00a884", "#128C7E", "#075E54", "#34B7F1", "#7C3AED"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="h-screen bg-[#111b21] flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-white text-xl font-semibold">WA Manager</h1>
          <p className="text-[#8696a0] text-xs">+1 (201) 361-9941</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/config"
            className="flex items-center gap-1.5 bg-purple-900/40 text-purple-400 text-xs px-2.5 py-1.5 rounded-lg hover:bg-purple-900/60 transition-colors"
          >
            <span>{botActive ? "🤖" : "⚫"}</span>
            <span>Bot IA</span>
          </Link>
          <button onClick={fetchConversations} className="text-[#8696a0] hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={handleLogout} className="text-[#8696a0] hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* New chat input */}
      <div className="px-3 py-2 bg-[#111b21]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewChat()}
            placeholder="Número nuevo (ej: 593963018853)"
            className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none placeholder-[#8696a0]"
          />
          <button
            onClick={handleNewChat}
            className="bg-[#00a884] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#06cf9c] transition-colors"
          >
            Abrir
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 px-8 text-center">
            <div className="w-16 h-16 bg-[#2a3942] rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#8696a0]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <p className="text-[#8696a0] text-sm">Sin conversaciones todavía</p>
            <p className="text-[#8696a0] text-xs mt-1">El bot responderá automáticamente cuando lleguen mensajes</p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => (
              <Link
                key={conv.phone}
                href={`/chat/${conv.phone}`}
                className="flex items-center px-4 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/50"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white text-lg font-semibold"
                  style={{ backgroundColor: avatarColor(conv.name || conv.phone) }}
                >
                  {(conv.name || conv.phone).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium truncate">
                      {conv.name && conv.name !== conv.phone ? conv.name : `+${conv.phone}`}
                    </span>
                    {conv.lastTimestamp > 0 && (
                      <span className="text-[#8696a0] text-xs ml-2 flex-shrink-0">
                        {formatTime(conv.lastTimestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-[#8696a0] text-sm truncate mt-0.5">{conv.lastMessage}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
