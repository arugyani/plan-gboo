import type {
  Card,
  CardPatch,
  ChecklistItem,
  Comment,
  CreateBoardInput,
  CreateCardInput,
  CreateGroupInput,
  DashboardData,
  GitHubIssueLink,
  Group,
  GroupRole,
  UpdateBoardInput,
  UpdateGroupInput,
  Board,
} from "@/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "request_failed",
    readonly correlationId?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      correlationId?: string;
    } | null;
    throw new ApiError(
      body?.message ?? "The Board could not save that change.",
      response.status,
      body?.code,
      body?.correlationId,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const boardApi = {
  async dashboard() {
    return request<DashboardData>("/api/dashboard");
  },

  async createCard(input: CreateCardInput) {
    return (
      await request<{ card: Card }>("/api/cards", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).card;
  },

  async updateCard(cardId: string, patch: CardPatch) {
    return (
      await request<{ card: Card }>(`/api/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      })
    ).card;
  },

  async moveCard(
    cardId: string,
    columnId: string,
    expectedVersion: number,
    placement?: { targetCardId: string; edge: "before" | "after" },
  ) {
    return (
      await request<{ card: Card }>(`/api/cards/${cardId}/move`, {
        method: "POST",
        body: JSON.stringify({ columnId, expectedVersion, ...placement }),
      })
    ).card;
  },

  async addComment(cardId: string, body: string) {
    return (
      await request<{ comment: Comment }>(`/api/cards/${cardId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      })
    ).comment;
  },

  async addChecklistItem(cardId: string, text: string) {
    return (
      await request<{ item: ChecklistItem }>(`/api/cards/${cardId}/checklist`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
    ).item;
  },

  async setChecklistItem(cardId: string, itemId: string, complete: boolean) {
    return (
      await request<{ item: ChecklistItem }>(
        `/api/cards/${cardId}/checklist/${itemId}`,
        { method: "PATCH", body: JSON.stringify({ complete }) },
      )
    ).item;
  },

  async addGitHubLink(cardId: string, url: string) {
    return (
      await request<{ link: GitHubIssueLink }>(`/api/cards/${cardId}/links`, {
        method: "POST",
        body: JSON.stringify({ url }),
      })
    ).link;
  },

  async removeGitHubLink(cardId: string, linkId: string) {
    await request<void>(`/api/cards/${cardId}/links/${linkId}`, {
      method: "DELETE",
    });
  },

  async createGroup(input: CreateGroupInput) {
    return (
      await request<{ group: Group }>("/api/groups", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).group;
  },

  async updateGroup(groupId: string, input: UpdateGroupInput) {
    return (
      await request<{ group: Group }>(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).group;
  },

  async setGroupMember(groupId: string, personId: string, role: GroupRole) {
    return (
      await request<{ group: Group }>(
        `/api/groups/${groupId}/members/${personId}`,
        {
          method: "PUT",
          body: JSON.stringify({ personId, role }),
        },
      )
    ).group;
  },

  async removeGroupMember(groupId: string, personId: string) {
    await request<void>(`/api/groups/${groupId}/members/${personId}`, {
      method: "DELETE",
    });
  },

  async deleteGroup(groupId: string) {
    await request<void>(`/api/groups/${groupId}`, { method: "DELETE" });
  },

  async createBoard(input: CreateBoardInput) {
    return (
      await request<{ board: Board }>("/api/boards", {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).board;
  },

  async updateBoard(boardId: string, input: UpdateBoardInput) {
    return (
      await request<{ board: Board }>(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).board;
  },

  async deleteBoard(boardId: string) {
    await request<void>(`/api/boards/${boardId}`, { method: "DELETE" });
  },

  async signOut() {
    await request<void>("/api/auth/sign-out", { method: "POST" });
  },
};

export async function beginDiscordSignIn() {
  const result = await request<{ url?: string }>("/api/auth/sign-in", {
    method: "POST",
    body: JSON.stringify({ callbackURL: window.location.origin }),
  });
  if (!result.url)
    throw new ApiError("Discord sign-in did not return a redirect.", 500);
  window.location.assign(result.url);
}
