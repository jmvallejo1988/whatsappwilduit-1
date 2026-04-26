
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Conversation {
  phone: string; name: string; lastMessage: string; lastTimestamp: number;
}
interface Label { id: string; name: string; color: string; }

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw).map((c: string) => c.charCodeAt(0)));
}

export default function ChatListPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [convLabels, setConvLabels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [newPhone, setNewPhone] = useState("");
  const [botActive, setBotActive] = useState(true);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [showLabelMgr, setShowLabelMgr] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"granted"|"denied"|"default">("default");
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    try {
      const [convRes, labRes, botRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch("/api/labels"),
        fetch("/api/bot"),
      ]);
      const convData = await convRes.json();
      const labData = await labRes.json();
      const botData = await botRes.json();
      const convs: Conversation[] = convData.conversations || [];
      setConversations(convs);
      setLabels(labData.labels || []);
      setBotActive(botData.config?.active ?? true);

      // Fetch conv labels for each conversation
      const entries = await Promise.all(
        convs.map(async (c) => {
          const r = await fetch(`/api/conv-labels?phone=${c.phone}`);
          const d = await r.json();
          return [c.phone, d.labelIds || []] as [string, string[]];
        })
      );
      setConvLabels(Object.fromEntries(entries));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 8000);
    // Check notification permission
    if ("Notification" in window) setNotifStatus(Notification.permission as "granted"|"denied"|"default");
    return () => clearInterval(iv);
  }, [fetchAll]);

  const requestNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm as "granted"|"denied"|"default");
    if (perm !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push");
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch (e) { console.error("Push subscribe error:", e); }
  };

  const handleNewChat = async () => {
    const clean = newPhone.replace(/[^0-9]/g, "");
    if (clean.length >= 7) {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      router.push(`/chat/${clean}`);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabelName }),
    });
    setNewLabelName("");
    fetchAll();
  };

  const handleDeleteLabel = async (id: string) => {
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    fetchAll();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
  };

  const avatarColor = (name: string) => {
    const colors = ["#6b7c85","#00a884","#128C7E","#075E54","#34B7F1","#7C3AED"];
    return colors[String(name).charCodeAt(0) % colors.length];
  };

  const isOverdue = (ts: number) => Date.now() - ts > 24 * 60 * 60 * 1000;

  const labelMap = Object.fromEntries(labels.map((l) => [l.id, l]));

  const filtered = filterLabel
    ? conversations.filter((c) => (convLabels[c.phone] || []).includes(filterLabel))
    : conversations;

  return (
    <div className="h-screen bg-[#111b21] flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-white text-xl font-semibold">WA Manager</h1>
          <p className="text-[#8696a0] text-xs">Wilduit · {conversations.length} chats</p>
        </div>
        <div className="flex items-center gap-1.5">
          {notifStatus !== "granted" && (
            <button onClick={requestNotifications} title="Activar notificaciones"
              className="text-yellow-400 hover:text-yellow-300 p-1">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
            </button>
          )}
          <Link href="/config"
            className="flex items-center gap-1 bg-purple-900/40 text-purple-400 text-xs px-2 py-1.5 rounded-lg hover:bg-purple-900/60">
            <span>{botActive ? "🤖" : "⚫"}</span>
            <span>Bot</span>
          </Link>
          <button onClick={() => setShowLabelMgr(!showLabelMgr)}
            className="text-[#8696a0] hover:text-white p-1" title="Etiquetas">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          </button>
          <button onClick={fetchAll} className="text-[#8696a0] hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <button onClick={handleLogout} className="text-[#8696a0] hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Label manager panel */}
      {showLabelMgr && (
        <div className="bg-[#1a2530] border-b border-[#2a3942] px-4 py-3">
          <p className="text-white text-sm font-medium mb-2">Gestionar etiquetas</p>
          <div className="flex gap-2 mb-2">
            <input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
              placeholder="Nueva etiqueta..." className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none placeholder-[#8696a0]"/>
            <button onClick={handleCreateLabel}
              className="bg-[#00a884] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#06cf9c]">
              + Crear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <div key={l.id} className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: l.color + "33", border: `1px solid ${l.color}` }}>
                <span style={{ color: l.color }}>{l.name}</span>
                <button onClick={() => handleDeleteLabel(l.id)} className="text-[#8696a0] hover:text-red-400 ml-0.5">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label filter */}
      {labels.length > 0 && (
        <div className="px-3 py-2 flex gap-1.5 overflow-x-auto scrollbar-hide bg-[#111b21]">
          <button onClick={() => setFilterLabel(null)}
            className={`flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterLabel === null ? "bg-[#00a884] text-white" : "bg-[#2a3942] text-[#8696a0]"}`}>
            Todos
          </button>
          {labels.map((l) => (
            <button key={l.id} onClick={() => setFilterLabel(filterLabel === l.id ? null : l.id)}
              className="flex-shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-colors"
              style={{ backgroundColor: filterLabel === l.id ? l.color : l.color + "22", color: filterLabel === l.id ? "#fff" : l.color, border: `1px solid ${l.color}` }}>
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* New chat input */}
      <div className="px-3 py-2 bg-[#111b21]">
        <div className="flex gap-2">
          <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewChat()}
            placeholder="Número nuevo (ej: 593963018853)"
            className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none placeholder-[#8696a0]"/>
          <button onClick={handleNewChat}
            className="bg-[#00a884] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#06cf9c]">Abrir</button>
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 px-8 text-center">
            <p className="text-[#8696a0] text-sm">{filterLabel ? "Sin chats con esa etiqueta" : "Sin conversaciones todavía"}</p>
          </div>
        ) : (
          <div>
            {filtered.map((conv) => {
              const convLabelIds = convLabels[conv.phone] || [];
              const convLabelObjs = convLabelIds.map((id) => labelMap[id]).filter(Boolean);
              const overdue = isOverdue(conv.lastTimestamp) && conv.lastTimestamp > 0;
              return (
                <Link key={conv.phone} href={`/chat/${conv.phone}`}
                  className="flex items-center px-4 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/50 relative">
                  {overdue && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-400"/>}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-white text-lg font-semibold"
                    style={{ backgroundColor: avatarColor(String(conv.name || conv.phone || "?")) }}>
                    {String(conv.name || conv.phone || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium truncate">
                        {conv.name && conv.name !== conv.phone ? conv.name : `+${conv.phone}`}
                        {overdue && <span className="ml-1.5 text-orange-400 text-xs">⏰ 24h</span>}
                      </span>
                      {conv.lastTimestamp > 0 && (
                        <span className={`text-xs ml-2 flex-shrink-0 ${overdue ? "text-orange-400" : "text-[#8696a0]"}`}>
                          {formatTime(conv.lastTimestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-[#8696a0] text-sm truncate mt-0.5">{conv.lastMessage}</p>
                    {convLabelObjs.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {convLabelObjs.map((l) => (
                          <span key={l.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: l.color + "22", color: l.color, border: `1px solid ${l.color}55` }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
