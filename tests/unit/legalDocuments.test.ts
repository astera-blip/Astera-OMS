import { describe, expect, it } from "vitest";
import {
  currentLegalVersionIds,
  getCurrentLegalDocument,
  legalDocumentVersions,
  supplementRuleContent,
} from "../../src/lib/legal/documents";

describe("legal documents", () => {
  it("returns the current legal document version ids in display order", () => {
    expect(currentLegalVersionIds()).toEqual(legalDocumentVersions.map((document) => document.id));
  });

  it("selects the current public terms and privacy documents", () => {
    expect(getCurrentLegalDocument("terms")).toMatchObject({
      id: "terms-v2026-07-26",
      effectiveAt: "2026-07-26T00:00:00.000Z",
    });
    expect(getCurrentLegalDocument("privacy")).toMatchObject({
      id: "privacy-v2026-07-26",
      effectiveAt: "2026-07-26T00:00:00.000Z",
    });
  });

  it("provides supplement rule content for checkout consent", () => {
    expect(supplementRuleContent.title).toContain("二補");
    expect(supplementRuleContent.summary.length).toBeGreaterThan(20);
    expect(supplementRuleContent.points.length).toBeGreaterThanOrEqual(3);
  });
});
