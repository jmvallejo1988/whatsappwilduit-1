import webpush from "web-push";
import { kv } from "@vercel/kv";

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function setupVapid() {
  webpush.setVapidDetails(
    "mailto:jonathan.vallejo.german@gmail.com",
    process.env.VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
}

export async function saveSubscription(sub: PushSubscription): Promise<void> {
  const subs = await getSubscriptions();
  const exists = subs.find((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    await kv.set("push:subscriptions", [...subs, sub]);
  }
}

export async function getSubscriptions(): Promise<PushSubscription[]> {
  try {
    return (await kv.get<PushSubscription[]>("push:subscriptions")) || [];
  } catch { return []; }
}

export async function sendPushToAll(title: string, body: string, data?: Record<string, string>): Promise<void> {
  setupVapid();
  const subs = await getSubscriptions();
  const valid: PushSubscription[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as webpush.PushSubscription, JSON.stringify({ title, body, data }));
        valid.push(sub);
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status !== 410 && status !== 404) valid.push(sub); // keep if not expired
      }
    })
  );
  if (valid.length !== subs.length) {
    await kv.set("push:subscriptions", valid);
  }
}
