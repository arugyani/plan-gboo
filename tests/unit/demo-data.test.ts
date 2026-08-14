import { describe, expect, it } from "vitest";
import { demoDashboard } from "@/lib/demo-data";

describe("demo dashboard invariants", () => {
  it("uses stable unique card keys and valid board columns", () => {
    const keys = demoDashboard.cards.map((card) => card.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const card of demoDashboard.cards) {
      expect(
        demoDashboard.boards.some((board) => board.id === card.boardId),
      ).toBe(true);
      expect(
        demoDashboard.columns.some(
          (column) =>
            column.id === card.columnId && column.boardId === card.boardId,
        ),
      ).toBe(true);
    }
  });

  it("demonstrates one person belonging to multiple groups", () => {
    expect(Object.keys(demoDashboard.viewer.groupRoles).length).toBeGreaterThan(
      1,
    );
  });
});
