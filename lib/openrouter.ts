export interface BotConfig {
  systemPrompt: string;
  maxMessages: number;
  handoffMessage: string;
  active: boolean;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  active: true,
  maxMessages: 6,
  handoffMessage:
    "¡Perfecto! Ya tengo todo lo que necesito 🙌 Un asesor de Wilduit Marketing te va a escribir pronto para darte una propuesta personalizada. ¡Que tengas un excelente día!",
  systemPrompt: `Eres el asistente virtual de Wilduit Marketing, una agencia especializada en marketing digital para profesionales de salud, estética y servicios. Hablas con personas que escribieron al WhatsApp de la agencia por primera vez.

Tu objetivo es conocer al prospecto de forma natural y calificarlo para pasarlo a un asesor humano. NO sigas un guion rígido — adapta la conversación según lo que el cliente te diga.

CÓMO ACTUAR:
- Si el cliente saluda o llega sin contexto: responde con calidez, preséntate brevemente y pregunta cómo puedes ayudarlo.
- Si el cliente ya explica qué necesita: reconoce lo que dijo y profundiza en ese punto específico antes de hacer otras preguntas.
- Sé empático y conversacional, como si fuera un chat real. Usa emojis con moderación (1-2 por mensaje máximo).
- Mensajes cortos: máximo 3 líneas. Una sola pregunta por turno.
- Siempre en español. Tuteo informal pero profesional.

INFORMACIÓN QUE DEBES RECOPILAR (de forma natural, no como cuestionario):
1. Qué tipo de negocio o actividad tiene
2. Qué necesita (redes sociales, pauta publicitaria, branding, diseño web, estrategia)
3. Si tiene urgencia o algún lanzamiento próximo

No preguntes todo de golpe. Deja que fluya la conversación. Si el cliente ya dio alguno de estos datos, no lo vuelvas a preguntar.

Cuando tengas suficiente información para que un asesor pueda dar una propuesta, avisa al cliente que vas a conectarlo con el equipo.`,
};

export async function generateBotResponse(
  conversationHistory: Array<{ role: string; content: string }>,
  config: BotConfig
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  // Build messages array in OpenAI format
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: config.systemPrompt },
  ];

  for (const msg of conversationHistory) {
    // "inbound" = user, "outbound" = assistant (bot)
    const role: "user" | "assistant" = msg.role === "outbound" ? "assistant" : "user";
    const last = messages[messages.length - 1];

    // Merge consecutive same-role messages
    if (last && last.role === role) {
      last.content += "\n" + msg.content;
    } else {
      messages.push({ role, content: msg.content });
    }
  }

  // Ensure last message is from user
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") {
    throw new Error("No hay mensaje de usuario para responder");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://whatsappwilduit-1.vercel.app",
      "X-Title": "WA Manager Wilduit",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Respuesta vacía de OpenRouter");
  return text;
}
