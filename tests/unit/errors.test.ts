import { describe, expect, it } from "vitest";
import { readJson } from "@/lib/server/errors";

describe("API input limits", () => {
  it("rejects an oversized JSON body before parsing", async () => {
    const request = new Request("https://board.example/api/cards", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(300 * 1024),
      },
      body: "{}",
    });
    await expect(readJson(request)).rejects.toMatchObject({
      status: 413,
      code: "request_too_large",
    });
  });

  it("returns a stable error for malformed JSON", async () => {
    const request = new Request("https://board.example/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    await expect(readJson(request)).rejects.toMatchObject({
      status: 400,
      code: "invalid_json",
    });
  });
});
