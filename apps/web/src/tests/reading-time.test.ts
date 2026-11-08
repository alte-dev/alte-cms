import { describe, it, expect } from "vitest";
import { calculateReadingTime, extractLexicalText } from "../lib/reading-time";

describe("Reading Time Calculator", () => {
  it("defaults to 1 minute for empty or very short content", () => {
    expect(calculateReadingTime("")).toBe(1);
    expect(calculateReadingTime(null)).toBe(1);
    expect(calculateReadingTime("Kısa bir yazı.")).toBe(1);
  });

  it("calculates reading time from plain text", () => {
    // 450 words should be Math.ceil(450 / 200) = 3 minutes
    const words = Array(450).fill("kelime").join(" ");
    expect(calculateReadingTime(words)).toBe(3);
  });

  it("calculates reading time from Lexical JSON tree", () => {
    const lexicalDoc = {
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              {
                text: Array(250).fill("medusa").join(" "),
              },
            ],
          },
          {
            type: "paragraph",
            children: [
              {
                text: Array(250).fill("payload").join(" "),
              },
            ],
          },
        ],
      },
    };
    // 500 words -> 3 minutes
    expect(calculateReadingTime(lexicalDoc)).toBe(3);
  });
});
