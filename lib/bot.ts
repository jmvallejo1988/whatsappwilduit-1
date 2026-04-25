import { getKv } from "@/lib/redis";
import { BotConfig, DEFAULT_BOT_CONFIG } from "@/lib/gemini";

export async function getBotConfig(): Promise<BotConfig> {
  try {
    const kv = getKv();
    const config = await kv.get<BotConfig>("bot:config");
    return config || DEFAULT_BOT_CONFIG;
  } catch {
    return DEFAULT_BOT_CONFIG;
  }
}

export async function saveBotConfig(config: BotConfig): Promise<void> {
  const kv = getKv();
  await kv.set("bot:config", config);
}

export async function isBotActive(phone: string): Promise<boolean> {
  try {
    const kv = getKv();
    const config = await getBotConfig();
    if (!config.active) return false;
    const humanMode = await kv.get<boolean>(`bot:human:${phone}`);
    if (humanMode) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getBotCount(phone: string): Promise<number> {
  try {
    const kv = getKv();
    return (await kv.get<number>(`bot:count:${phone}`)) || 0;
  } catch {
    return 0;
  }
}

export async function incrementBotCount(phone: string): Promise<number> {
  const kv = getKv();
  const count = (await kv.get<number>(`bot:count:${phone}`)) || 0;
  const newCount = count + 1;
  await kv.set(`bot:count:${phone}`, newCount);
  return newCount;
}

export async function activateHumanMode(phone: string): Promise<void> {
  const kv = getKv();
  await kv.set(`bot:human:${phone}`, true);
}

export async function deactivateHumanMode(phone: string): Promise<void> {
  const kv = getKv();
  await kv.del(`bot:human:${phone}`);
  await kv.set(`bot:count:${phone}`, 0);
}

export async function getConversationMode(phone: string): Promise<"bot" | "human"> {
  const botActive = await isBotActive(phone);
  return botActive ? "bot" : "human";
}
