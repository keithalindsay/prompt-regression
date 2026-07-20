import { createTwoFilesPatch } from "diff";
import type { Baseline, CaseResult, ProviderName, Thresholds } from "./schemas";
import { tokenSetCosine } from "./util/similarity";

export function normalize(text: string, thresholds: Thresholds): string {
  let out = text;
  for (const pat of thresholds.ignorePatterns) {
    out = out.replace(new RegExp(pat, "g"), "");
  }
  if (thresholds.textNormalize) {
    out = out.trim().replace(/\s+/g, " ");
  }
  return out;
}

export function unifiedDiff(
  baseline: string,
  current: string,
  contextLines: number,
): { diff: string; added: number; removed: number } {
  const patch = createTwoFilesPatch(
    "baseline",
    "current",
    baseline.endsWith("\n") ? baseline : baseline + "\n",
    current.endsWith("\n") ? current : current + "\n",
    "",
    "",
    { context: contextLines },
  );
  let added = 0;
  let removed = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { diff: patch, added, removed };
}

export function compare(args: {
  caseId: string;
  provider: ProviderName;
  model: string;
  output: string;
  baseline?: Baseline;
  thresholds: Thresholds;
  contextLines: number;
  semanticScore?: number;
}): CaseResult {
  const { caseId, provider, model, output, baseline, thresholds, contextLines } = args;

  if (!baseline) {
    return { caseId, verdict: "NEW", provider, model, output };
  }

  const normBase = normalize(baseline.output, thresholds);
  const normCur = normalize(output, thresholds);

  if (normBase === normCur) {
    return {
      caseId, verdict: "PASS", provider, model, output,
      baselineOutput: baseline.output,
      semanticScore: 1,
    };
  }

  const semanticScore =
    args.semanticScore ?? tokenSetCosine(normBase, normCur);
  const { diff, added, removed } = unifiedDiff(baseline.output, output, contextLines);

  if (semanticScore >= thresholds.semanticMin) {
    return {
      caseId, verdict: "PASS", provider, model, output,
      baselineOutput: baseline.output,
      semanticScore,
      textDiff: diff,
      changedLines: { added, removed },
    };
  }

  return {
    caseId, verdict: "DRIFT", provider, model, output,
    baselineOutput: baseline.output,
    semanticScore,
    textDiff: diff,
    changedLines: { added, removed },
  };
}
