import { kv } from "@vercel/kv";

export interface Label {
  id: string;
  name: string;
  color: string;
}

const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#8b5cf6","#ec4899","#6b7280"];

export async function getLabels(): Promise<Label[]> {
  try {
    return (await kv.get<Label[]>("labels:global")) || [];
  } catch { return []; }
}

export async function createLabel(name: string): Promise<Label> {
  const labels = await getLabels();
  const color = COLORS[labels.length % COLORS.length];
  const label: Label = { id: Date.now().toString(), name: name.trim(), color };
  await kv.set("labels:global", [...labels, label]);
  return label;
}

export async function deleteLabel(id: string): Promise<void> {
  const labels = await getLabels();
  await kv.set("labels:global", labels.filter((l) => l.id !== id));
}

export async function getConvLabels(phone: string): Promise<string[]> {
  try {
    return (await kv.get<string[]>(`conv:labels:${phone}`)) || [];
  } catch { return []; }
}

export async function toggleConvLabel(phone: string, labelId: string): Promise<string[]> {
  const current = await getConvLabels(phone);
  const updated = current.includes(labelId)
    ? current.filter((id) => id !== labelId)
    : [...current, labelId];
  await kv.set(`conv:labels:${phone}`, updated);
  return updated;
}
