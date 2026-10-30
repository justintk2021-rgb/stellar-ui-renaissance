import { describe, expect, it } from "vitest";
import { isFolderDescendant, matchSlashTrade, parseYouTubeId, tradeIdsInDoc } from "@/lib/studyArea";

describe("study area helpers", () => {
  it("reads a YouTube id from common links", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("not a link")).toBeNull();
  });

  it("collects trade ids stored in the note document", () => {
    expect(tradeIdsInDoc({
      type: "doc",
      content: [
        { type: "studyTrade", attrs: { tradeId: "a" } },
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
        { type: "studyTrade", attrs: { tradeId: "a" } },
        { type: "studyTrade", attrs: { tradeId: "b" } },
      ],
    })).toEqual(["a", "b"]);
  });

  it("matches the /trade command at a word boundary", () => {
    expect(matchSlashTrade("hello /trade eurusd")).toEqual({ start: 6, query: "eurusd" });
    expect(matchSlashTrade("hello/trade")).toBeNull();
  });

  it("blocks dropping a folder into its descendant", () => {
    const folders = [
      { id: "root", parent_id: null },
      { id: "child", parent_id: "root" },
    ];
    expect(isFolderDescendant(folders, "root", "child")).toBe(true);
    expect(isFolderDescendant(folders, "child", "root")).toBe(false);
  });
});
