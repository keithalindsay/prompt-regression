import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const ProviderNameSchema = z.enum(["mock", "anthropic", "openai"]);
export type ProviderName = z.infer<typeof ProviderNameSchema>;

export const ThresholdsSchema = z.object({
  semanticMin: z.number().min(0).max(1).default(0.92),
  textNormalize: z.boolean().default(true),
  ignorePatterns: z
    .array(z.string())
    .default(["\\b\\d{4}-\\d{2}-\\d{2}T[0-9:.Z+-]+\\b"]),
});
export type Thresholds = z.infer<typeof ThresholdsSchema>;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CaseSchema = z.object({
  id: z.string().regex(KEBAB, "id must be kebab-case (a-z, 0-9, dashes)"),
  name: z.string().optional(),
  provider: ProviderNameSchema.optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).optional(),
  maxTokens: z.number().int().positive().optional(),
  system: z.string().optional(),
  prompt: z.string().min(1),
  input: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  thresholds: ThresholdsSchema.partial().optional(),
});
export type Case = z.infer<typeof CaseSchema>;

export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  casesGlob: z.string().default("cases/**/*.{yaml,yml,json}"),
  baselineDir: z.string().default(".prompt-regression/baselines"),
  defaults: z
    .object({
      provider: ProviderNameSchema.default("mock"),
      model: z.string().default("mock-1"),
      temperature: z.number().min(0).default(0),
      maxTokens: z.number().int().positive().default(1024),
    })
    .default({}),
  thresholds: ThresholdsSchema.default({}),
  report: z
    .object({
      showDiff: z.boolean().default(true),
      contextLines: z.number().int().nonnegative().default(3),
    })
    .default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

export const BaselineSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string(),
  provider: ProviderNameSchema,
  model: z.string(),
  params: z.object({ temperature: z.number(), maxTokens: z.number() }),
  renderedPromptHash: z.string(),
  output: z.string(),
  outputHash: z.string(),
  createdAt: z.string(),
  approvedBy: z.string(),
});
export type Baseline = z.infer<typeof BaselineSchema>;

export const VerdictSchema = z.enum(["PASS", "DRIFT", "NEW", "ERROR"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CaseResultSchema = z.object({
  caseId: z.string(),
  verdict: VerdictSchema,
  provider: ProviderNameSchema,
  model: z.string(),
  output: z.string(),
  baselineOutput: z.string().optional(),
  semanticScore: z.number().optional(),
  textDiff: z.string().optional(),
  changedLines: z.object({ added: z.number(), removed: z.number() }).optional(),
  error: z.string().optional(),
});
export type CaseResult = z.infer<typeof CaseResultSchema>;

export const RunReportSchema = z.object({
  schemaVersion: z.literal(1),
  startedAt: z.string(),
  finishedAt: z.string(),
  provider: ProviderNameSchema,
  model: z.string(),
  totals: z.object({
    total: z.number(),
    pass: z.number(),
    drift: z.number(),
    neu: z.number(),
    error: z.number(),
  }),
  results: z.array(CaseResultSchema),
  exitCode: z.union([z.literal(0), z.literal(1)]),
});
export type RunReport = z.infer<typeof RunReportSchema>;
