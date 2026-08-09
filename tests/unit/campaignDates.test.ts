import { describe, expect, it } from "vitest";
import {
  campaignDateTimeLocalToUtc,
  campaignDateTimeToLocalInput,
  parseCampaignDateTime,
} from "@/lib/product/campaignDates";

describe("campaign datetime contract", () => {
  it("stores a datetime-local value as a canonical UTC ISO value using Taipei time", () => {
    expect(campaignDateTimeLocalToUtc("2026-08-01T12:30")).toBe("2026-08-01T04:30:00.000Z");
  });

  it("round-trips canonical UTC values back to the datetime-local input format", () => {
    expect(campaignDateTimeToLocalInput("2026-08-01T04:30:00.000Z")).toBe("2026-08-01T12:30");
  });

  it("keeps legacy local values compatible by interpreting them as Taipei time", () => {
    expect(parseCampaignDateTime("2026-08-01T12:30").toISOString()).toBe("2026-08-01T04:30:00.000Z");
  });

  it("rejects impossible local dates", () => {
    expect(() => campaignDateTimeLocalToUtc("2026-02-30T12:30")).toThrow("Invalid campaign datetime");
  });
});
