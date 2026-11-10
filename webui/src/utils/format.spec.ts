import { describe, expect, it } from "vitest";
import { formatDecimal, formatLearnRate, formatLoss, splitSamplePrompts } from "./format";

describe("formatDecimal & formatLearnRate", () => {
  it("converts scientific notation strings to clean decimals", () => {
    expect(formatLearnRate("2.00e-04")).toBe("0.0002");
    expect(formatLearnRate("2e-4")).toBe("0.0002");
    expect(formatLearnRate("1.00e-05")).toBe("0.00001");
    expect(formatLearnRate("1e-5")).toBe("0.00001");
    expect(formatLearnRate("5e-4")).toBe("0.0005");
    expect(formatLearnRate("1.5e-4")).toBe("0.00015");
    expect(formatLearnRate("3.50e-04")).toBe("0.00035");
  });

  it("handles numbers directly without exponents", () => {
    expect(formatLearnRate(0.0002)).toBe("0.0002");
    expect(formatLearnRate(0.00001)).toBe("0.00001");
    expect(formatLearnRate(0.0001)).toBe("0.0001");
    expect(formatLearnRate(0)).toBe("0");
  });

  it("handles standard decimal strings and numbers", () => {
    expect(formatLearnRate("0.0002")).toBe("0.0002");
    expect(formatLearnRate("0.000100")).toBe("0.0001");
  });

  it("handles null, undefined, and empty fallbacks cleanly", () => {
    expect(formatLearnRate(undefined)).toBe("—");
    expect(formatLearnRate(null)).toBe("—");
    expect(formatLearnRate("")).toBe("—");
    expect(formatLearnRate("—")).toBe("—");
    expect(formatDecimal(undefined, "")).toBe("");
    expect(formatDecimal(null, "")).toBe("");
    expect(formatDecimal("", "")).toBe("");
  });

  it("preserves non-numeric strings safely", () => {
    expect(formatDecimal("custom_preset", "")).toBe("custom_preset");
    expect(formatLearnRate("N/A")).toBe("N/A");
  });
});

describe("formatLoss", () => {
  it("formats loss numbers with 4 decimal places", () => {
    expect(formatLoss(0.0650123)).toBe("0.0650");
    expect(formatLoss("0.04")).toBe("0.0400");
    expect(formatLoss(0.12)).toBe("0.1200");
    expect(formatLoss(undefined)).toBe("—");
    expect(formatLoss(null)).toBe("—");
  });
});

describe("splitSamplePrompts", () => {
  it("treats each non-empty line as one prompt and ignores blank lines", () => {
    expect(splitSamplePrompts("portrait of ohwx\n\nwide shot of ohwx\ncandid photo")).toEqual([
      "portrait of ohwx",
      "wide shot of ohwx",
      "candid photo",
    ]);
    expect(splitSamplePrompts("   \n  ")).toEqual([]);
    expect(splitSamplePrompts(undefined)).toEqual([]);
  });
});
