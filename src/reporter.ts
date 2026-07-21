import pc from "picocolors";
import type { CaseResult, RunReport } from "./schemas";

function colorize(verdict: CaseResult["verdict"], color: boolean): string {
  const label = verdict.padEnd(5);
  if (!color) return label;
  switch (verdict) {
    case "PASS": return pc.green(label);
    case "DRIFT": return pc.red(label);
    case "NEW": return pc.cyan(label);
    case "ERROR": return pc.yellow(label);
  }
}

function colorizeDiffLine(line: string, color: boolean): string {
  if (!color) return line;
  if (line.startsWith("+++") || line.startsWith("---")) return pc.dim(line);
  if (line.startsWith("@@")) return pc.cyan(line);
  if (line.startsWith("=")) return pc.dim(line);
  if (line.startsWith("+")) return pc.green(line);
  if (line.startsWith("-")) return pc.red(line);
  return line;
}

function indentDiff(diff: string, color: boolean): string {
  return diff
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => "    " + colorizeDiffLine(l, color))
    .join("\n");
}

export function formatSummaryLine(report: RunReport): string {
  const t = report.totals;
  return `Summary: ${t.total} total · ${t.pass} pass · ${t.drift} drift · ${t.neu} new · ${t.error} error`;
}

export function renderReport(
  report: RunReport,
  opts: { color: boolean; showDiff: boolean },
): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`prompt-regression · provider=${report.provider} model=${report.model}`);
  lines.push("");

  for (const r of report.results) {
    let head = `  ${colorize(r.verdict, opts.color)}  ${r.caseId}`;
    if (r.verdict === "NEW" && r.baselineWritten) head += "   (baseline created)";
    if (r.verdict === "ERROR") head += `   ${r.error ?? ""}`;
    if (r.semanticScore !== undefined && (r.verdict === "DRIFT" || r.verdict === "PASS")) {
      head += `   semantic=${r.semanticScore.toFixed(2)}`;
    }
    if (r.changedLines) head += `  +${r.changedLines.added} / -${r.changedLines.removed}`;
    lines.push(head);
    if (opts.showDiff && r.verdict === "DRIFT" && r.textDiff) {
      lines.push("");
      lines.push(indentDiff(r.textDiff, opts.color));
      lines.push("");
    }
  }

  lines.push("");
  lines.push(formatSummaryLine(report));
  lines.push(`Exit: ${report.exitCode}`);
  return lines.join("\n");
}
