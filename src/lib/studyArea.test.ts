import { describe, expect, it } from "vitest";
import {
  formatStudyVideoTime,
  isFolderDescendant,
  matchSlashTrade,
  nearestCorner,
  parseYouTubeId,
  pipMaxWidthFromBounds,
  splitStudyVideo,
  splitStudyVideos,
  STUDY_VIDEO_MIN_WIDTH,
  tradeIdsInDoc,
  videoBlockFromLink,
} from "@/lib/studyArea";

describe("study area helpers", () => {
  it("reads a YouTube id from common links", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9wgGcQ")).toBe("dQw4w9wgGcQ");
    expect(parseYouTubeId("not a link")).toBeNull();
    expect(videoBlockFromLink("https://youtu.be/dQw4w9wgGcQ")?.attrs).toMatchObject({
      videoId: "dQw4w9wgGcQ",
      width: 720,
      timestampsEnabled: true,
      startAt: 0,
      shown: true,
    });
    expect(videoBlockFromLink("https://cdn.example.com/clip.mp4")?.attrs).toMatchObject({ src: "https://cdn.example.com/clip.mp4" });
    expect(videoBlockFromLink("not a link")).toBeNull();
  });

  it("lifts all study videos out of the document", () => {
    const split = splitStudyVideos({
      type: "doc",
      content: [
        { type: "studyYoutube", attrs: { id: "a", videoId: "dQw4w9wgGcQ", width: 640, active: true, startAt: 95 } },
        { type: "paragraph", content: [{ type: "text", text: "notes" }] },
        { type: "studyYoutube", attrs: { id: "b", videoId: "aaaaaaaaaaa" } },
      ],
    });
    expect(split.videos).toHaveLength(2);
    expect(split.activeId).toBe("a");
    expect(split.videos[0]).toMatchObject({ videoId: "dQw4w9wgGcQ", width: 640, active: true, startAt: 95 });
    expect(split.videos[1]).toMatchObject({ startAt: 0 });
    expect(split.doc.content?.map((node) => node.type)).toEqual(["paragraph"]);
    expect(splitStudyVideo({
      type: "doc",
      content: [{ type: "studyYoutube", attrs: { videoId: "dQw4w9wgGcQ", width: 640 } }],
    }).video).toMatchObject({ videoId: "dQw4w9wgGcQ", width: 640 });
  });

  it("formats video timestamps", () => {
    expect(formatStudyVideoTime(65)).toBe("1:05");
    expect(formatStudyVideoTime(3661)).toBe("1:01:01");
  });

  it("picks the nearest picture-in-picture corner", () => {
    expect(nearestCorner(10, 10, 100, 80, 800, 600)).toBe("tl");
    expect(nearestCorner(700, 10, 100, 80, 800, 600)).toBe("tr");
    expect(nearestCorner(10, 500, 100, 80, 800, 600)).toBe("bl");
    expect(nearestCorner(700, 500, 100, 80, 800, 600)).toBe("br");
  });

  it("caps dual PiP width so the stack fits the notes area", () => {
    // Single: half notes width.
    expect(pipMaxWidthFromBounds(800, 600, 1)).toBe(400);
    // Dual: height of two 16:9 frames + gap + insets is the tighter bound.
    const dual = pipMaxWidthFromBounds(800, 600, 2);
    expect(dual).toBeLessThanOrEqual(400);
    expect(dual).toBeGreaterThanOrEqual(STUDY_VIDEO_MIN_WIDTH);
    // Short notes area forces a smaller max than width alone.
    expect(pipMaxWidthFromBounds(1200, 400, 2)).toBeLessThan(pipMaxWidthFromBounds(1200, 400, 1));
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
