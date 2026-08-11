import { describe, expect, it } from "vitest";
import {
  isProductClassificationKey,
  normalizeClassificationLabelKey,
  validateClassificationLabel,
  validateClassificationStatus,
} from "@/lib/product/classifications";

describe("classification validation", () => {
  it("normalizes casing and repeated whitespace for duplicate checks", () => {
    expect(normalizeClassificationLabelKey("  Freen   Sarocha ")).toBe("freen sarocha");
    expect(normalizeClassificationLabelKey("FREEN SAROCHA")).toBe("freen sarocha");
  });

  it("rejects blank and excessively long labels", () => {
    expect(validateClassificationLabel("   ")).toEqual({
      ok: false,
      error: "classification_label_required",
    });
    expect(validateClassificationLabel("a".repeat(121))).toEqual({
      ok: false,
      error: "classification_label_too_long",
    });
  });

  it("returns a trimmed label and only accepts supported statuses", () => {
    expect(validateClassificationLabel("  Freen Sarocha ")).toEqual({
      ok: true,
      value: "Freen Sarocha",
    });
    expect(validateClassificationStatus("active")).toEqual({ ok: true, value: "active" });
    expect(validateClassificationStatus("deleted")).toEqual({
      ok: false,
      error: "invalid_classification_status",
    });
  });

  it("rejects unsupported classification keys", () => {
    expect(isProductClassificationKey("artist")).toBe(true);
    expect(isProductClassificationKey("category")).toBe(false);
    expect(isProductClassificationKey("../../../orders")).toBe(false);
  });
});
