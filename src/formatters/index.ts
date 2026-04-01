import type { ScanResult } from "../types.js";
import { formatGithub } from "./github.js";
import { formatJson } from "./json.js";
import { formatSarif } from "./sarif.js";
import { formatText } from "./text.js";

export { formatGithub } from "./github.js";
export { formatJson } from "./json.js";
export { formatSarif } from "./sarif.js";
export { formatText } from "./text.js";

/** Supported format names */
export type FormatName = "text" | "json" | "github" | "sarif" | "html";

/**
 * Get a formatter function by name.
 * Throws for unrecognized or not-yet-implemented formats.
 */
export function getFormatter(
  format: string,
): (result: ScanResult) => string {
  switch (format) {
    case "text":
      return formatText;
    case "json":
      return formatJson;
    case "github":
      return formatGithub;
    case "sarif":
      return formatSarif;
    case "html":
      throw new Error(
        `Format '${format}' is not yet implemented. Available formats: text, json, github, sarif`,
      );
    default:
      throw new Error(
        `Unknown format '${format}'. Available formats: text, json, github, sarif, html`,
      );
  }
}
