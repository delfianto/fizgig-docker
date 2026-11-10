/**
 * Common formatting utilities for numeric and scientific telemetry values.
 */

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

  const str = String(val).trim();
  if (str === "") return fallback;

  // Check if string is scientific notation or a numeric string
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

/**
 * Specifically formats learning rate values for telemetry strips, KPI cards,
 * parameter forms, and chart markers.
 *
 * Examples:
 * - "2.00e-04" -> "0.0002"
 * - "1e-5"     -> "0.00001"
 * - 0.0002     -> "0.0002"
 * - undefined  -> "—"
 */
export function formatLearnRate(val: unknown, fallback = "—"): string {
  return formatDecimal(val, fallback, 8);
}

/**
 * Formats model training loss to a consistent decimal representation.
 *
 * Examples:
 * - 0.0650123 -> "0.0650"
 * - "0.04"    -> "0.0400"
 * - undefined -> "—"
 */
export function formatLoss(val: unknown, fallback = "—", decimals = 4): string {
  if (val === undefined || val === null || val === "" || val === "—") {
    return fallback;
  }
  const num = typeof val === "number" ? val : Number(String(val).trim());
  if (Number.isNaN(num)) {
    return String(val);
  }
  return num.toFixed(decimals);
}

/**
 * Parses multiline SAMPLE_PROMPT strings identically to upstream Fizgig's server.py:
 * each non-empty line is one sample prompt (blank lines are ignored).
 */
export function splitSamplePrompts(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
