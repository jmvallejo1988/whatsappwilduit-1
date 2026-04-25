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
- Mensaje 2: Pregunta en que servicio estan interesados (redes sociales, ads pagados, branding, diseno web)
- Mensaje 3: Pregunta el presupuesto mensual aproximado disponible para marketing
- Mensaje 4: Pregunta si tienen algun lanzamiento proximo o urgencia particular
- Mensaje 5: Agradece la informacion y avisa que un asesor los contactara pronto

Reglas: respuestas cortas (max 2-3 lineas), una sola pregunta por mensaje, tono profesional y calido, responde siempre en espanol.`
};

export async function generateBotResponse(
  conversationHistory: Array<{ role: string; content: string }>,
  config: BotConfig
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Build contents array with alternating user/model turns
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  // Add system prompt as first user message (workaround for strict alternation)
  // We embed the system instruction directly in the first message
  for (const msg of conversationHistory) {
    const geminiRole: "user" | "model" = msg.role === "outbound" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === geminiRole) {
      last.parts[0].text += "\n" + msg.content;
    } else {
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
  }

  // Ensure we have at least one user message
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    throw new Error("No user message to respond to");
  }

  // Use generateContent with systemInstruction as a separate parameter
  const result = await model.generateContent({
    systemInstruction: config.systemPrompt,
    contents,
  });

  const text = result.response.text();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}
