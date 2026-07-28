import { describe, expect, it } from "vitest";
import {
  currentLegalVersionIds,
  legalDocumentVersions,
  supplementRuleContent,
} from "../../src/lib/legal/documents";

describe("legal documents", () => {
  it("returns the current legal document version ids in display order", () => {
    expect(currentLegalVersionIds()).toEqual(legalDocumentVersions.map((document) => document.id));
  });

  it("provides supplement rule content for checkout consent", () => {
    expect(supplementRuleContent.title).toContain("二補");
    expect(supplementRuleContent.summary.length).toBeGreaterThan(20);
    expect(supplementRuleContent.points.length).toBeGreaterThanOrEqual(3);
  });
});
