import { describe, it, expect } from "vitest";
import { dayRange } from "./leads.service.js";

describe("dayRange (RF21 conflict window)", () => {
  it("returns the UTC [startOfDay, nextDay) window", () => {
    const { start, end } = dayRange(new Date("2026-09-15T18:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });

  it("brackets any instant within the same day", () => {
    const { start, end } = dayRange(new Date("2026-01-01T23:59:59.000Z"));
    const sameDay = new Date("2026-01-01T00:00:00.000Z");
    const nextDay = new Date("2026-01-02T00:00:00.000Z");
    expect(sameDay >= start && sameDay < end).toBe(true);
    expect(nextDay >= start && nextDay < end).toBe(false);
  });
});
