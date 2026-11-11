import { describe, it, expect } from "vitest";
import * as paginationLib from "../lib/pagination";

const { getPaginationRange } = paginationLib;

describe("getPaginationRange (Sliding Window Pagination)", () => {
  it("returns all pages when totalPages <= 7", () => {
    expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns start window with trailing ellipsis when current page is near start", () => {
    expect(getPaginationRange(1, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
    expect(getPaginationRange(3, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
    expect(getPaginationRange(4, 126)).toEqual([1, 2, 3, 4, 5, "...", 126]);
  });

  it("returns end window with leading ellipsis when current page is near end", () => {
    expect(getPaginationRange(126, 126)).toEqual([1, "...", 122, 123, 124, 125, 126]);
    expect(getPaginationRange(124, 126)).toEqual([1, "...", 122, 123, 124, 125, 126]);
  });

  it("returns middle window with both leading and trailing ellipses when in middle", () => {
    expect(getPaginationRange(80, 126)).toEqual([1, "...", 79, 80, 81, "...", 126]);
    expect(getPaginationRange(50, 100)).toEqual([1, "...", 49, 50, 51, "...", 100]);
  });

  it("handles boundary values safely", () => {
    expect(getPaginationRange(0, 0)).toEqual([1]);
    expect(getPaginationRange(-5, 10)).toEqual([1, 2, 3, 4, 5, "...", 10]);
    expect(getPaginationRange(200, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });
});

describe("resolveCatalogPageRedirect (Out-of-Bounds & Invalid Page Redirects)", () => {
  it("redirects invalid page values (0, -1, abc) to page 1", () => {
    const resolveCatalogPageRedirect = (paginationLib as Record<string, unknown>)
      .resolveCatalogPageRedirect as (
      rawPage: string | string[] | undefined,
      totalPages?: number,
    ) => number | null;

    expect(typeof resolveCatalogPageRedirect).toBe("function");
    expect(resolveCatalogPageRedirect("0", 9)).toBe(1);
    expect(resolveCatalogPageRedirect("-1", 9)).toBe(1);
    expect(resolveCatalogPageRedirect("abc", 9)).toBe(1);
    expect(resolveCatalogPageRedirect("", 9)).toBe(1);
  });

  it("redirects page > totalPages (e.g. page=999) to totalPages", () => {
    const resolveCatalogPageRedirect = (paginationLib as Record<string, unknown>)
      .resolveCatalogPageRedirect as (
      rawPage: string | string[] | undefined,
      totalPages?: number,
    ) => number | null;

    expect(typeof resolveCatalogPageRedirect).toBe("function");
    expect(resolveCatalogPageRedirect("999", 9)).toBe(9);
    expect(resolveCatalogPageRedirect("10", 9)).toBe(9);
    expect(resolveCatalogPageRedirect("5", 1)).toBe(1);
  });

  it("returns null when page is undefined or within valid [1..totalPages] range", () => {
    const resolveCatalogPageRedirect = (paginationLib as Record<string, unknown>)
      .resolveCatalogPageRedirect as (
      rawPage: string | string[] | undefined,
      totalPages?: number,
    ) => number | null;

    expect(typeof resolveCatalogPageRedirect).toBe("function");
    expect(resolveCatalogPageRedirect(undefined, 9)).toBeNull();
    expect(resolveCatalogPageRedirect("1", 9)).toBeNull();
    expect(resolveCatalogPageRedirect("9", 9)).toBeNull();
  });
});
