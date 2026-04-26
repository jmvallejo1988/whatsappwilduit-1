import { NextRequest, NextResponse } from "next/server";
import { saveInboundMessage, getMessages } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";
import { saveOutboundMessage } from "@/lib/redis";
import { isBotActive, getBotCount, incrementBotCount, activateHumanMode, getBotConfig } from "@/lib/bot";
import { generateBotResponse } from "@/lib/openrouter";
import { sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || "wilduit-webhook-2024";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ok" });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;

        const contactMap: Record<string, string> = {};
        for (const c of value.contacts ?? []) {
          contactMap[c.wa_id] = c.profile?.name ?? c.wa_id;
        }

        for (const msg of value.messages) {
          let text = "";
          if (msg.type === "text") text = msg.text?.body ?? "";
          else if (msg.type === "image") text = "Imagen";
          else if (msg.type === "audio") text = "Audio";
          else if (msg.type === "video") text = "Video";
          else if (msg.type === "document") text = msg.document?.filename ?? "Documento";
          else if (msg.type === "location") text = "Ubicacion";
          else if (msg.type === "sticker") text = "Sticker";
          else text = msg.type;

          await saveInboundMessage(
            msg.from,
            text,
            msg.id,
            contactMap[msg.from],
            parseInt(msg.timestamp) * 1000
          );

          // Push notification for new message
          const senderName = contactMap[msg.from] || `+${msg.from}`;
          const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;
          sendPushToAll(senderName, preview, { phone: msg.from, url: `/chat/${msg.from}` }).catch(() => {});

          // Bot auto-response
          if (msg.type === "text") {
            try {
              const botActive = await isBotActive(msg.from);
              if (botActive) {
                const config = await getBotConfig();
                const count = await getBotCount(msg.from);

                if (count >= config.maxMessages) {
                  // Already at limit, switch to human
                  await activateHumanMode(msg.from);
                } else {
                  const messages = await getMessages(msg.from);
                  const history = messages.map((m: { direction: string; text: string }) => ({
                    role: m.direction,
                    content: m.text,
                  }));

                  const botReply = await generateBotResponse(history, config);
                  const newCount = await incrementBotCount(msg.from);

                  await sendTextMessage(msg.from, botReply);
                  await saveOutboundMessage(msg.from, botReply, `bot_${Date.now()}`);

                  // If reached limit, send handoff message
                  if (newCount >= config.maxMessages) {
                    await activateHumanMode(msg.from);
                    await sendTextMessage(msg.from, config.handoffMessage);
                    await saveOutboundMessage(msg.from, config.handoffMessage, `bot_handoff_${Date.now()}`);
                  }
                }
              }
            } catch (botError) {
              const msg = botError instanceof Error ? botError.message : String(botError);
              console.error("Bot error full:", msg);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
