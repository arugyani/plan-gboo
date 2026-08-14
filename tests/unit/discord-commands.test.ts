import { describe, expect, it } from "vitest";
import { discordCommands } from "@/lib/discord/commands";
import { GET as getCommandManifest } from "@/app/api/discord/commands/route";

describe("Discord command manifest", () => {
  it("includes the friendly top-level commands and message action", () => {
    expect(discordCommands.map((command) => command.name)).toEqual([
      "my-list",
      "card",
      "board",
      "Add to The Board",
    ]);
  });

  it("supports GitHub links and complete checklist actions", () => {
    const card = discordCommands.find((command) => command.name === "card");
    const subcommands = "options" in (card ?? {}) ? card?.options : [];
    expect(subcommands?.map((command) => command.name)).toContain("link");
    const checklist = subcommands?.find(
      (command) => command.name === "checklist",
    );
    const action =
      checklist && "options" in checklist
        ? checklist.options.find((candidate) => candidate.name === "action")
        : undefined;
    expect(
      action && "choices" in action
        ? action.choices.map((choice) => choice.value)
        : [],
    ).toEqual(["view", "add", "complete", "reopen"]);
  });

  it("serves the raw array expected by Discord's bulk command API", async () => {
    const response = getCommandManifest();
    await expect(response.json()).resolves.toEqual(discordCommands);
  });
});
