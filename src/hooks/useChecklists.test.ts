import { describe, expect, it } from "vitest";
import { mapDbToChecklist } from "@/lib/playbookChecklist";

describe("mapDbToChecklist", () => {
  it("maps a newly created playbook with typed empty items", () => {
    const checklist = mapDbToChecklist({
      id: "pb-1",
      name: "Breakout",
      notes: null,
      created_at: "2026-10-26T00:00:00Z",
      items: { type: "fixed", items: [] },
    });

    expect(checklist).toMatchObject({
      id: "pb-1",
      name: "Breakout",
      type: "fixed",
      items: [],
      notes: "",
    });
  });

  it("maps a conditional playbook and ignores malformed items", () => {
    const checklist = mapDbToChecklist({
      id: "pb-2",
      name: "Trend",
      notes: "notes",
      created_at: "2026-10-26T00:00:00Z",
      items: { type: "conditional", items: null },
    });

    expect(checklist.type).toBe("conditional");
    expect(checklist.items).toEqual([]);
  });
});
