import type { SgNode } from "@ast-grep/napi";
import type { DetectionContext, Finding } from "../types.js";

/**
 * Create a Finding from an AST node (ast-grep based detectors).
 * Extracts line/column/endLine/endColumn from the node's range,
 * converting from 0-indexed (ast-grep) to 1-indexed (Finding).
 */
export function makeFinding(
  detectorId: string,
  ctx: DetectionContext,
  node: SgNode,
  message: string,
  severity: "error" | "warning" | "info",
  suggestion?: string,
): Finding {
  const range = node.range();
  return {
    detectorId,
    message,
    severity,
    file: ctx.file.path,
    line: range.start.line + 1,
    column: range.start.column + 1,
    endLine: range.end.line + 1,
    endColumn: range.end.column + 1,
    ...(suggestion != null && { suggestion }),
  };
}

/**
 * Create a Finding from explicit line/column values (regex/line-based detectors).
 * Line and column should already be 1-indexed.
 */
export function makeLineFinding(
  detectorId: string,
  ctx: DetectionContext,
  line: number,
  column: number,
  message: string,
  severity: "error" | "warning" | "info",
  suggestion?: string,
): Finding {
  return {
    detectorId,
    message,
    severity,
    file: ctx.file.path,
    line,
    column,
    ...(suggestion != null && { suggestion }),
  };
}
