import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Playwright web server command", () => {
  it("selects an npm executable that exists on the runner platform", () => {
    const source = readFileSync("playwright.config.ts", "utf8");

    expect(source).toContain('process.platform === "win32" ? "npm.cmd" : "npm"');
    expect(source).toContain("const npmCommand");
    expect(source).toContain("${npmCommand} run dev");
  });
});
