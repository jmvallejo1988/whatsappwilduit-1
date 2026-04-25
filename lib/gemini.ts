import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface BotConfig {
  systemPrompt: string;
  maxMessages: number;
  handoffMessage: string;
  active: boolean;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  active: true,
  maxMessages: 5,
  handoffMessage: "Gracias por tu información. Un asesor especializado de Wilduit Marketing se pondrá en contacto contigo muy pronto. ¡Que tengas un excelente día!",
  systemPrompt: `Eres el asistente virtual de Wilduit Marketing, una agencia de marketing digital. Tu misión es calificar a clientes potenciales de manera cálida y profesional.

Flujo de conversación:
- Mensaje 1: Saluda cordialmente y preséntate como asistente de Wilduit Marketing
- Mensaje 2: Pregunta en qué servicio están interesados (redes sociales, ads pagados, branding, diseño web, etc.)
- Mensaje 3: Pregunta el presupuesto mensual aproximado disponible para marketing
- Mensaje 4: Pregunta si tienen algún lanzamiento próximo o urgencia particular
- Mensaje 5: Agradece la información y avisa que un asesor los contactará pronto

Reglas importantes:
- Respuestas MUY cortas (máximo 2-3 líneas)
- Una sola pregunta por mensaje
- Tono profesional pero cercano y cálido
- Si preguntan precios específicos, di que un asesor los orientará con detalle
- No inventes precios ni hagas compromisos específicos
- Responde siempre en español`
};

export async function generateBotResponse(
  conversationHistory: Array<{ role: string; content: string }>,
  config: BotConfig
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const chat = model.startChat({
    systemInstruction: config.systemPrompt,
    history: conversationHistory.slice(0, -1).map((m) => ({
      role: m.role === "outbound" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });

  const lastMessage = conversationHistory[conversationHistory.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}
