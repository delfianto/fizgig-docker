/**
 * Common formatting utilities for numeric and scientific telemetry values.
 */

export function toPrimitiveString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
    return String(val);
  }
  return "";
}

/**
 * Converts numbers, decimal strings, and scientific notation (e.g. 2.00e-04, 1e-5)
 * into a standard, clean decimal string representation without exponent notation.
 *
 * @param val - The raw value (string, number, null, or undefined)
 * @param fallback - String returned when value is empty, null, or undefined (default: "")
 * @param maxDecimals - Maximum fraction digits to preserve (default: 8)
 */
export function formatDecimal(val: unknown, fallback = "", maxDecimals = 8): string {
  if (val === undefined || val === null || val === "" || val === "—") {
    return fallback;
  }

  const str = toPrimitiveString(val).trim();
  if (str === "") return fallback;

  const isScientific = /^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(str);
  const num = typeof val === "number" ? val : Number(str);

  if (
    !Number.isNaN(num) &&
    (isScientific || typeof val === "number" || /^[+-]?\d+(\.\d+)?$/.test(str))
  ) {
    return num.toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: maxDecimals,
    });
  }

  return str;
}

export function formatLearnRate(val: unknown, fallback = "—"): string {
  return formatDecimal(val, fallback, 8);
}

export function formatLoss(val: unknown, fallback = "—", decimals = 4): string {
  if (val === undefined || val === null || val === "" || val === "—") {
    return fallback;
  }
  const rawStr = toPrimitiveString(val).trim();
  const num = typeof val === "number" ? val : Number(rawStr);
  if (Number.isNaN(num)) {
    return rawStr || fallback;
  }
  return num.toFixed(decimals);
}

/**
 * Parses multiline SAMPLE_PROMPT strings identically to upstream Fizgig's server.py:
 * each non-empty line is one sample prompt (blank lines are ignored).
 */
export function splitSamplePrompts(raw: unknown): string[] {
  return toPrimitiveString(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
