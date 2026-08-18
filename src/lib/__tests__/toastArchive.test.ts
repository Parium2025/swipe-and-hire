import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  },
}));

describe("toastArchive", () => {
  let toastArchive: typeof import("@/lib/toastArchive").toastArchive;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    ({ toastArchive } = await import("@/lib/toastArchive"));
  });

  it("arkiverar en notis", () => {
    toastArchive.add("success", "Jobbannons skapad!", "Din annons är publicerad");
    const [item] = toastArchive.getSnapshot();
    expect(item.title).toBe("Jobbannons skapad!");
    expect(item.count).toBe(1);
    expect(item.is_read).toBe(false);
  });

  it("slår ihop identiska notiser inom sammanslagningsfönstret", () => {
    toastArchive.add("success", "Jobbannons skapad!");
    toastArchive.add("success", "Jobbannons skapad!");
    const snapshot = toastArchive.getSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].count).toBe(2);
  });

  it("slår inte ihop notiser med olika titel eller typ", () => {
    toastArchive.add("success", "Jobbannons skapad!");
    toastArchive.add("success", "Kandidat flyttad");
    toastArchive.add("error", "Kandidat flyttad");
    expect(toastArchive.getSnapshot()).toHaveLength(3);
  });

  it("ignorerar tomma titlar", () => {
    toastArchive.add("info", "   ");
    expect(toastArchive.getSnapshot()).toHaveLength(0);
  });

  it("markerar som läst och rensar", () => {
    toastArchive.add("info", "En notis");
    const id = toastArchive.getSnapshot()[0].id;
    toastArchive.markAsRead(id);
    expect(toastArchive.getSnapshot()[0].is_read).toBe(true);

    toastArchive.add("info", "En till");
    toastArchive.markAllAsRead();
    expect(toastArchive.getSnapshot().every((n) => n.is_read)).toBe(true);

    toastArchive.clear();
    expect(toastArchive.getSnapshot()).toHaveLength(0);
  });

  it("notifierar prenumeranter och överlever omladdning", async () => {
    const listener = vi.fn();
    const unsubscribe = toastArchive.subscribe(listener);
    toastArchive.add("success", "Sparad");
    expect(listener).toHaveBeenCalled();
    unsubscribe();

    vi.resetModules();
    const reloaded = await import("@/lib/toastArchive");
    expect(reloaded.toastArchive.getSnapshot()[0].title).toBe("Sparad");
  });

  it("håller arkivet begränsat till 50 poster", () => {
    for (let i = 0; i < 60; i++) toastArchive.add("info", `Notis ${i}`);
    expect(toastArchive.getSnapshot()).toHaveLength(50);
    expect(toastArchive.getSnapshot()[0].title).toBe("Notis 59");
  });
});
