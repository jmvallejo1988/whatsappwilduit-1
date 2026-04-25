import { GoogleGenerativeAI } from "@google/generative-ai";

export interface BotConfig {
  systemPrompt: string;
  maxMessages: number;
  handoffMessage: string;
  active: boolean;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  active: true,
  maxMessages: 5,
  handoffMessage: "Gracias por tu informacion. Un asesor especializado de Wilduit Marketing se pondra en contacto contigo muy pronto.",
  systemPrompt: `Eres el asistente virtual de Wilduit Marketing, una agencia de marketing digital. Tu mision es calificar a clientes potenciales de manera calida y profesional.

Flujo de conversacion:
- Mensaje 1: Saluda cordialmente y presentate como asistente de Wilduit Marketing
- Mensaje 2: Pregunta en que servicio estan interesados (redes sociales, ads pagados, branding, diseno web, etc.)
- Mensaje 3: Pregunta el presupuesto mensual aproximado disponible para marketing
- Mensaje 4: Pregunta si tienen algun lanzamiento proximo o urgencia particular
- Mensaje 5: Agradece la informacion y avisa que un asesor los contactara pronto

Reglas importantes:
- Respuestas MUY cortas (maximo 2-3 lineas)
- Una sola pregunta por mensaje
- Tono profesional pero cercano y calido
- Si preguntan precios especificos, di que un asesor los orientara con detalle
- No inventes precios ni hagas compromisos especificos
- Responde siempre en espanol`
};

export async function generateBotResponse(
  conversationHistory: Array<{ role: string; content: string }>,
  config: BotConfig
): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: config.systemPrompt,
  });

  // Build clean alternating history for Gemini
  // Gemini requires strictly alternating user/model turns
  const cleanHistory: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const msg of conversationHistory) {
    const geminiRole = msg.role === "outbound" ? "model" : "user";
    const lastEntry = cleanHistory[cleanHistory.length - 1];

    if (lastEntry && lastEntry.role === geminiRole) {
      // Merge consecutive same-role messages
      lastEntry.parts[0].text += "\n" + msg.content;
    } else {
      cleanHistory.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
  }

  // Last message must be from user - send it via sendMessage
  const lastUserMsg = cleanHistory.pop();
  if (!lastUserMsg) {
    throw new Error("No user message found in history");
  }

  const chat = model.startChat({ history: cleanHistory });
  const result = await chat.sendMessage(lastUserMsg.parts[0].text);
  const text = result.response.text();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}
