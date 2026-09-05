import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorScreen } from "@/components/state-screens";
import { ApiError } from "@/lib/board-api";

describe("ErrorScreen", () => {
  it("explains missing local configuration without offering a dead sign-in flow", () => {
    const retry = vi.fn();
    render(
      <ErrorScreen
        error={
          new ApiError(
            "Local setup needs BOT_API_TOKEN in .env.local.",
            503,
            "local_config_missing",
          )
        }
        onRetry={retry}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Local setup needed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign in with Discord" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
