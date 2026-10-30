import { describe, expect, it } from "vitest";
import type { NotebookEntry, Trade } from "@/types/trade";
import {
  canMoveFolder,
  extractTradeIdsFromHtml,
  filterTradesForSlash,
  matchSlashTrade,
  mentionedTradeIds,
  notesMentioningTrade,
  parseYouTubeId,
  replaceYouTubeUrlsWithEmbeds,
  resolveNoteFolderId,
  seedStudyNoteHtml,
  tradeEmbedHtml,
  youtubeEmbedHtml,
  type StudyFolder,
} from "@/lib/studyNotes";

const folders: StudyFolder[] = [
  { id: "root", name: "Setups", parentId: null, sort: 0 },
  { id: "child", name: "London", parentId: "root", sort: 0 },
  { id: "leaf", name: "Reversals", parentId: "child", sort: 0 },
];

function entry(partial: Partial<NotebookEntry> & { id: string }): NotebookEntry {
  return {
    title: "Note",
    content: "",
    category: "general",
    date: "2026-10-30",
    createdAt: "2026-10-30T12:00:00.000Z",
    updatedAt: "2026-10-30T12:00:00.000Z",
    ...partial,
  };
}

describe("studyNotes YouTube", () => {
  it("parses watch, short, and youtu.be links", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://example.com")).toBeNull();
  });

  it("replaces a pasted YouTube URL with a nocookie embed", () => {
    const { html, replaced } = replaceYouTubeUrlsWithEmbeds(
      "Watch https://www.youtube.com/watch?v=dQw4w9wgGcQ later",
    );
    expect(replaced).toBe(true);
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9wgGcQ");
    expect(html).toContain('data-youtube-id="dQw4w9wgGcQ"');
    expect(youtubeEmbedHtml("dQw4w9wgGcQ")).toContain("youtube-nocookie.com/embed/dQw4w9wgGcQ");
  });
});

describe("studyNotes trade embeds", () => {
  it("stores only the trade id on inserted cards", () => {
    const html = tradeEmbedHtml("trade-123");
    expect(html).toContain('data-trade-id="trade-123"');
    expect(html).not.toContain("EURUSD");
    expect(html).not.toContain("+12");
  });

  it("extracts unique trade ids from note HTML", () => {
    const html = `${tradeEmbedHtml("a")}<p>text</p>${tradeEmbedHtml("b")}${tradeEmbedHtml("a")}`;
    expect(extractTradeIdsFromHtml(html)).toEqual(["a", "b"]);
  });

  it("treats the legacy tradeId as a mention even without a card", () => {
    const note = entry({
      id: "n1",
      tradeId: "legacy",
      content: "<p>no card</p>",
    });
    expect(mentionedTradeIds(note)).toEqual(["legacy"]);
  });

  it("finds every note that mentions a trade", () => {
    const notes = [
      entry({ id: "n1", content: tradeEmbedHtml("t1"), updatedAt: "2026-10-30T13:00:00.000Z" }),
      entry({ id: "n2", tradeId: "t1", content: "<p>legacy</p>", updatedAt: "2026-10-30T12:00:00.000Z" }),
      entry({ id: "n3", content: tradeEmbedHtml("t2") }),
      entry({ id: "n4", content: tradeEmbedHtml("t1"), isDeleted: true }),
    ];
    expect(notesMentioningTrade(notes, "t1").map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  it("seeds a new study note with a live trade card", () => {
    const html = seedStudyNoteHtml("t1", "<p>Quick take</p>");
    expect(html.startsWith(tradeEmbedHtml("t1"))).toBe(true);
    expect(html).toContain("Quick take");
  });
});

describe("studyNotes slash command", () => {
  it("matches /trade at a word boundary and captures the query", () => {
    expect(matchSlashTrade("hello /trade")).toEqual({ start: 6, query: "" });
    expect(matchSlashTrade("/trade eurusd")).toEqual({ start: 0, query: "eurusd" });
    expect(matchSlashTrade("hello/trade")).toBeNull();
    expect(matchSlashTrade("slash trade")).toBeNull();
  });

  it("filters journal trades by pair text", () => {
    const trades = [
      { id: "1", pair: "EURUSD", direction: "Long", result: 10, date: "2026-10-30" },
      { id: "2", pair: "XAUUSD", direction: "Short", result: -4, date: "2026-10-29" },
    ] as Trade[];
    expect(filterTradesForSlash(trades, "xau").map((t) => t.id)).toEqual(["2"]);
  });
});

describe("studyNotes folders", () => {
  it("blocks dropping a folder into its own descendant", () => {
    expect(canMoveFolder(folders, "root", "leaf")).toBe(false);
    expect(canMoveFolder(folders, "leaf", "root")).toBe(true);
    expect(canMoveFolder(folders, "root", "root")).toBe(false);
    expect(canMoveFolder(folders, "leaf", null)).toBe(true);
  });

  it("uses the stored folderId, then a matching category", () => {
    expect(resolveNoteFolderId(entry({ id: "n", folderId: "child", category: "root" }), folders)).toBe("child");
    expect(resolveNoteFolderId(entry({ id: "n", category: "root" }), folders)).toBe("root");
    expect(resolveNoteFolderId(entry({ id: "n", category: "general" }), folders)).toBeNull();
  });
});
