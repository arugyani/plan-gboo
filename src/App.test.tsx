import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { demoDashboard } from "@/test/dashboard-fixture";
import type { Card, CreateCardInput, DashboardData } from "@/types";

let dashboard: DashboardData;

beforeEach(() => {
  dashboard = structuredClone(demoDashboard);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (path === "/api/dashboard")
        return Response.json(structuredClone(dashboard));
      if (path === "/api/cards" && init?.method === "POST") {
        if (typeof init.body !== "string")
          throw new Error("Expected a JSON request body");
        const body = JSON.parse(init.body) as CreateCardInput;
        const now = new Date().toISOString();
        const card: Card = {
          id: "507f1f77bcf86cd799439099",
          key: "SHOW-439099",
          boardId: body.boardId,
          columnId: body.columnId,
          title: body.title,
          notes: body.notes ?? "",
          importance: body.importance ?? "none",
          when: body.when ?? null,
          blocked: false,
          blockedReason: null,
          rank: 9999,
          version: 1,
          personIds: body.personIds ?? [],
          tagIds: [],
          checklist: [],
          comments: [],
          links: [],
          changes: [],
          createdAt: now,
          updatedAt: now,
        };
        dashboard.cards.push(card);
        return Response.json({ card }, { status: 201 });
      }
      return Response.json(
        { message: "Unexpected test request" },
        { status: 500 },
      );
    }),
  );
});

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe("The Board", () => {
  it("opens a card and exposes the Discord-equivalent actions", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Opening Night" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open show-12/i }));

    expect(await screen.findByLabelText("Card title")).toHaveValue(
      "Map the full run-through",
    );
    expect(
      screen.getByRole("button", { name: /leave this/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^waiting$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /mark done/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("GitHub issue URL")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Add a note for everyone…"),
    ).toBeInTheDocument();
  });

  it("creates a card from the board", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Opening Night" });
    fireEvent.click(screen.getAllByRole("button", { name: "Boards" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /add a card/i }));
    fireEvent.change(screen.getByPlaceholderText("A clear, short title"), {
      target: { value: "Check the lantern batteries" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add card$/i }));

    await waitFor(() =>
      expect(screen.getByLabelText("Card title")).toHaveValue(
        "Check the lantern batteries",
      ),
    );
  });
});
