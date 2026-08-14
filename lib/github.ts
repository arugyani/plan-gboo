import { z } from "zod";

export const githubIssueUrlSchema = z
  .url("Paste a full GitHub issue link")
  .transform((value, context) => {
    const url = new URL(value);
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/);
    if (url.hostname !== "github.com" || !match) {
      context.addIssue({
        code: "custom",
        message: "Use a link like github.com/owner/repo/issues/123",
      });
      return z.NEVER;
    }
    const [, owner, repo, issue] = match;
    return {
      url: `https://github.com/${owner}/${repo}/issues/${issue}`,
      owner,
      repo,
      issueNumber: Number(issue),
    };
  });

export function parseGitHubIssueUrl(value: string) {
  return githubIssueUrlSchema.safeParse(value.trim());
}
