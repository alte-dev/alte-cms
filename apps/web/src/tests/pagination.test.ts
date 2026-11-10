import { describe, it, expect } from "vitest";
import { getPaginationRange } from "../lib/pagination";

describe("getPaginationRange (Sliding Window Pagination)", () => {
  it("returns all pages when totalPages <= 7", () => {
    expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns start window with trailing ellipsis when current page is near start", () => {
    // e.g. current = 2, total = 100 -> [1, 2, 3, 4, 5, "...", 100]
    expect(getPaginationRange(1, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
    expect(getPaginationRange(3, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
    expect(getPaginationRange(4, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
  });

  it("returns end window with leading ellipsis when current page is near end", () => {
    // e.g. current = 125, total = 126 -> [1, "...", 122, 123, 124, 125, 126]
    expect(getPaginationRange(126, 126)).toEqual([1, "...", 122, 123, 124, 125, 126]);
    expect(getPaginationRange(124, 126)).toEqual([1, "...", 122, 123, 124, 125, 126]);
  });

  it("returns middle window with both leading and trailing ellipses when in middle", () => {
    // e.g. current = 80, total = 126 -> [1, "...", 79, 80, 81, "...", 126]
    expect(getPaginationRange(80, 126)).toEqual([1, "...", 79, 80, 81, "...", 126]);
    expect(getPaginationRange(50, 100)).toEqual([1, "...", 49, 50, 51, "...", 100]);
  });

  it("handles boundary values safely", () => {
    expect(getPaginationRange(0, 0)).toEqual([1]);
    expect(getPaginationRange(-5, 10)).toEqual([1, 2, 3, 4, 5, "...", 10]);
    expect(getPaginationRange(200, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });
});
