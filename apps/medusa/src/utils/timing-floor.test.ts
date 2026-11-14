import { describe, expect, it } from "vitest";
import { dummyScryptWork, waitTimingFloor } from "./timing-floor";

describe("timing-floor", () => {
  it("waits until floorMs has elapsed since startMs", async () => {
    const start = Date.now();
    await waitTimingFloor(start, 60);
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });

  it("does not wait if floorMs has already elapsed", async () => {
    const start = Date.now() - 500;
    const t0 = Date.now();
    await waitTimingFloor(start, 100);
    expect(Date.now() - t0).toBeLessThan(40);
  });

  it("executes dummyScryptWork without throwing", async () => {
    await expect(dummyScryptWork("SomePassword123!")).resolves.toBeUndefined();
  });
});
