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
  /** Valfri destination – gör notisen klickbar i notiscentret. */
  route?: string;
  /**
   * Id för kontots kopia när posten har synkats. Den lokala posten ligger kvar
   * tills klockan faktiskt har laddat serverkopian — annars försvann siffran på
   * klockan en kort stund och studsade sedan in igen.
   */
  syncedId?: string;
}

const BASE_KEY = "parium_toast_archive_v1";
const MAX = 50;
const MERGE_WINDOW = 60_000;
const SYNC_DEBOUNCE = 1400;
const SYNCED_FALLBACK_MS = 15_000;

/**
 * Arkivet är kontospecifikt. Två flikar på samma enhet kan vara inloggade med
 * olika konton (t.ex. arbetsgivare + jobbsökare) — utan denna nyckelseparation
 * skulle de dela samma lokala notislista.
 */
let currentUserId: string | null = null;
const storageKey = () => (currentUserId ? `${BASE_KEY}:${currentUserId}` : BASE_KEY);

let items: ArchivedToast[] = load();
const listeners = new Set<() => void>();

/** Byt aktivt konto för arkivet (anropas när auth-användaren ändras). */
export function setToastArchiveUser(userId: string | null): void {
  if (currentUserId === userId) return;
  currentUserId = userId;
  items = load();
  // Notifiera asynkront — funktionen kan anropas under render.
  queueMicrotask(() => listeners.forEach((l) => l()));
}

function load(): ArchivedToast[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
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
    localStorage.setItem(storageKey(), JSON.stringify(items.slice(0, MAX)));
  } catch {}
  listeners.forEach((l) => l());
}

function notifyServerRefresh() {
  try {
    window.dispatchEvent(new CustomEvent("parium:notifications-refresh"));
  } catch {}
}

// --- Serversynk ---------------------------------------------------------

const pending = new Map<string, { timer: number; localId: string; kind: ToastKind; title: string; body?: string; route?: string }>();

async function flushToServer(key: string) {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);

  const local = items.find((n) => n.id === entry.localId);
  const count = local?.count ?? 1;
  // Hann användaren trycka på notisen innan den synkades ska serverkopian
  // också vara läst — annars dök den upp som oläst igen efter en sekund.
  const alreadyRead = local?.is_read === true;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return; // utloggad → behåll lokalt

    // Sista skyddet mot dubbletter: finns redan en identisk *oläst* notis på
    // kontot (t.ex. skapad från en annan flik eller enhet) hoppar vi över
    // inserten. Är den redan läst/borttagen är detta en helt ny händelse och
    // ska ge en ny notis — annars skulle badgen tyst försvinna.
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", `toast_${entry.kind}`)
      .eq("title", entry.title)
      .eq("is_read", false)
      .gte("created_at", since)
      .limit(1);


    let serverId: string | null = existing && existing.length > 0 ? existing[0].id : null;
    if (existing && existing.length > 0 && alreadyRead) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", existing.map((row) => row.id))
        .eq("user_id", userId);
    } else if (!existing || existing.length === 0) {
      const { data: inserted, error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: `toast_${entry.kind}`,
          title: entry.title,
          body: entry.body ?? null,
          is_read: alreadyRead,
          metadata: { toast: true, count, ...(entry.route ? { route: entry.route } : {}) },
        })
        .select("id")
        .single();
      if (error || !inserted) return; // behåll lokalt om synken misslyckas
      serverId = inserted.id;
    }

    // Servern äger posten nu. Den lokala kopian märks som synkad och tas bort
    // först när klockan har laddat serverkopian (pruneSynced). Tas den bort
    // direkt blir klockan tom under omhämtningen och siffran "1" försvinner
    // och kommer tillbaka. Vi matchar både på id och innehåll, så att inga
    // lokala kopior blir kvar om samma notis arkiverats i flera steg.
    const isSame = (n: ArchivedToast) =>
      n.id === entry.localId ||
      (n.kind === entry.kind && n.title === entry.title && (n.body || "") === (entry.body || ""));
    if (serverId) {
      const syncedId = serverId;
      items = items.map((n) => (isSame(n) ? { ...n, syncedId } : n));
      // Reserv: laddas klockan aldrig om (t.ex. fliken stängs av) städas den
      // lokala kopian ändå bort efter en stund.
      window.setTimeout(() => {
        const before = items.length;
        items = items.filter((n) => n.syncedId !== syncedId);
        if (items.length !== before) persist();
      }, SYNCED_FALLBACK_MS);
    } else {
      items = items.filter((n) => !isSame(n));
    }
    persist();
    notifyServerRefresh();
  } catch {
    /* behåll lokalt */
  }
}

function scheduleSync(localId: string, kind: ToastKind, title: string, body?: string, route?: string) {
  if (typeof window === "undefined") return;
  const key = `${kind}|${title}|${body || ""}`;
  const existing = pending.get(key);
  if (existing) window.clearTimeout(existing.timer);
  const timer = window.setTimeout(() => flushToServer(key), SYNC_DEBOUNCE);
  pending.set(key, { timer, localId, kind, title, body, route });
}

export const toastArchive = {
  getSnapshot: () => items,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  add(kind: ToastKind, title: string, body?: string, route?: string) {
    const clean = (title || "").trim();
    if (!clean) return;
    const now = Date.now();
    const existing = items[0];
    let localId: string;
    if (
      existing &&
      !existing.is_read &&
      existing.kind === kind &&
      existing.title === clean &&
      (existing.body || "") === (body || "") &&
      now - existing.at < MERGE_WINDOW
    ) {
      localId = existing.id;

      items = [{ ...existing, count: existing.count + 1, at: now, is_read: false, route: route ?? existing.route }, ...items.slice(1)];
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
          route,
        },
        ...items,
      ].slice(0, MAX);
    }
    persist();
    scheduleSync(localId, kind, clean, body?.trim() || undefined, route);
  },
  markAsRead(id: string) {
    const target = items.find((n) => n.id === id);
    items = items.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    persist();
    // Redan synkad: kontots kopia måste också bli läst, annars kommer pricken
    // tillbaka när klockan laddar serverkopian.
    if (target?.syncedId) {
      const syncedId = target.syncedId;
      void (async () => {
        try {
          await supabase.from("notifications").update({ is_read: true }).eq("id", syncedId);
        } finally {
          notifyServerRefresh();
        }
      })();
    }
  },
  /** Tar bort lokala kopior vars serverkopia nu finns i klockans lista. */
  pruneSynced(serverIds: Set<string>) {
    const next = items.filter((n) => !n.syncedId || !serverIds.has(n.syncedId));
    if (next.length === items.length) return;
    items = next;
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
