"use client";

import { get, set } from "idb-keyval";

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

// IndexedDB-backed (via idb-keyval) — more reliable than localStorage, survives
// larger payloads, and isn't cleared by Safari's 7-day localStorage eviction.
// One-time migration pulls any items left in the old localStorage queue.
async function readAll(): Promise<QueuedAction[]> {
  const existing = await get<QueuedAction[]>(QUEUE_KEY);
  if (existing !== undefined) return existing;

  let migrated: QueuedAction[] = [];
  try {
    if (typeof localStorage !== "undefined") {
      const legacy = localStorage.getItem(QUEUE_KEY);
      if (legacy) {
        migrated = (JSON.parse(legacy) as QueuedAction[]) ?? [];
        localStorage.removeItem(QUEUE_KEY);
      }
    }
  } catch {
    migrated = [];
  }
  await set(QUEUE_KEY, migrated);
  return migrated;
}

export async function getQueue(): Promise<QueuedAction[]> {
  try {
    return await readAll();
  } catch {
    return [];
  }
}

export async function setQueue(items: QueuedAction[]): Promise<void> {
  try {
    await set(QUEUE_KEY, items);
  } catch {
    // IndexedDB unavailable (private mode / disabled) — nothing more we can do.
  }
}

export async function enqueue(action: OfflineAction): Promise<void> {
  const queue = await getQueue();
  queue.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    action,
  });
  await setQueue(queue);
}

export async function clearQueue(): Promise<void> {
  await setQueue([]);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await setQueue(queue.filter((item) => item.id !== id));
}
