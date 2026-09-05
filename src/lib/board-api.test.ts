import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, boardApi } from "@/lib/board-api";
import type { Card } from "@/types";

const card: Card = {
  id: "507f1f77bcf86cd799439011",
  key: "SHOW-439011",
  boardId: "507f1f77bcf86cd799439012",
  columnId: "507f1f77bcf86cd799439012:backlog",
  title: "Test the fog cue",
  notes: "",
  importance: "medium",
  when: null,
  blocked: false,
  blockedReason: null,
  rank: 1024,
  version: 3,
  personIds: [],
  tagIds: [],
  checklist: [],
  comments: [],
  links: [],
  changes: [],
  createdAt: "2026-09-02T12:00:00Z",
  updatedAt: "2026-09-02T12:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("bot board API client", () => {
  it("creates cards through the shared bot endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ card }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      boardApi.createCard({
        boardId: card.boardId,
        columnId: card.columnId,
        title: card.title,
      }),
    ).resolves.toEqual(card);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cards",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("keeps the backend error code and correlation ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "version_conflict",
            message: "This card changed while you were looking at it.",
            correlationId: "request-123",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = await boardApi
      .moveCard(card.id, `${card.boardId}:done`, card.version)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "version_conflict",
      correlationId: "request-123",
    });
  });

  it("sends an exact card placement when reordering", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ card }));
    vi.stubGlobal("fetch", fetchMock);

    await boardApi.moveCard(card.id, card.columnId, card.version, {
      targetCardId: "507f1f77bcf86cd799439099",
      edge: "before",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/cards/${card.id}/move`,
      expect.objectContaining({
        body: JSON.stringify({
          columnId: card.columnId,
          expectedVersion: card.version,
          targetCardId: "507f1f77bcf86cd799439099",
          edge: "before",
        }),
      }),
    );
  });

  it("sends group roles to the protected organizer endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        group: {
          id: "507f1f77bcf86cd799439099",
          name: "Show Crew",
          slug: "show-crew",
          icon: "ghost",
          accent: "purple",
          isPrivate: true,
          discordChannelId: null,
          recapEnabled: false,
          recapHourUtc: 16,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await boardApi.setGroupMember(
      "507f1f77bcf86cd799439099",
      "123456789012345678",
      "view_only",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/groups/507f1f77bcf86cd799439099/members/123456789012345678",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          personId: "123456789012345678",
          role: "view_only",
        }),
      }),
    );
  });
});
