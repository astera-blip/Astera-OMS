import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Next server runtime config", () => {
  test("keeps firebase-admin external in server bundles", () => {
    const configSource = readFileSync("next.config.ts", "utf8");

    expect(configSource).toContain("serverExternalPackages");
    expect(configSource).toMatch(/serverExternalPackages:\s*\[[\s\S]*"firebase-admin"/);
  });
});
