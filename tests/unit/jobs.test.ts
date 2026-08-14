import { describe, expect, it } from "vitest";
import {
  isQuietTime,
  recapDedupeKey,
  retryDelayMinutes,
  type DueCard,
} from "@/jobs";

const reminder = (patch: Partial<DueCard> = {}): DueCard => ({
  cardId: "card",
  key: "WEB-1",
  title: "Check the lanterns",
  when: "2026-10-31",
  userId: "discord-user",
  quietStart: "22:00",
  quietEnd: "07:00",
  timezone: "UTC",
  ...patch,
});

describe("jobs scheduling", () => {
  it("caps retry backoff and keeps recap keys stable", () => {
    expect([1, 2, 3, 8].map(retryDelayMinutes)).toEqual([2, 4, 8, 60]);
    expect(recapDedupeKey("group-a", "2026-10-31")).toBe(
      "recap:group-a:2026-10-31",
    );
  });

  it("respects overnight quiet hours", () => {
    expect(isQuietTime(reminder(), new Date("2026-10-31T23:00:00Z"))).toBe(
      true,
    );
    expect(isQuietTime(reminder(), new Date("2026-10-31T12:00:00Z"))).toBe(
      false,
    );
  });
});
