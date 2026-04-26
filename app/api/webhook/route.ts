import { NextRequest, NextResponse } from "next/server";
import { saveInboundMessage, getMessages } from "@/lib/redis";
import { sendTextMessage } from "@/lib/whatsapp";
import { saveOutboundMessage } from "@/lib/redis";
import { isBotActive, getBotCount, incrementBotCount, activateHumanMode, getBotConfig } from "@/lib/bot";
import { generateBotResponse } from "@/lib/openrouter";
import { sendPushToAll } from "@/lib/push";
import { kv } from "@vercel/kv";

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

        for (const waMsg of value.messages) {
          let text = "";
          if (waMsg.type === "text") text = waMsg.text?.body ?? "";
          else if (waMsg.type === "image") text = "Imagen";
          else if (waMsg.type === "audio") text = "Audio";
          else if (waMsg.type === "video") text = "Video";
          else if (waMsg.type === "document") text = waMsg.document?.filename ?? "Documento";
          else if (waMsg.type === "location") text = "Ubicacion";
          else if (waMsg.type === "sticker") text = "Sticker";
          else text = waMsg.type;

          await saveInboundMessage(
            waMsg.from,
            text,
            waMsg.id,
            contactMap[waMsg.from],
            parseInt(waMsg.timestamp) * 1000
          );

          const senderName = contactMap[waMsg.from] || `+${waMsg.from}`;
          const preview = text.length > 60 ? text.slice(0, 60) + "..." : text;
          sendPushToAll(senderName, preview, { phone: waMsg.from, url: `/chat/${waMsg.from}` }).catch(() => {});

          // Bot auto-response — only for text messages
          if (waMsg.type === "text") {
            try {
              const config = await getBotConfig();
              const humanMode = await kv.get(`bot:human:${waMsg.from}`);
              const count = await getBotCount(waMsg.from);

              // Detailed diagnostic log for every text message received
              console.log(`BOT_CHECK phone=${waMsg.from} config.active=${config.active} humanMode=${humanMode} count=${count} maxMessages=${config.maxMessages} OPENROUTER_KEY=${!!process.env.OPENROUTER_API_KEY}`);

              const botActive = config.active && !humanMode && Number(count) < config.maxMessages;

              if (!botActive) {
                console.log(`BOT_SKIP phone=${waMsg.from} reason=${!config.active ? "config_inactive" : humanMode ? "human_mode" : "count_exceeded"}`);
              } else {
                const messages = await getMessages(waMsg.from);
                const history = messages.map((m: { direction: string; text: string }) => ({
                  role: m.direction,
                  content: m.text,
                }));

                console.log(`BOT_GENERATING phone=${waMsg.from} historyLen=${history.length}`);
                const botReply = await generateBotResponse(history, config);
                const newCount = await incrementBotCount(waMsg.from);

                await sendTextMessage(waMsg.from, botReply);
                await saveOutboundMessage(waMsg.from, botReply, `bot_${Date.now()}`);
                console.log(`BOT_SENT phone=${waMsg.from} newCount=${newCount}`);

                if (newCount >= config.maxMessages) {
                  await activateHumanMode(waMsg.from);
                  await sendTextMessage(waMsg.from, config.handoffMessage);
                  await saveOutboundMessage(waMsg.from, config.handoffMessage, `bot_handoff_${Date.now()}`);
                  console.log(`BOT_HANDOFF phone=${waMsg.from}`);
                }
              }
            } catch (botError) {
              const errMsg = botError instanceof Error ? botError.message : String(botError);
              console.error(`BOT_ERROR phone=${waMsg.from} error=${errMsg}`);
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
