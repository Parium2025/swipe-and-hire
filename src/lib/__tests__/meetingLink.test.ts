import { describe, it, expect } from "vitest";
import { normalizeMeetingLink, isSupportedMeetingLink } from "@/lib/meetingLink";

describe("normalizeMeetingLink", () => {
  it("lämnar tomt värde som tomt", () => {
    expect(normalizeMeetingLink("   ")).toBe("");
  });

  it("lägger till https:// när protokoll saknas", () => {
    expect(normalizeMeetingLink("meet.google.com/abc-def")).toBe("https://meet.google.com/abc-def");
  });

  it("behåller befintligt protokoll", () => {
    expect(normalizeMeetingLink("https://zoom.us/j/123")).toBe("https://zoom.us/j/123");
  });

  it("tar bort omslutande vinkelparenteser", () => {
    expect(normalizeMeetingLink("<https://zoom.us/j/123>")).toBe("https://zoom.us/j/123");
  });

  it("tar bort avslutande skiljetecken från inklistrad text", () => {
    expect(normalizeMeetingLink("https://meet.google.com/abc).")).toBe("https://meet.google.com/abc");
  });

  it("returnerar råtexten när URL:en är ogiltig", () => {
    expect(normalizeMeetingLink("inte en url hör du")).toBe("inte en url hör du");
  });
});

describe("isSupportedMeetingLink", () => {
  it("godtar kända mötesplattformar", () => {
    expect(isSupportedMeetingLink("https://meet.google.com/abc-def-ghi")).toBe(true);
    expect(isSupportedMeetingLink("https://teams.microsoft.com/l/meetup-join/x")).toBe(true);
    expect(isSupportedMeetingLink("https://us05web.zoom.us/j/123")).toBe(true);
    expect(isSupportedMeetingLink("https://whereby.com/parium")).toBe(true);
  });

  it("avvisar okända domäner", () => {
    expect(isSupportedMeetingLink("https://evil-zoom.us.evil.com/x")).toBe(false);
    expect(isSupportedMeetingLink("https://example.com/meet")).toBe(false);
  });

  it("avvisar skräp och tomma strängar", () => {
    expect(isSupportedMeetingLink("")).toBe(false);
    expect(isSupportedMeetingLink("not a url")).toBe(false);
  });

  it("avvisar javascript-URL även om värdden ser snäll ut", () => {
    expect(isSupportedMeetingLink("javascript:alert(1)")).toBe(false);
  });
});
