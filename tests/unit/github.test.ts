import { describe, expect, it } from "vitest";
import { parseGitHubIssueUrl } from "@/lib/github";

describe("GitHub issue links", () => {
  it("accepts and normalizes a GitHub issue URL", () => {
    const result = parseGitHubIssueUrl(
      " https://github.com/openai/openai-node/issues/123/ ",
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        url: "https://github.com/openai/openai-node/issues/123",
        owner: "openai",
        repo: "openai-node",
        issueNumber: 123,
      });
    }
  });

  it.each([
    "https://github.com/openai/openai-node/pull/123",
    "https://example.com/openai/openai-node/issues/123",
    "https://github.com/openai/openai-node/issues/not-a-number",
    "javascript:alert(1)",
  ])("rejects %s", (url) => {
    expect(parseGitHubIssueUrl(url).success).toBe(false);
  });
});
