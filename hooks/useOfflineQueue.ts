"use client";

const QUEUE_KEY = "sightline_offline_queue";

export type OfflineAction =
  | { type: "add_material"; payload: { jobId: string; name: string; quantity_ordered: string; unit: string; unit_cost: string } }
  | { type: "add_labor";    payload: { jobId: string; crew_name: string; hours: string; rate: string } }
  | { type: "toggle_punch"; payload: { itemId: string; completed: boolean } }
  | { type: "add_daily_log"; payload: { jobId: string; date: string; notes: string; crew: string } };

export interface QueuedAction {
  id: string;
  createdAt: string;
  action: OfflineAction;
}

export function getQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function enqueue(action: OfflineAction): void {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    action,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
