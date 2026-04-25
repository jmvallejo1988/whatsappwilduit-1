"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BotConfig {
  active: boolean;
  maxMessages: number;
  handoffMessage: string;
  systemPrompt: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/bot")
      .then((r) => r.json())
      .then((d) => setConfig(d.config));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!config) {
    return (
      <div className="h-screen bg-[#111b21] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111b21] text-white max-w-md mx-auto">
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 sticky top-0">
        <button onClick={() => router.push("/chat")} className="text-[#8696a0] hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-white font-semibold">Configurar Bot IA</h1>
          <p className="text-[#8696a0] text-xs">Gemini AI · Wilduit Marketing</p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Active toggle */}
        <div className="bg-[#202c33] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Bot activo</p>
            <p className="text-[#8696a0] text-xs mt-0.5">Responde automáticamente a mensajes nuevos</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, active: !config.active })}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.active ? "bg-[#00a884]" : "bg-[#2a3942]"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.active ? "translate-x-7" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Max messages */}
        <div className="bg-[#202c33] rounded-xl p-4">
          <label className="text-white font-medium block mb-1">Mensajes antes del traspaso</label>
          <p className="text-[#8696a0] text-xs mb-3">El bot responde este número de veces y luego pasa al asesor</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfig({ ...config, maxMessages: Math.max(1, config.maxMessages - 1) })}
              className="w-9 h-9 bg-[#2a3942] rounded-lg text-white text-xl flex items-center justify-center hover:bg-[#3d4a52]"
            >−</button>
            <span className="text-2xl font-bold text-[#00a884] w-8 text-center">{config.maxMessages}</span>
            <button
              onClick={() => setConfig({ ...config, maxMessages: Math.min(20, config.maxMessages + 1) })}
              className="w-9 h-9 bg-[#2a3942] rounded-lg text-white text-xl flex items-center justify-center hover:bg-[#3d4a52]"
            >+</button>
          </div>
        </div>

        {/* System prompt */}
        <div className="bg-[#202c33] rounded-xl p-4">
          <label className="text-white font-medium block mb-1">Instrucciones del bot</label>
          <p className="text-[#8696a0] text-xs mb-3">Define cómo se comporta el asistente IA</p>
          <textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            rows={8}
            className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0] resize-none"
          />
        </div>

        {/* Handoff message */}
        <div className="bg-[#202c33] rounded-xl p-4">
          <label className="text-white font-medium block mb-1">Mensaje de cierre</label>
          <p className="text-[#8696a0] text-xs mb-3">Lo que el bot dice antes de pasar al asesor</p>
          <textarea
            value={config.handoffMessage}
            onChange={(e) => setConfig({ ...config, handoffMessage: e.target.value })}
            rows={3}
            className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0] resize-none"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#00a884] text-white rounded-xl py-4 font-semibold hover:bg-[#06cf9c] transition-colors disabled:opacity-50"
        >
          {saved ? "✓ Guardado" : saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
