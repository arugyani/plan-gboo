import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownNotes } from "@/components/markdown-notes";

describe("MarkdownNotes", () => {
  it("renders common Markdown and GitHub-flavored checklists", () => {
    render(
      <MarkdownNotes>
        {
          "## Plan\n\n- [x] Ready\n\n[Issue](https://github.com/rgboo/site/issues/1)"
        }
      </MarkdownNotes>,
    );

    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("link", { name: "Issue" })).toHaveAttribute(
      "href",
      "https://github.com/rgboo/site/issues/1",
    );
    expect(screen.getByRole("link", { name: "Issue" })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
  });

  it("does not turn raw HTML into page elements", () => {
    const { container } = render(
      <MarkdownNotes>{'<script>alert("nope")</script>'}</MarkdownNotes>,
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText(/<script>/)).toBeInTheDocument();
  });
});
