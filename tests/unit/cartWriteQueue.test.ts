import { describe, expect, it } from "vitest";
import { createCartWriteQueue } from "@/lib/cart/cartWriteQueue";

describe("cart write queue", () => {
  it("runs a later cart update only after the earlier update finishes", async () => {
    const run = createCartWriteQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = run(async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
      return "first";
    });
    const second = run(async () => {
      events.push("second:start");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("continues with the next cart update after a failed update", async () => {
    const run = createCartWriteQueue();
    const failed = run(async () => {
      throw new Error("save failed");
    });
    const recovered = run(async () => "saved");

    await expect(failed).rejects.toThrow("save failed");
    await expect(recovered).resolves.toBe("saved");
  });
});
