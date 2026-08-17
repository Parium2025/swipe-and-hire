// Lokalt notisarkiv: varje toast som visas loggas här så att den går att läsa
// i efterhand via klockan i headern — man ska aldrig kunna missa en notis.

export type ToastKind = "success" | "info" | "warning" | "error";

export interface ArchivedToast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  at: number;
  count: number;
  is_read: boolean;
}

const KEY = "parium_toast_archive_v1";
const MAX = 50;
const MERGE_WINDOW = 60_000;

let items: ArchivedToast[] = load();
const listeners = new Set<() => void>();

function load(): ArchivedToast[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is ArchivedToast => !!n && typeof n.id === "string" && typeof n.at === "number"
    );
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {}
  listeners.forEach((l) => l());
}

export const toastArchive = {
  getSnapshot: () => items,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  add(kind: ToastKind, title: string, body?: string) {
    const clean = (title || "").trim();
    if (!clean) return;
    const now = Date.now();
    const existing = items[0];
    if (
      existing &&
      existing.kind === kind &&
      existing.title === clean &&
      (existing.body || "") === (body || "") &&
      now - existing.at < MERGE_WINDOW
    ) {
      items = [{ ...existing, count: existing.count + 1, at: now, is_read: false }, ...items.slice(1)];
    } else {
      items = [
        {
          id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          title: clean,
          body: body?.trim() || undefined,
          at: now,
          count: 1,
          is_read: false,
        },
        ...items,
      ].slice(0, MAX);
    }
    persist();
  },
  markAsRead(id: string) {
    items = items.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    persist();
  },
  markAllAsRead() {
    items = items.map((n) => ({ ...n, is_read: true }));
    persist();
  },
  clear() {
    items = [];
    persist();
  },
};
