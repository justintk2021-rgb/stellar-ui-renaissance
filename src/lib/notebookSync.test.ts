import { describe, expect, it } from "vitest";
import {
  notebookPlainText,
  plainTextToNotebookHtml,
  shouldWriteQuickNotesToNotebook,
} from "@/lib/notebookSync";

describe("notebookSync", () => {
  it("round-trips plain quick notes into notebook HTML", () => {
    const html = plainTextToNotebookHtml("First line\nSecond line\n\nNew paragraph");
    expect(html).toContain("First line");
    expect(notebookPlainText(html)).toContain("First line");
    expect(notebookPlainText(html)).toContain("Second line");
    expect(notebookPlainText(html)).toContain("New paragraph");
  });

  it("writes quick notes into an empty or missing notebook page", () => {
    expect(shouldWriteQuickNotesToNotebook("Setup was clean", "")).toBe(true);
    expect(shouldWriteQuickNotesToNotebook("Setup was clean", "<p><br></p>")).toBe(true);
    expect(shouldWriteQuickNotesToNotebook("Setup was clean", null)).toBe(true);
  });

  it("does not overwrite a notebook page that already has the same text", () => {
    const html = plainTextToNotebookHtml("Setup was clean");
    expect(shouldWriteQuickNotesToNotebook("Setup was clean", html)).toBe(false);
  });

  it("updates the notebook when quick notes change", () => {
    expect(shouldWriteQuickNotesToNotebook("New take", "<p>Old take</p>")).toBe(true);
  });

  it("does not wipe notebook content when quick notes are empty", () => {
    expect(shouldWriteQuickNotesToNotebook("  ", "<p>Keep this</p>")).toBe(false);
  });
});
