// Notisarkiv: varje toast som visas loggas här så att den går att läsa
// i efterhand via klockan i headern — man ska aldrig kunna missa en notis.
// Arkivet synkas till kontot (tabellen notifications, type = "toast_<kind>")
// så att samma notiser syns på alla enheter. Lokala poster används bara som
// omedelbar optimistisk visning tills servern bekräftat, eller när man är utloggad.

import { supabase } from "@/integrations/supabase/client";

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
const SYNC_DEBOUNCE = 1400;

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

function notifyServerRefresh() {
  try {
    window.dispatchEvent(new CustomEvent("parium:notifications-refresh"));
  } catch {}
}

// --- Serversynk ---------------------------------------------------------

const pending = new Map<string, { timer: number; localId: string; kind: ToastKind; title: string; body?: string }>();

async function flushToServer(key: string) {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);

  const local = items.find((n) => n.id === entry.localId);
  const count = local?.count ?? 1;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return; // utloggad → behåll lokalt

    // Sista skyddet mot dubbletter: finns redan en identisk notis på kontot
    // (t.ex. skapad från en annan flik eller enhet) hoppar vi över inserten
    // och städar bara bort den lokala kopian.
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", `toast_${entry.kind}`)
      .eq("title", entry.title)
      .gte("created_at", since)
      .limit(1);

    if (!existing || existing.length === 0) {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: `toast_${entry.kind}`,
        title: entry.title,
        body: entry.body ?? null,
        metadata: { toast: true, count },
      });
      if (error) return; // behåll lokalt om synken misslyckas
    }

    // Servern äger posten nu → ta bort den lokala dubbletten. Vi matchar både
    // på id och på innehåll, så att inga lokala kopior blir kvar om samma notis
    // hann arkiveras i flera steg (t.ex. två flikar eller snabb upprepning).
    items = items.filter(
      (n) =>
        n.id !== entry.localId &&
        !(n.kind === entry.kind && n.title === entry.title && (n.body || "") === (entry.body || ""))
    );
    persist();
    notifyServerRefresh();
  } catch {
    /* behåll lokalt */
  }
}

function scheduleSync(localId: string, kind: ToastKind, title: string, body?: string) {
  if (typeof window === "undefined") return;
  const key = `${kind}|${title}|${body || ""}`;
  const existing = pending.get(key);
  if (existing) window.clearTimeout(existing.timer);
  const timer = window.setTimeout(() => flushToServer(key), SYNC_DEBOUNCE);
  pending.set(key, { timer, localId, kind, title, body });
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
    let localId: string;
    if (
      existing &&
      existing.kind === kind &&
      existing.title === clean &&
      (existing.body || "") === (body || "") &&
      now - existing.at < MERGE_WINDOW
    ) {
      localId = existing.id;
      items = [{ ...existing, count: existing.count + 1, at: now, is_read: false }, ...items.slice(1)];
    } else {
      localId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      items = [
        {
          id: localId,
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
    scheduleSync(localId, kind, clean, body?.trim() || undefined);
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
