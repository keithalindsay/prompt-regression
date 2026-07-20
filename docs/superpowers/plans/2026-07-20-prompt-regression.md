# prompt-regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `prompt-regression`, a TypeScript CLI that does snapshot testing for LLM prompts — run cases against a model, diff outputs (textual + semantic) against committed baselines, and fail CI on drift until a human approves.

**Architecture:** A `commander` CLI (`init | run | approve | list`) over focused modules: zod schemas as the single source of truth, a provider registry (`mock` default, `anthropic`/`openai` lazy-loaded), a content-addressed cache, a baseline store on disk, a comparator (jsdiff + token-set-cosine semantic score) that yields a `PASS | DRIFT | NEW | ERROR` verdict, and a reporter (colored terminal + JSON). The `mock` provider makes the whole tool runnable and testable with zero API keys.

**Tech Stack:** TypeScript on Node ≥ 20 (ESM), commander, zod, yaml, diff (jsdiff), picocolors; anthropic/openai official SDKs as optionalDependencies (lazy). Build: tsup. Tests: vitest.

**Spec:** The authoritative design is `DESIGN.md` in the repo root. This plan executes DESIGN.md §11 with TDD. Where a contract (config keys, verdict rules, CLI flags, JSON shapes) is stated in DESIGN.md, this plan reproduces the essential parts; on any ambiguity, DESIGN.md wins.

## Global Constraints

- **Runtime:** Node.js ≥ 20, `"type": "module"` (ESM). Use `.js` extension in relative import specifiers within `src/` (NodeNext/tsup requirement) OR configure tsup bundling — this plan uses tsup bundling so bare relative imports without extensions are fine in source; do NOT hand-write `.js` suffixes.
- **Zero-key default:** default provider is `mock`; every test and the README quickstart must pass with NO API keys and NO network.
- **Secrets never touch disk:** API keys read from env only (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`); never write them into baselines, cache, or `last-run.json`.
- **No hidden network:** the only permitted network egress is to the explicitly-selected model provider. No telemetry.
- **Determinism:** temperature defaults to `0`; mock provider output is a pure function of the rendered prompt.
- **Exit-code contract (verbatim):** `run` exits `0` when all cases are `PASS`/`NEW`; `1` when any case is `DRIFT` or `ERROR`; `2` on usage/config error.
- **Provider SDKs are `optionalDependencies`** and MUST be imported lazily (`await import(...)`) so installing the tool never requires them.
- **Author/repo identity:** GitHub account is **keithalindsay** (NOT Aigeninc). All `package.json` URLs and DESIGN.md author link use `github.com/keithalindsay/prompt-regression`.
- **Baseline filename = case `id`** (kebab-case, unique). Baselines are committed; cache and `last-run.json` are gitignored.

---

### Task 1: Toolchain, identity fix, and green empty build

**Files:**
- Modify: `package.json` (Aigeninc → keithalindsay; add nothing else)
- Modify: `DESIGN.md:6` (author GitHub link Aigeninc → keithalindsay)
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `src/schemas.ts` (temporary trivial export so build/test have a target)
- Create: `test/smoke.test.ts`

**Interfaces:**
- Produces: a repo where `npm run build`, `npm run typecheck`, and `npm test` all succeed (empty pass).

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /home/keith/projects/portfolio/prompt-regression
npm install
```
Expected: installs deps from the existing `package.json` (commander, diff, picocolors, yaml, zod, plus dev tsup/tsx/typescript/vitest/eslint/prettier). `@anthropic-ai/sdk` and `openai` are optionalDependencies and may or may not install; that's fine.

- [ ] **Step 2: Flip identity from Aigeninc to keithalindsay**

In `package.json`, change these four values:
```json
  "author": "Keith Lindsay (https://github.com/keithalindsay)",
```
```json
  "repository": {
    "type": "git",
    "url": "https://github.com/keithalindsay/prompt-regression.git"
  },
  "bugs": {
    "url": "https://github.com/keithalindsay/prompt-regression/issues"
  },
  "homepage": "https://github.com/keithalindsay/prompt-regression#readme"
```
In `DESIGN.md` line 6, change `[Aigeninc](https://github.com/Aigeninc)` to `[keithalindsay](https://github.com/keithalindsay)`.

Verify none remain:
```bash
grep -rn "Aigeninc" . --include="*.json" --include="*.md" --include="*.ts"
```
Expected: no output.

- [ ] **Step 3: Add `tsconfig.json`**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "verbatimModuleSyntax": false
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Add `tsup.config.ts` and `vitest.config.ts`**

Create `tsup.config.ts`:
```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  dts: false,
  clean: true,
  shims: true,
  banner: { js: "#!/usr/bin/env node" },
  // Never bundle the optional provider SDKs.
  external: ["@anthropic-ai/sdk", "openai"],
});
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Add a trivial `src/schemas.ts` and a smoke test**

Create `src/schemas.ts`:
```ts
// Real schemas land in Task 2. Placeholder export keeps the build green.
export const SCHEMA_VERSION = 1 as const;
```

Create `test/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
import { SCHEMA_VERSION } from "../src/schemas";

test("toolchain is wired", () => {
  expect(SCHEMA_VERSION).toBe(1);
});
```

- [ ] **Step 6: Verify build, typecheck, and test all pass**

Run:
```bash
npm run typecheck && npm run build && npm test
```
Expected: typecheck clean; `dist/cli.js` produced; vitest reports 1 passing test.

- [ ] **Step 7: Commit**

```bash
git init 2>/dev/null; git add -A
git commit -m "chore: toolchain, keithalindsay identity, green empty build"
```

---

### Task 2: Zod schemas (single source of truth)

**Files:**
- Modify: `src/schemas.ts`
- Test: `test/schemas.test.ts`

**Interfaces:**
- Produces:
  - `ProviderName` = `"mock" | "anthropic" | "openai"`
  - `ThresholdsSchema` / `Thresholds` = `{ semanticMin: number; textNormalize: boolean; ignorePatterns: string[] }`
  - `CaseSchema` / `Case` = `{ id; name?; provider?; model?; temperature?; maxTokens?; system?; prompt; input?; thresholds? }`
  - `ConfigSchema` / `Config` = `{ version; casesGlob; baselineDir; defaults:{provider,model,temperature,maxTokens}; thresholds: Thresholds; report:{showDiff,contextLines} }`
  - `BaselineSchema` / `Baseline` (see DESIGN §8)
  - `Verdict` = `"PASS" | "DRIFT" | "NEW" | "ERROR"`
  - `CaseResultSchema` / `CaseResult`, `RunReportSchema` / `RunReport`
  - `DEFAULT_CONFIG: Config` (the defaults from DESIGN §7 config block)

- [ ] **Step 1: Write the failing test**

Create `test/schemas.test.ts`:
```ts
import { expect, test } from "vitest";
import {
  CaseSchema,
  ConfigSchema,
  DEFAULT_CONFIG,
  BaselineSchema,
} from "../src/schemas";

test("a minimal case requires an id and prompt", () => {
  const parsed = CaseSchema.parse({ id: "hello", prompt: "Hi {{name}}" });
  expect(parsed.id).toBe("hello");
  expect(parsed.prompt).toBe("Hi {{name}}");
});

test("a case without a prompt is rejected", () => {
  expect(() => CaseSchema.parse({ id: "x" })).toThrow();
});

test("case id must be kebab-case", () => {
  expect(() => CaseSchema.parse({ id: "Not Kebab", prompt: "y" })).toThrow();
});

test("config applies defaults for omitted fields", () => {
  const cfg = ConfigSchema.parse({});
  expect(cfg.defaults.provider).toBe("mock");
  expect(cfg.defaults.temperature).toBe(0);
  expect(cfg.thresholds.semanticMin).toBe(0.92);
  expect(cfg).toEqual(DEFAULT_CONFIG);
});

test("baseline record round-trips", () => {
  const b = BaselineSchema.parse({
    schemaVersion: 1,
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    params: { temperature: 0, maxTokens: 256 },
    renderedPromptHash: "sha256:abc",
    output: "hello",
    outputHash: "sha256:def",
    createdAt: "2026-07-20T00:00:00.000Z",
    approvedBy: "cli",
  });
  expect(b.caseId).toBe("hello");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/schemas.test.ts`
Expected: FAIL (schemas not exported yet).

- [ ] **Step 3: Implement `src/schemas.ts`**

Replace `src/schemas.ts` with:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/schemas.test.ts`
Expected: PASS (5 tests). Also run `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/schemas.ts test/schemas.test.ts
git commit -m "feat(schemas): zod schemas + inferred types as single source of truth"
```

---

### Task 3: Utilities — hash, fs, similarity

**Files:**
- Create: `src/util/hash.ts`, `src/util/fs.ts`, `src/util/similarity.ts`
- Test: `test/similarity.test.ts`, `test/fs.test.ts`

**Interfaces:**
- Produces:
  - `sha256(input: string): string` → `"sha256:<hex>"`
  - `ensureDir(dir: string): void`
  - `readTextIfExists(file: string): string | undefined`
  - `writeText(file: string, data: string): void`
  - `findCaseFiles(glob: string, cwd: string): string[]` — supports our glob shape only: an optional dir prefix, `**`, and a trailing `*.{ext,ext}` group.
  - `tokenSetCosine(a: string, b: string): number` → `0..1` (`1` identical token multiset, `0` disjoint)

- [ ] **Step 1: Write the failing tests**

Create `test/similarity.test.ts`:
```ts
import { expect, test } from "vitest";
import { tokenSetCosine } from "../src/util/similarity";

test("identical text scores 1", () => {
  expect(tokenSetCosine("hello there ada", "hello there ada")).toBeCloseTo(1, 5);
});

test("disjoint text scores 0", () => {
  expect(tokenSetCosine("alpha beta", "gamma delta")).toBeCloseTo(0, 5);
});

test("paraphrase scores in the middle", () => {
  const s = tokenSetCosine(
    "hello ada lovely to meet you",
    "hello ada wishing you a lovely day",
  );
  expect(s).toBeGreaterThan(0.2);
  expect(s).toBeLessThan(0.95);
});

test("empty vs empty is 1; empty vs non-empty is 0", () => {
  expect(tokenSetCosine("", "")).toBe(1);
  expect(tokenSetCosine("", "hi")).toBe(0);
});
```

Create `test/fs.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCaseFiles, readTextIfExists, sha256AsHelper } from "../src/util/fs";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-fs-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("readTextIfExists returns undefined for missing file", () => {
  expect(readTextIfExists(join(tmp(), "nope.txt"))).toBeUndefined();
});

test("findCaseFiles matches yaml/yml/json under ** recursively", () => {
  const root = tmp();
  mkdirSync(join(root, "cases", "nested"), { recursive: true });
  writeFileSync(join(root, "cases", "a.case.yaml"), "id: a");
  writeFileSync(join(root, "cases", "nested", "b.case.json"), "{}");
  writeFileSync(join(root, "cases", "ignore.txt"), "no");
  const found = findCaseFiles("cases/**/*.{yaml,yml,json}", root).sort();
  expect(found.map((f) => f.replace(root + "/", ""))).toEqual([
    "cases/a.case.yaml",
    "cases/nested/b.case.json",
  ]);
});
```
> Note: `sha256AsHelper` is imported only to prove the module barrel; if you prefer, drop that import — it is not asserted. Keep the test focused on `findCaseFiles`/`readTextIfExists`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/similarity.test.ts test/fs.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the utilities**

Create `src/util/hash.ts`:
```ts
import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return "sha256:" + createHash("sha256").update(input, "utf8").digest("hex");
}
```

Create `src/util/fs.ts`:
```ts
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function readTextIfExists(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf8");
}

export function writeText(file: string, data: string): void {
  ensureDir(dirname(file));
  writeFileSync(file, data, "utf8");
}

/**
 * Minimal glob for our one supported shape:
 *   [prefixDir/]**\/*.{ext1,ext2,...}   or   [prefixDir/]*.{ext,...}
 * Returns absolute-ish paths joined against `cwd`.
 */
export function findCaseFiles(glob: string, cwd: string): string[] {
  const starStar = glob.includes("**");
  const extMatch = glob.match(/\{([^}]+)\}\s*$/);
  const exts = extMatch
    ? extMatch[1].split(",").map((e) => e.trim().replace(/^\./, ""))
    : ["yaml", "yml", "json"];
  const prefix = glob.split(/\*\*?/)[0].replace(/\/$/, "");
  const base = prefix ? join(cwd, prefix) : cwd;
  const out: string[] = [];
  walk(base, exts, starStar, out);
  return out;
}

function walk(dir: string, exts: string[], recurse: boolean, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (recurse) walk(full, exts, recurse, out);
    } else if (exts.some((e) => ent.name.endsWith("." + e))) {
      out.push(full);
    }
  }
}
```
> Remove the unused `sha256AsHelper` import from `test/fs.test.ts` (it does not exist).

Create `src/util/similarity.ts`:
```ts
/** Tokenize to lowercase word tokens. */
function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

/** Cosine similarity over term-frequency vectors (bag of words). 0..1. */
export function tokenSetCosine(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 && tb.length === 0) return 1;
  if (ta.length === 0 || tb.length === 0) return 0;
  const fa = freq(ta);
  const fb = freq(tb);
  let dot = 0;
  for (const [term, ca] of fa) {
    const cb = fb.get(term);
    if (cb) dot += ca * cb;
  }
  const mag = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  const denom = mag(fa) * mag(fb);
  return denom === 0 ? 0 : dot / denom;
}

function freq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/similarity.test.ts test/fs.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util test/similarity.test.ts test/fs.test.ts
git commit -m "feat(util): hash, fs (glob-lite), token-set cosine similarity"
```

---

### Task 4: Config loader

**Files:**
- Create: `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Consumes: `ConfigSchema`, `Config`, `DEFAULT_CONFIG` (Task 2); `readTextIfExists` (Task 3).
- Produces: `loadConfig(opts: { configPath: string; overrides?: ConfigOverrides }): Config` where
  `ConfigOverrides = { casesGlob?: string; provider?: ProviderName; model?: string }`. Missing config file ⇒ defaults. Parse errors throw a `ConfigError` (name `"ConfigError"`) with a readable message.

- [ ] **Step 1: Write the failing test**

Create `test/config.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cfg-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("missing config file yields defaults", () => {
  const cfg = loadConfig({ configPath: join(tmp(), "none.yaml") });
  expect(cfg.defaults.provider).toBe("mock");
  expect(cfg.thresholds.semanticMin).toBe(0.92);
});

test("yaml values override defaults; CLI overrides beat file", () => {
  const dir = tmp();
  const p = join(dir, "prompt-regression.config.yaml");
  writeFileSync(
    p,
    "defaults:\n  provider: mock\n  model: mock-1\nthresholds:\n  semanticMin: 0.8\n",
  );
  const cfg = loadConfig({ configPath: p, overrides: { model: "mock-2" } });
  expect(cfg.thresholds.semanticMin).toBe(0.8);
  expect(cfg.defaults.model).toBe("mock-2"); // CLI override wins
});

test("invalid config throws ConfigError", () => {
  const dir = tmp();
  const p = join(dir, "bad.yaml");
  writeFileSync(p, "thresholds:\n  semanticMin: 5\n"); // > 1 invalid
  expect(() => loadConfig({ configPath: p })).toThrowError(/ConfigError|semanticMin/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/config.ts`**

```ts
import { parse as parseYaml } from "yaml";
import { ConfigSchema, type Config, type ProviderName } from "./schemas";
import { readTextIfExists } from "./util/fs";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface ConfigOverrides {
  casesGlob?: string;
  provider?: ProviderName;
  model?: string;
}

export function loadConfig(opts: {
  configPath: string;
  overrides?: ConfigOverrides;
}): Config {
  const raw = readTextIfExists(opts.configPath);
  let data: unknown = {};
  if (raw !== undefined) {
    try {
      data = parseYaml(raw) ?? {};
    } catch (e) {
      throw new ConfigError(
        `Failed to parse config at ${opts.configPath}: ${(e as Error).message}`,
      );
    }
  }
  const parsed = ConfigSchema.safeParse(data);
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid config at ${opts.configPath}:\n` + parsed.error.toString(),
    );
  }
  const cfg = parsed.data;
  const o = opts.overrides ?? {};
  return {
    ...cfg,
    casesGlob: o.casesGlob ?? cfg.casesGlob,
    defaults: {
      ...cfg.defaults,
      provider: o.provider ?? cfg.defaults.provider,
      model: o.model ?? cfg.defaults.model,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/config.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat(config): load + validate config with CLI override merge"
```

---

### Task 5: Case loader + prompt renderer

**Files:**
- Create: `src/cases.ts`, `src/prompt.ts`
- Test: `test/prompt.test.ts`, `test/cases.test.ts`

**Interfaces:**
- Consumes: `CaseSchema`, `Case`, `Config` (Task 2); `findCaseFiles`, `readTextIfExists` (Task 3).
- Produces:
  - `loadCases(config: Config, cwd: string): Case[]` — glob → parse YAML/JSON → validate; throws `CaseError` on invalid/duplicate ids.
  - `renderPrompt(c: Case): { system?: string; user: string }` — substitutes `{{var}}` from `c.input`; throws `PromptError` on a `{{var}}` with no matching input key, and on an input key never referenced (strict both ways is too aggressive — only throw on MISSING referenced vars; unused input keys are allowed).

- [ ] **Step 1: Write the failing tests**

Create `test/prompt.test.ts`:
```ts
import { expect, test } from "vitest";
import { renderPrompt } from "../src/prompt";

test("substitutes variables in system and user prompts", () => {
  const r = renderPrompt({
    id: "greet",
    system: "You greet {{who}}.",
    prompt: "Say hi to {{who}} now.",
    input: { who: "Ada" },
  });
  expect(r.system).toBe("You greet Ada.");
  expect(r.user).toBe("Say hi to Ada now.");
});

test("coerces number/boolean inputs to strings", () => {
  const r = renderPrompt({
    id: "n",
    prompt: "count={{n}} flag={{f}}",
    input: { n: 3, f: true },
  });
  expect(r.user).toBe("count=3 flag=true");
});

test("throws on a referenced variable with no input", () => {
  expect(() =>
    renderPrompt({ id: "x", prompt: "Hi {{missing}}", input: {} }),
  ).toThrowError(/missing/);
});

test("no input map + no vars renders literally", () => {
  const r = renderPrompt({ id: "x", prompt: "plain text" });
  expect(r.user).toBe("plain text");
});
```

Create `test/cases.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCases, CaseError } from "../src/cases";
import { DEFAULT_CONFIG } from "../src/schemas";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cases-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("loads and validates yaml cases", () => {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Hi {{name}}\ninput:\n  name: Ada\n",
  );
  const cases = loadCases(DEFAULT_CONFIG, root);
  expect(cases).toHaveLength(1);
  expect(cases[0]!.id).toBe("hello");
});

test("duplicate ids throw CaseError", () => {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(join(root, "cases", "a.case.yaml"), "id: dup\nprompt: a");
  writeFileSync(join(root, "cases", "b.case.yaml"), "id: dup\nprompt: b");
  expect(() => loadCases(DEFAULT_CONFIG, root)).toThrow(CaseError);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/prompt.test.ts test/cases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/prompt.ts` and `src/cases.ts`**

Create `src/prompt.ts`:
```ts
import type { Case } from "./schemas";

export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptError";
  }
}

const VAR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function substitute(template: string, input: Record<string, string | number | boolean>, caseId: string): string {
  return template.replace(VAR, (_m, key: string) => {
    if (!(key in input)) {
      throw new PromptError(
        `Case "${caseId}": template references {{${key}}} but no such variable is in "input".`,
      );
    }
    return String(input[key]);
  });
}

export function renderPrompt(c: Case): { system?: string; user: string } {
  const input = c.input ?? {};
  return {
    system: c.system !== undefined ? substitute(c.system, input, c.id) : undefined,
    user: substitute(c.prompt, input, c.id),
  };
}
```

Create `src/cases.ts`:
```ts
import { parse as parseYaml } from "yaml";
import { CaseSchema, type Case, type Config } from "./schemas";
import { findCaseFiles, readTextIfExists } from "./util/fs";

export class CaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseError";
  }
}

export function loadCases(config: Config, cwd: string): Case[] {
  const files = findCaseFiles(config.casesGlob, cwd).sort();
  const cases: Case[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    const raw = readTextIfExists(file);
    if (raw === undefined) continue;
    let data: unknown;
    try {
      data = parseYaml(raw);
    } catch (e) {
      throw new CaseError(`Failed to parse case ${file}: ${(e as Error).message}`);
    }
    const parsed = CaseSchema.safeParse(data);
    if (!parsed.success) {
      throw new CaseError(`Invalid case ${file}:\n${parsed.error.toString()}`);
    }
    const c = parsed.data;
    const prior = seen.get(c.id);
    if (prior) {
      throw new CaseError(`Duplicate case id "${c.id}" in ${file} and ${prior}.`);
    }
    seen.set(c.id, file);
    cases.push(c);
  }
  return cases;
}
```
> `yaml.parse` also parses JSON, so `.json` case files work through the same path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/prompt.test.ts test/cases.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/prompt.ts src/cases.ts test/prompt.test.ts test/cases.test.ts
git commit -m "feat(cases,prompt): load/validate cases and render {{vars}}"
```

---

### Task 6: Provider interface, mock provider, registry

**Files:**
- Create: `src/providers/types.ts`, `src/providers/mock.ts`, `src/providers/registry.ts`
- Test: `test/mock.test.ts`

**Interfaces:**
- Consumes: `ProviderName` (Task 2); `sha256` (Task 3); `tokenSetCosine` is NOT used here.
- Produces:
  - `interface CompletionRequest { system?: string; user: string; model: string; temperature: number; maxTokens: number; seed?: number }`
  - `interface Provider { name: ProviderName; complete(req: CompletionRequest): Promise<string>; embed?(text: string): Promise<number[]> }`
  - `createMockProvider(): Provider` — `complete` returns a deterministic short sentence derived from `sha256(system+user)`; `embed` returns a deterministic pseudo-vector.
  - `getProvider(name: ProviderName): Promise<Provider>` — lazy; validates env for real providers, throwing `ProviderError` (name `"ProviderError"`) if the key is missing.

- [ ] **Step 1: Write the failing test**

Create `test/mock.test.ts`:
```ts
import { expect, test } from "vitest";
import { createMockProvider } from "../src/providers/mock";
import { getProvider } from "../src/providers/registry";

test("mock.complete is deterministic for identical prompts", async () => {
  const p = createMockProvider();
  const req = { user: "Greet Ada", model: "mock-1", temperature: 0, maxTokens: 64 };
  const a = await p.complete(req);
  const b = await p.complete(req);
  expect(a).toBe(b);
  expect(a.length).toBeGreaterThan(0);
});

test("mock.complete differs for different prompts", async () => {
  const p = createMockProvider();
  const a = await p.complete({ user: "Greet Ada", model: "mock-1", temperature: 0, maxTokens: 64 });
  const b = await p.complete({ user: "Greet Bob", model: "mock-1", temperature: 0, maxTokens: 64 });
  expect(a).not.toBe(b);
});

test("registry returns the mock provider with no env", async () => {
  const p = await getProvider("mock");
  expect(p.name).toBe("mock");
});

test("registry throws for anthropic without a key", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await expect(getProvider("anthropic")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/mock.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement provider types, mock, registry**

Create `src/providers/types.ts`:
```ts
import type { ProviderName } from "../schemas";

export interface CompletionRequest {
  system?: string;
  user: string;
  model: string;
  temperature: number;
  maxTokens: number;
  seed?: number;
}

export interface Provider {
  name: ProviderName;
  complete(req: CompletionRequest): Promise<string>;
  embed?(text: string): Promise<number[]>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
```

Create `src/providers/mock.ts`:
```ts
import { sha256 } from "../util/hash";
import type { CompletionRequest, Provider } from "./types";

const GREETINGS = [
  "Hello",
  "Hi there",
  "Good day",
  "Greetings",
  "Warm hello",
  "Well met",
];
const TAILS = [
  "lovely to meet you!",
  "wishing you a wonderful one!",
  "hope your day is bright!",
  "delighted to say hi!",
  "a pleasure as always!",
];

/** Deterministic hex → integer in [0, n). */
function pick(hex: string, offset: number, n: number): number {
  const slice = hex.slice(offset, offset + 6);
  return parseInt(slice, 16) % n;
}

export function createMockProvider(): Provider {
  return {
    name: "mock",
    async complete(req: CompletionRequest): Promise<string> {
      const hex = sha256((req.system ?? "") + " " + req.user).slice("sha256:".length);
      const g = GREETINGS[pick(hex, 0, GREETINGS.length)]!;
      const t = TAILS[pick(hex, 6, TAILS.length)]!;
      const nameMatch = req.user.match(/\b[A-Z][a-z]+\b/);
      const name = nameMatch ? nameMatch[0] : "friend";
      return `${g} ${name}, ${t}`;
    },
    async embed(text: string): Promise<number[]> {
      const hex = sha256(text).slice("sha256:".length);
      const dims = 16;
      const v: number[] = [];
      for (let i = 0; i < dims; i++) {
        v.push((parseInt(hex.slice(i * 2, i * 2 + 2), 16) - 128) / 128);
      }
      return v;
    },
  };
}
```

Create `src/providers/registry.ts`:
```ts
import type { ProviderName } from "../schemas";
import { createMockProvider } from "./mock";
import { ProviderError, type Provider } from "./types";

export async function getProvider(name: ProviderName): Promise<Provider> {
  switch (name) {
    case "mock":
      return createMockProvider();
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new ProviderError(
          "Provider 'anthropic' requires ANTHROPIC_API_KEY in the environment.",
        );
      }
      const { createAnthropicProvider } = await import("./anthropic");
      return createAnthropicProvider();
    }
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new ProviderError(
          "Provider 'openai' requires OPENAI_API_KEY in the environment.",
        );
      }
      const { createOpenAIProvider } = await import("./openai");
      return createOpenAIProvider();
    }
  }
}
```
> `./anthropic` and `./openai` are created in Task 13; the dynamic `import()` is only reached when those providers are selected, so tests that use `mock` pass now. If your bundler/typechecker complains about the missing modules before Task 13, create empty stub files `src/providers/anthropic.ts` and `src/providers/openai.ts` each exporting a throwing factory, and flesh them out in Task 13.

- [ ] **Step 3b: Add provider stubs so typecheck passes now**

Create `src/providers/anthropic.ts`:
```ts
import { ProviderError, type Provider } from "./types";
export function createAnthropicProvider(): Provider {
  throw new ProviderError("anthropic provider not implemented until Task 13");
}
```
Create `src/providers/openai.ts`:
```ts
import { ProviderError, type Provider } from "./types";
export function createOpenAIProvider(): Provider {
  throw new ProviderError("openai provider not implemented until Task 13");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/mock.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers test/mock.test.ts
git commit -m "feat(providers): Provider interface, deterministic mock, lazy registry"
```

---

### Task 7: Content-addressed cache

**Files:**
- Create: `src/cache.ts`
- Test: `test/cache.test.ts`

**Interfaces:**
- Consumes: `sha256` (Task 3); `ensureDir`, `readTextIfExists`, `writeText` (Task 3).
- Produces:
  - `cacheKey(input: { provider: string; model: string; temperature: number; maxTokens: number; system?: string; user: string; seed?: number }): string`
  - `getCached(cacheDir: string, key: string): string | undefined`
  - `putCached(cacheDir: string, key: string, value: string): void`

- [ ] **Step 1: Write the failing test**

Create `test/cache.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheKey, getCached, putCached } from "../src/cache";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cache-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("same inputs produce the same key; different inputs differ", () => {
  const base = { provider: "mock", model: "mock-1", temperature: 0, maxTokens: 64, user: "hi" };
  expect(cacheKey(base)).toBe(cacheKey({ ...base }));
  expect(cacheKey(base)).not.toBe(cacheKey({ ...base, user: "bye" }));
});

test("put then get round-trips; miss returns undefined", () => {
  const dir = tmp();
  const key = cacheKey({ provider: "mock", model: "mock-1", temperature: 0, maxTokens: 64, user: "hi" });
  expect(getCached(dir, key)).toBeUndefined();
  putCached(dir, key, "cached-output");
  expect(getCached(dir, key)).toBe("cached-output");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/cache.ts`**

```ts
import { join } from "node:path";
import { sha256 } from "./util/hash";
import { readTextIfExists, writeText } from "./util/fs";

export function cacheKey(input: {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system?: string;
  user: string;
  seed?: number;
}): string {
  const canonical = JSON.stringify({
    provider: input.provider,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    system: input.system ?? null,
    user: input.user,
    seed: input.seed ?? null,
  });
  return sha256(canonical).slice("sha256:".length);
}

export function getCached(cacheDir: string, key: string): string | undefined {
  return readTextIfExists(join(cacheDir, key + ".txt"));
}

export function putCached(cacheDir: string, key: string, value: string): void {
  writeText(join(cacheDir, key + ".txt"), value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/cache.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cache.ts test/cache.test.ts
git commit -m "feat(cache): content-addressed response cache"
```

---

### Task 8: Baseline store

**Files:**
- Create: `src/baselines.ts`
- Test: `test/baselines.test.ts`

**Interfaces:**
- Consumes: `Baseline`, `BaselineSchema`, `Config` (Task 2); `sha256` (Task 3); `readTextIfExists`, `writeText` (Task 3).
- Produces:
  - `baselinePath(config: Config, cwd: string, caseId: string): string`
  - `readBaseline(config: Config, cwd: string, caseId: string): Baseline | undefined`
  - `writeBaseline(config: Config, cwd: string, record: Baseline): void`
  - `makeBaseline(args: { caseId; provider; model; temperature; maxTokens; renderedPrompt; output; approvedBy; createdAt }): Baseline` — computes `renderedPromptHash` and `outputHash` via `sha256`. `createdAt` is passed IN (never call `Date.now()` inside a pure helper; the caller supplies the timestamp).

- [ ] **Step 1: Write the failing test**

Create `test/baselines.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../src/schemas";
import { makeBaseline, readBaseline, writeBaseline } from "../src/baselines";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-base-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("makeBaseline hashes prompt and output", () => {
  const b = makeBaseline({
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    temperature: 0,
    maxTokens: 64,
    renderedPrompt: "Greet Ada",
    output: "Hello Ada!",
    approvedBy: "cli",
    createdAt: "2026-07-20T00:00:00.000Z",
  });
  expect(b.outputHash.startsWith("sha256:")).toBe(true);
  expect(b.renderedPromptHash.startsWith("sha256:")).toBe(true);
});

test("write then read round-trips a baseline", () => {
  const root = tmp();
  const b = makeBaseline({
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    temperature: 0,
    maxTokens: 64,
    renderedPrompt: "Greet Ada",
    output: "Hello Ada!",
    approvedBy: "cli",
    createdAt: "2026-07-20T00:00:00.000Z",
  });
  expect(readBaseline(DEFAULT_CONFIG, root, "hello")).toBeUndefined();
  writeBaseline(DEFAULT_CONFIG, root, b);
  expect(readBaseline(DEFAULT_CONFIG, root, "hello")?.output).toBe("Hello Ada!");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/baselines.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/baselines.ts`**

```ts
import { join, isAbsolute } from "node:path";
import { BaselineSchema, type Baseline, type Config, type ProviderName } from "./schemas";
import { sha256 } from "./util/hash";
import { readTextIfExists, writeText } from "./util/fs";

export function baselinePath(config: Config, cwd: string, caseId: string): string {
  const dir = isAbsolute(config.baselineDir)
    ? config.baselineDir
    : join(cwd, config.baselineDir);
  return join(dir, `${caseId}.json`);
}

export function readBaseline(
  config: Config,
  cwd: string,
  caseId: string,
): Baseline | undefined {
  const raw = readTextIfExists(baselinePath(config, cwd, caseId));
  if (raw === undefined) return undefined;
  return BaselineSchema.parse(JSON.parse(raw));
}

export function writeBaseline(config: Config, cwd: string, record: Baseline): void {
  writeText(baselinePath(config, cwd, record.caseId), JSON.stringify(record, null, 2) + "\n");
}

export function makeBaseline(args: {
  caseId: string;
  provider: ProviderName;
  model: string;
  temperature: number;
  maxTokens: number;
  renderedPrompt: string;
  output: string;
  approvedBy: string;
  createdAt: string;
}): Baseline {
  return {
    schemaVersion: 1,
    caseId: args.caseId,
    provider: args.provider,
    model: args.model,
    params: { temperature: args.temperature, maxTokens: args.maxTokens },
    renderedPromptHash: sha256(args.renderedPrompt),
    output: args.output,
    outputHash: sha256(args.output),
    createdAt: args.createdAt,
    approvedBy: args.approvedBy,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/baselines.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/baselines.ts test/baselines.test.ts
git commit -m "feat(baselines): baseline record store with content hashes"
```

---

### Task 9: Comparator (the heart — verdict logic)

**Files:**
- Create: `src/comparator.ts`
- Test: `test/comparator.test.ts`

**Interfaces:**
- Consumes: `Thresholds`, `CaseResult`, `Verdict`, `ProviderName`, `Baseline` (Task 2); `tokenSetCosine` (Task 3); `diff` (jsdiff) for the unified diff.
- Produces:
  - `normalize(text: string, thresholds: Thresholds): string` — trim + collapse whitespace when `textNormalize`, strip each `ignorePatterns` regex (global).
  - `unifiedDiff(baseline: string, current: string, contextLines: number): { diff: string; added: number; removed: number }`
  - `compare(args: { caseId; provider; model; output; baseline?: Baseline; thresholds; contextLines; semanticScore?: number }): CaseResult` — implements DESIGN §8 verdict logic exactly. If `semanticScore` is provided (from real embeddings) it is used; otherwise `tokenSetCosine` on normalized text is used.

- [ ] **Step 1: Write the failing test**

Create `test/comparator.test.ts`:
```ts
import { expect, test } from "vitest";
import { compare, normalize } from "../src/comparator";
import { DEFAULT_CONFIG, type Baseline } from "../src/schemas";

const T = DEFAULT_CONFIG.thresholds;

function baseline(output: string): Baseline {
  return {
    schemaVersion: 1,
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    params: { temperature: 0, maxTokens: 64 },
    renderedPromptHash: "sha256:x",
    output,
    outputHash: "sha256:y",
    createdAt: "2026-07-20T00:00:00.000Z",
    approvedBy: "cli",
  };
}

test("no baseline yields NEW", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "anything", thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("NEW");
});

test("identical normalized output yields PASS", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello Ada!", baseline: baseline("Hello Ada!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("whitespace-only change passes via textNormalize", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello   Ada!\n", baseline: baseline("Hello Ada!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("semantically distant change yields DRIFT with a diff", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "The quarterly revenue fell by twelve percent.",
    baseline: baseline("Hello Ada, lovely to meet you!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("DRIFT");
  expect(r.textDiff).toContain("+");
  expect(r.changedLines).toBeDefined();
  expect(typeof r.semanticScore).toBe("number");
});

test("paraphrase above semanticMin passes but still records a score", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello Ada lovely to meet you",
    baseline: baseline("Hello Ada lovely to meet you!"),
    thresholds: { ...T, semanticMin: 0.5 },
    contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("provided embedding score overrides local similarity", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "totally different words here",
    baseline: baseline("Hello Ada, lovely to meet you!"),
    thresholds: T, contextLines: 3, semanticScore: 0.99,
  });
  expect(r.verdict).toBe("PASS");
});

test("normalize strips ignorePatterns (timestamps)", () => {
  const withTs = "Logged at 2026-07-20T12:00:00.000Z done";
  expect(normalize(withTs, T)).not.toContain("2026-07-20T12:00:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/comparator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/comparator.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/comparator.test.ts && npm run typecheck`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/comparator.ts test/comparator.test.ts
git commit -m "feat(comparator): normalize, unified diff, PASS/DRIFT/NEW verdict"
```

---

### Task 10: Runner (orchestrator)

**Files:**
- Create: `src/runner.ts`
- Test: `test/runner.test.ts`

**Interfaces:**
- Consumes: everything above — `Config`, `Case`, `RunReport`, `CaseResult` (Task 2); `getProvider` (Task 6); `renderPrompt` (Task 5); `cacheKey/getCached/putCached` (Task 7); `readBaseline/writeBaseline/makeBaseline` (Task 8); `compare` (Task 9).
- Produces:
  - `runCases(opts: RunOptions): Promise<RunReport>` where
    `RunOptions = { config: Config; cwd: string; cases: Case[]; filter?: string; useCache: boolean; updateOnNew: boolean; seed?: number; now: string }`
  - Behavior per case: resolve provider/model/params (case overrides beat config defaults) → render → provider call (cache-aware) → read baseline → `compare` → on `NEW` with `updateOnNew`, write baseline → collect. Provider/render errors become an `ERROR` result (never throw out of the loop). Writes `.prompt-regression/last-run.json`. Computes `exitCode` (1 if any DRIFT/ERROR else 0). `now` is injected (no `Date.now()` inside).
  - Semantic scoring: if the resolved provider has `embed`, compute cosine of the two embeddings and pass as `semanticScore`; otherwise let `compare` fall back to `tokenSetCosine`. For the `mock` provider, DO NOT use `embed` for scoring (its pseudo-embeddings are not meaningful) — pass `semanticScore` undefined so the token-set fallback drives verdicts deterministically. Rule: use `provider.embed` for scoring only when `provider.name !== "mock"`.

- [ ] **Step 1: Write the failing test**

Create `test/runner.test.ts`:
```ts
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../src/schemas";
import { loadCases } from "../src/cases";
import { runCases } from "../src/runner";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-run-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function project(): string {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Greet {{name}}\ninput:\n  name: Ada\n",
  );
  return root;
}

test("first run creates a baseline and reports NEW, exit 0", async () => {
  const root = project();
  const cases = loadCases(DEFAULT_CONFIG, root);
  const report = await runCases({
    config: DEFAULT_CONFIG, cwd: root, cases,
    useCache: true, updateOnNew: true, now: "2026-07-20T00:00:00.000Z",
  });
  expect(report.results[0]!.verdict).toBe("NEW");
  expect(report.exitCode).toBe(0);
  // baseline file exists now
  const b = readFileSync(join(root, ".prompt-regression/baselines/hello.json"), "utf8");
  expect(b).toContain("\"caseId\": \"hello\"");
});

test("second unchanged run reports PASS, exit 0", async () => {
  const root = project();
  const cases = loadCases(DEFAULT_CONFIG, root);
  const opts = { config: DEFAULT_CONFIG, cwd: root, cases, useCache: true, updateOnNew: true, now: "2026-07-20T00:00:00.000Z" };
  await runCases(opts);
  const second = await runCases(opts);
  expect(second.results[0]!.verdict).toBe("PASS");
  expect(second.exitCode).toBe(0);
});

test("editing the prompt drives DRIFT, exit 1", async () => {
  const root = project();
  await runCases({ config: DEFAULT_CONFIG, cwd: root, cases: loadCases(DEFAULT_CONFIG, root), useCache: true, updateOnNew: true, now: "t" });
  // mutate the prompt so the mock output changes
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Warmly greet {{name}} and wish them a good day\ninput:\n  name: Ada\n",
  );
  const report = await runCases({ config: DEFAULT_CONFIG, cwd: root, cases: loadCases(DEFAULT_CONFIG, root), useCache: false, updateOnNew: true, now: "t" });
  expect(report.results[0]!.verdict).toBe("DRIFT");
  expect(report.exitCode).toBe(1);
});

test("a filter selects a subset", async () => {
  const root = project();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(join(root, "cases", "bye.case.yaml"), "id: bye\nprompt: Farewell");
  const cases = loadCases(DEFAULT_CONFIG, root);
  const report = await runCases({ config: DEFAULT_CONFIG, cwd: root, cases, filter: "hello", useCache: true, updateOnNew: true, now: "t" });
  expect(report.results).toHaveLength(1);
  expect(report.results[0]!.caseId).toBe("hello");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/runner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/runner.ts`**

```ts
import { join } from "node:path";
import type { Case, Config, CaseResult, ProviderName, RunReport, Thresholds } from "./schemas";
import { getProvider } from "./providers/registry";
import type { Provider } from "./providers/types";
import { renderPrompt } from "./prompt";
import { cacheKey, getCached, putCached } from "./cache";
import { makeBaseline, readBaseline, writeBaseline } from "./baselines";
import { compare } from "./comparator";
import { tokenSetCosine } from "./util/similarity";
import { writeText } from "./util/fs";

export interface RunOptions {
  config: Config;
  cwd: string;
  cases: Case[];
  filter?: string;
  useCache: boolean;
  updateOnNew: boolean;
  seed?: number;
  now: string;
}

function resolveThresholds(config: Config, c: Case): Thresholds {
  return { ...config.thresholds, ...(c.thresholds ?? {}) } as Thresholds;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    ma += a[i]! * a[i]!;
    mb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d === 0 ? 0 : dot / d;
}

export async function runCases(opts: RunOptions): Promise<RunReport> {
  const { config, cwd, cases, filter, useCache, updateOnNew, seed, now } = opts;
  const selected = filter
    ? cases.filter((c) => c.id.includes(filter) || (c.name ?? "").includes(filter))
    : cases;

  const cacheDir = join(cwd, ".prompt-regression/cache");
  const results: CaseResult[] = [];
  const providerCache = new Map<ProviderName, Provider>();
  const startedAt = now;
  const topProvider = config.defaults.provider;
  const topModel = config.defaults.model;

  for (const c of selected) {
    const providerName = c.provider ?? config.defaults.provider;
    const model = c.model ?? config.defaults.model;
    const temperature = c.temperature ?? config.defaults.temperature;
    const maxTokens = c.maxTokens ?? config.defaults.maxTokens;

    try {
      const { system, user } = renderPrompt(c);

      let provider = providerCache.get(providerName);
      if (!provider) {
        provider = await getProvider(providerName);
        providerCache.set(providerName, provider);
      }

      const key = cacheKey({ provider: providerName, model, temperature, maxTokens, system, user, seed });
      let output = useCache ? getCached(cacheDir, key) : undefined;
      if (output === undefined) {
        output = await provider.complete({ system, user, model, temperature, maxTokens, seed });
        putCached(cacheDir, key, output);
      }

      const baseline = readBaseline(config, cwd, c.id);
      const thresholds = resolveThresholds(config, c);

      let semanticScore: number | undefined;
      if (baseline && provider.name !== "mock" && provider.embed) {
        const [eb, ec] = await Promise.all([provider.embed(baseline.output), provider.embed(output)]);
        semanticScore = cosine(eb, ec);
      }

      const result = compare({
        caseId: c.id, provider: providerName, model, output, baseline,
        thresholds, contextLines: config.report.contextLines, semanticScore,
      });

      if (result.verdict === "NEW" && updateOnNew) {
        writeBaseline(config, cwd, makeBaseline({
          caseId: c.id, provider: providerName, model, temperature, maxTokens,
          renderedPrompt: (system ?? "") + "\n" + user, output, approvedBy: "cli", createdAt: now,
        }));
      }

      results.push(result);
    } catch (e) {
      results.push({
        caseId: c.id, verdict: "ERROR", provider: providerName, model,
        output: "", error: (e as Error).message,
      });
    }
  }

  const totals = {
    total: results.length,
    pass: results.filter((r) => r.verdict === "PASS").length,
    drift: results.filter((r) => r.verdict === "DRIFT").length,
    neu: results.filter((r) => r.verdict === "NEW").length,
    error: results.filter((r) => r.verdict === "ERROR").length,
  };
  const exitCode: 0 | 1 = totals.drift + totals.error > 0 ? 1 : 0;

  const report: RunReport = {
    schemaVersion: 1, startedAt, finishedAt: now,
    provider: topProvider, model: topModel, totals, results, exitCode,
  };

  writeText(join(cwd, ".prompt-regression/last-run.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

export { tokenSetCosine };
```
> `export { tokenSetCosine }` is only to avoid an unused-import lint if you don't otherwise reference it — if your lint is fine, drop both the import and this re-export.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/runner.test.ts && npm run typecheck`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/runner.ts test/runner.test.ts
git commit -m "feat(runner): orchestrate render→provider(cache)→compare→report"
```

---

### Task 11: Reporter (terminal + JSON)

**Files:**
- Create: `src/reporter.ts`
- Test: `test/reporter.test.ts`

**Interfaces:**
- Consumes: `RunReport`, `CaseResult` (Task 2); `picocolors`.
- Produces:
  - `renderReport(report: RunReport, opts: { color: boolean; showDiff: boolean }): string` — the colored terminal report (header line, per-case verdict lines, per-case diff on DRIFT, summary line, `Exit: N`).
  - `formatSummaryLine(report: RunReport): string` — `Summary: N total · P pass · D drift · U new · E error`.

- [ ] **Step 1: Write the failing test**

Create `test/reporter.test.ts`:
```ts
import { expect, test } from "vitest";
import { renderReport, formatSummaryLine } from "../src/reporter";
import type { RunReport } from "../src/schemas";

function report(partial: Partial<RunReport> = {}): RunReport {
  return {
    schemaVersion: 1,
    startedAt: "t", finishedAt: "t",
    provider: "mock", model: "mock-1",
    totals: { total: 1, pass: 0, drift: 1, neu: 0, error: 0 },
    results: [
      {
        caseId: "hello", verdict: "DRIFT", provider: "mock", model: "mock-1",
        output: "new", baselineOutput: "old", semanticScore: 0.71,
        textDiff: "--- baseline\n+++ current\n@@ -1 +1 @@\n-old\n+new\n",
        changedLines: { added: 1, removed: 1 },
      },
    ],
    exitCode: 1,
    ...partial,
  };
}

test("summary line reflects totals", () => {
  expect(formatSummaryLine(report())).toBe("Summary: 1 total · 0 pass · 1 drift · 0 new · 0 error");
});

test("plain render (no color) shows verdict, score, diff, and exit", () => {
  const out = renderReport(report(), { color: false, showDiff: true });
  expect(out).toContain("DRIFT");
  expect(out).toContain("hello");
  expect(out).toContain("semantic=0.71");
  expect(out).toContain("+new");
  expect(out).toContain("Exit: 1");
});

test("showDiff=false omits the diff body", () => {
  const out = renderReport(report(), { color: false, showDiff: false });
  expect(out).not.toContain("+new");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/reporter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/reporter.ts`**

```ts
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

function indentDiff(diff: string): string {
  return diff
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => "    " + l)
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
    if (r.verdict === "NEW") head += "   (baseline created)";
    if (r.verdict === "ERROR") head += `   ${r.error ?? ""}`;
    if (r.semanticScore !== undefined && (r.verdict === "DRIFT" || r.verdict === "PASS")) {
      head += `   semantic=${r.semanticScore.toFixed(2)}`;
    }
    if (r.changedLines) head += `  +${r.changedLines.added} / -${r.changedLines.removed}`;
    lines.push(head);
    if (opts.showDiff && r.verdict === "DRIFT" && r.textDiff) {
      lines.push("");
      lines.push(indentDiff(r.textDiff));
      lines.push("");
    }
  }

  lines.push("");
  lines.push(formatSummaryLine(report));
  lines.push(`Exit: ${report.exitCode}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/reporter.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reporter.ts test/reporter.test.ts
git commit -m "feat(reporter): colored terminal report + summary line"
```

---

### Task 12: Command handlers + CLI wiring + init templates

**Files:**
- Create: `src/commands/init.ts`, `src/commands/run.ts`, `src/commands/approve.ts`, `src/commands/list.ts`
- Create: `src/templates.ts` (config + sample-case template strings)
- Modify: `src/cli.ts` (replace the stub)
- Create: `cases/hello.case.yaml` (shipped sample, used by the e2e test in Task 14)
- Test: `test/commands.test.ts`

**Interfaces:**
- Consumes: `loadConfig` (Task 4), `loadCases` (Task 5), `runCases` (Task 10), `renderReport` (Task 11), `readBaseline`/`writeBaseline`/`makeBaseline` (Task 8), `RunReport` (Task 2).
- Produces (each handler returns a process exit code number; the CLI sets `process.exitCode`):
  - `cmdInit(opts: { cwd; provider; force; configPath }): number`
  - `cmdRun(opts: { cwd; configPath; casesGlob?; provider?; model?; filter?; ci: boolean; json?: string | true; updateOnNew: boolean; useCache: boolean; seed?: number; color: boolean; now: string }): Promise<number>`
  - `cmdApprove(opts: { cwd; configPath; filter?; all: boolean; yes: boolean; now: string }): Promise<number>`
  - `cmdList(opts: { cwd; configPath; json: boolean }): number`

- [ ] **Step 1: Write the failing test**

Create `test/commands.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdInit } from "../src/commands/init";
import { cmdRun } from "../src/commands/run";
import { cmdApprove } from "../src/commands/approve";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cmd-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("init scaffolds config + sample case", () => {
  const root = tmp();
  const code = cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  expect(code).toBe(0);
  expect(existsSync(join(root, "prompt-regression.config.yaml"))).toBe(true);
  expect(existsSync(join(root, "cases", "hello.case.yaml"))).toBe(true);
});

test("run after init: NEW (exit 0), then PASS (exit 0)", async () => {
  const root = tmp();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const first = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  const second = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  log.mockRestore();
  expect(first).toBe(0);
  expect(second).toBe(0);
});

test("approve --all promotes the last run's output", async () => {
  const root = tmp();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  // create baseline via first run, then mutate prompt to force drift
  await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  writeFileSync(join(root, "cases", "hello.case.yaml"), "id: hello\nprompt: Totally different wording now\n");
  const drift = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: false, color: false, now: "t" });
  expect(drift).toBe(1);
  const approved = await cmdApprove({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), all: true, yes: true, now: "t" });
  expect(approved).toBe(0);
  const green = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: true, updateOnNew: true, useCache: false, color: false, now: "t" });
  expect(green).toBe(0);
  log.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement templates + handlers + CLI**

Create `src/templates.ts`:
```ts
export const CONFIG_TEMPLATE = `# prompt-regression config
version: 1
casesGlob: "cases/**/*.{yaml,yml,json}"
baselineDir: ".prompt-regression/baselines"
defaults:
  provider: mock          # mock | anthropic | openai
  model: mock-1
  temperature: 0
  maxTokens: 1024
thresholds:
  semanticMin: 0.92
  textNormalize: true
  ignorePatterns:
    - "\\\\b\\\\d{4}-\\\\d{2}-\\\\d{2}T[0-9:.Z+-]+\\\\b"
report:
  showDiff: true
  contextLines: 3
`;

export const SAMPLE_CASE_TEMPLATE = `id: hello
name: "Friendly greeting"
system: "You are a concise assistant."
prompt: "Greet {{name}} in one short sentence."
input:
  name: "Ada"
`;

export const GITIGNORE_SNIPPET = `.prompt-regression/cache/
.prompt-regression/last-run.json
`;
```

Create `src/commands/init.ts`:
```ts
import { join } from "node:path";
import { existsSync } from "node:fs";
import { writeText, ensureDir } from "../util/fs";
import { CONFIG_TEMPLATE, SAMPLE_CASE_TEMPLATE } from "../templates";
import type { ProviderName } from "../schemas";

export function cmdInit(opts: {
  cwd: string;
  provider: ProviderName;
  force: boolean;
  configPath: string;
}): number {
  const casePath = join(opts.cwd, "cases", "hello.case.yaml");
  if (!opts.force && (existsSync(opts.configPath) || existsSync(casePath))) {
    console.error("prompt-regression: files already exist; pass --force to overwrite.");
    return 2;
  }
  writeText(opts.configPath, CONFIG_TEMPLATE.replace("provider: mock", `provider: ${opts.provider}`));
  writeText(casePath, SAMPLE_CASE_TEMPLATE);
  ensureDir(join(opts.cwd, ".prompt-regression", "baselines"));
  writeText(join(opts.cwd, ".prompt-regression", ".gitkeep"), "");
  console.log("prompt-regression: initialized config + cases/hello.case.yaml");
  return 0;
}
```

Create `src/commands/run.ts`:
```ts
import { writeText } from "../util/fs";
import { loadConfig } from "../config";
import { loadCases } from "../cases";
import { runCases } from "../runner";
import { renderReport } from "../reporter";

export async function cmdRun(opts: {
  cwd: string;
  configPath: string;
  casesGlob?: string;
  provider?: "mock" | "anthropic" | "openai";
  model?: string;
  filter?: string;
  ci: boolean;
  json?: string | true;
  updateOnNew: boolean;
  useCache: boolean;
  seed?: number;
  color: boolean;
  now: string;
}): Promise<number> {
  const config = loadConfig({
    configPath: opts.configPath,
    overrides: { casesGlob: opts.casesGlob, provider: opts.provider, model: opts.model },
  });
  const cases = loadCases(config, opts.cwd);
  const report = await runCases({
    config, cwd: opts.cwd, cases, filter: opts.filter,
    useCache: opts.useCache, updateOnNew: opts.updateOnNew, seed: opts.seed, now: opts.now,
  });

  if (opts.json !== undefined) {
    const json = JSON.stringify(report, null, 2);
    if (typeof opts.json === "string") writeText(opts.json, json + "\n");
    else console.log(json);
  } else {
    console.log(renderReport(report, { color: opts.color, showDiff: config.report.showDiff && !opts.ci }));
  }
  return report.exitCode;
}
```

Create `src/commands/approve.ts`:
```ts
import { join } from "node:path";
import { RunReportSchema, type Config } from "../schemas";
import { readTextIfExists } from "../util/fs";
import { loadConfig } from "../config";
import { makeBaseline, writeBaseline } from "../baselines";

export async function cmdApprove(opts: {
  cwd: string;
  configPath: string;
  filter?: string;
  all: boolean;
  yes: boolean;
  now: string;
}): Promise<number> {
  const config: Config = loadConfig({ configPath: opts.configPath });
  const raw = readTextIfExists(join(opts.cwd, ".prompt-regression/last-run.json"));
  if (!raw) {
    console.error("prompt-regression: no last run found; run `prompt-regression run` first.");
    return 2;
  }
  const report = RunReportSchema.parse(JSON.parse(raw));
  let targets = report.results.filter((r) => r.verdict === "DRIFT" || r.verdict === "NEW");
  if (opts.filter) targets = targets.filter((r) => r.caseId.includes(opts.filter!));

  if (targets.length === 0) {
    console.log("prompt-regression: nothing to approve.");
    return 0;
  }
  for (const r of targets) {
    writeBaseline(config, opts.cwd, makeBaseline({
      caseId: r.caseId, provider: r.provider, model: r.model,
      temperature: config.defaults.temperature, maxTokens: config.defaults.maxTokens,
      renderedPrompt: "", output: r.output, approvedBy: "cli", createdAt: opts.now,
    }));
  }
  console.log(`approved ${targets.length} case${targets.length === 1 ? "" : "s"} → baseline updated`);
  return 0;
}
```
> `renderedPrompt` is left empty on approve because `last-run.json` does not store the rendered prompt; the hash is informational and not used for verdicts. (If you want it populated, extend `CaseResult` to carry `renderedPromptHash` — out of scope for v1.)

Create `src/commands/list.ts`:
```ts
import { loadConfig } from "../config";
import { loadCases } from "../cases";
import { readBaseline } from "../baselines";

export function cmdList(opts: { cwd: string; configPath: string; json: boolean }): number {
  const config = loadConfig({ configPath: opts.configPath });
  const cases = loadCases(config, opts.cwd);
  const rows = cases.map((c) => ({
    id: c.id,
    name: c.name ?? "",
    provider: c.provider ?? config.defaults.provider,
    model: c.model ?? config.defaults.model,
    status: readBaseline(config, opts.cwd, c.id) ? "baselined" : "no-baseline",
  }));
  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    for (const r of rows) {
      console.log(`${r.id.padEnd(20)} ${r.provider}/${r.model}  ${r.status}${r.name ? "  " + r.name : ""}`);
    }
  }
  return 0;
}
```

Replace `src/cli.ts`:
```ts
#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init";
import { cmdRun } from "./commands/run";
import { cmdApprove } from "./commands/approve";
import { cmdList } from "./commands/list";
import type { ProviderName } from "./schemas";

function nowIso(): string {
  return new Date().toISOString();
}

const program = new Command();
program
  .name("prompt-regression")
  .description("Snapshot testing for LLM prompts — catch regressions before you ship.")
  .version("0.1.0")
  .option("--config <path>", "path to config file", "prompt-regression.config.yaml")
  .option("--cases <glob>", "override case glob")
  .option("--no-color", "disable ANSI colors");

program
  .command("init")
  .option("--provider <name>", "mock | anthropic | openai", "mock")
  .option("--force", "overwrite existing files", false)
  .action((sub) => {
    const g = program.opts();
    process.exitCode = cmdInit({
      cwd: process.cwd(),
      provider: sub.provider as ProviderName,
      force: !!sub.force,
      configPath: g.config,
    });
  });

program
  .command("run")
  .option("--filter <substr>")
  .option("--provider <name>")
  .option("--model <id>")
  .option("--ci", "non-zero exit on drift/error; compact output", false)
  .option("--json [path]", "emit RunReport JSON to stdout or a file")
  .option("--no-cache", "force fresh provider calls")
  .option("--seed <n>", "provider seed passthrough", (v) => parseInt(v, 10))
  .option("--update-on-new <bool>", "auto-write baselines for NEW cases", "true")
  .action(async (sub) => {
    const g = program.opts();
    process.exitCode = await cmdRun({
      cwd: process.cwd(),
      configPath: g.config,
      casesGlob: g.cases,
      provider: sub.provider as ProviderName | undefined,
      model: sub.model,
      filter: sub.filter,
      ci: !!sub.ci,
      json: sub.json === true ? true : (sub.json as string | undefined),
      updateOnNew: sub.updateOnNew !== "false",
      useCache: sub.cache !== false, // commander sets .cache=false for --no-cache
      seed: sub.seed,
      color: g.color !== false,
      now: nowIso(),
    });
  });

program
  .command("approve")
  .option("--filter <substr>")
  .option("--all", "approve every drifted/new case", false)
  .option("--yes", "skip confirmation", false)
  .action(async (sub) => {
    const g = program.opts();
    process.exitCode = await cmdApprove({
      cwd: process.cwd(),
      configPath: g.config,
      filter: sub.filter,
      all: !!sub.all,
      yes: !!sub.yes,
      now: nowIso(),
    });
  });

program
  .command("list")
  .option("--json", "output JSON", false)
  .action((sub) => {
    const g = program.opts();
    process.exitCode = cmdList({ cwd: process.cwd(), configPath: g.config, json: !!sub.json });
  });

program.parseAsync(process.argv).then(() => {
  if (process.argv.slice(2).length === 0) program.help();
});
```
> `nowIso()` calling `new Date()` lives ONLY in `cli.ts` (the impure edge). Every module below the CLI receives `now` as a parameter, keeping them deterministic and testable. Do not call `new Date()` anywhere else.

Create the shipped sample `cases/hello.case.yaml` (identical to the template, for the demo/e2e):
```yaml
id: hello
name: "Friendly greeting"
system: "You are a concise assistant."
prompt: "Greet {{name}} in one short sentence."
input:
  name: "Ada"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/commands.test.ts && npm run typecheck && npm run build`
Expected: PASS; `dist/cli.js` builds.

- [ ] **Step 5: Manual smoke of the built binary**

Run:
```bash
cd /home/keith/projects/portfolio/prompt-regression
rm -rf /tmp/pr-demo && mkdir -p /tmp/pr-demo && cd /tmp/pr-demo
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js init
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run   # NEW, exit 0
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run   # PASS, exit 0
echo "exit=$?"
```
Expected: first run shows `NEW`, second shows `PASS`, `exit=0`. Then `cd` back to the repo.

- [ ] **Step 6: Commit**

```bash
cd /home/keith/projects/portfolio/prompt-regression
git add src/commands src/templates.ts src/cli.ts cases/hello.case.yaml test/commands.test.ts
git commit -m "feat(cli): init/run/approve/list handlers + commander wiring"
```

---

### Task 13: Real providers (anthropic, openai) — lazy SDKs

**Files:**
- Modify: `src/providers/anthropic.ts`, `src/providers/openai.ts` (replace the Task 6 stubs)
- Test: `test/providers.real.test.ts` (SDKs mocked — no network)

**Interfaces:**
- Consumes: `Provider`, `CompletionRequest`, `ProviderError` (Task 6).
- Produces: `createAnthropicProvider(): Provider`, `createOpenAIProvider(): Provider`. Each `complete()` lazy-imports its SDK, maps `CompletionRequest` → SDK call, returns the text; a single bounded retry on a transient error. `embed()` implemented for openai (embeddings endpoint); anthropic `embed` omitted (falls back to token-set cosine).

- [ ] **Step 1: Write the failing test (SDK mocked)**

Create `test/providers.real.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.resetModules());

test("anthropic provider maps a completion via the mocked SDK", async () => {
  vi.doMock("@anthropic-ai/sdk", () => {
    return {
      default: class {
        messages = {
          create: async () => ({ content: [{ type: "text", text: "Hi from Claude" }] }),
        };
      },
    };
  });
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { createAnthropicProvider } = await import("../src/providers/anthropic");
  const p = createAnthropicProvider();
  const out = await p.complete({ user: "hi", model: "claude-haiku-4-5", temperature: 0, maxTokens: 64 });
  expect(out).toBe("Hi from Claude");
});

test("openai provider maps a completion via the mocked SDK", async () => {
  vi.doMock("openai", () => {
    return {
      default: class {
        chat = {
          completions: {
            create: async () => ({ choices: [{ message: { content: "Hi from GPT" } }] }),
          },
        };
      },
    };
  });
  process.env.OPENAI_API_KEY = "test-key";
  const { createOpenAIProvider } = await import("../src/providers/openai");
  const p = createOpenAIProvider();
  const out = await p.complete({ user: "hi", model: "gpt-4o-mini", temperature: 0, maxTokens: 64 });
  expect(out).toBe("Hi from GPT");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/providers.real.test.ts`
Expected: FAIL (stubs still throw).

- [ ] **Step 3: Implement the real providers**

Replace `src/providers/anthropic.ts`:
```ts
import { ProviderError, type CompletionRequest, type Provider } from "./types";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // single bounded retry on any error
    return await fn().catch(() => {
      throw new ProviderError(`anthropic request failed: ${(e as Error).message}`);
    });
  }
}

export function createAnthropicProvider(): Provider {
  return {
    name: "anthropic",
    async complete(req: CompletionRequest): Promise<string> {
      const mod = await import("@anthropic-ai/sdk");
      const Anthropic = mod.default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await withRetry(() =>
        client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        }),
      );
      const block = (res.content ?? []).find((b: { type: string }) => b.type === "text") as
        | { type: "text"; text: string }
        | undefined;
      if (!block) throw new ProviderError("anthropic returned no text content");
      return block.text;
    },
  };
}
```

Replace `src/providers/openai.ts`:
```ts
import { ProviderError, type CompletionRequest, type Provider } from "./types";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    return await fn().catch(() => {
      throw new ProviderError(`openai request failed: ${(e as Error).message}`);
    });
  }
}

export function createOpenAIProvider(): Provider {
  return {
    name: "openai",
    async complete(req: CompletionRequest): Promise<string> {
      const mod = await import("openai");
      const OpenAI = mod.default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const messages = [
        ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
        { role: "user" as const, content: req.user },
      ];
      const res = await withRetry(() =>
        client.chat.completions.create({
          model: req.model,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
          messages,
        }),
      );
      const content = res.choices?.[0]?.message?.content;
      if (!content) throw new ProviderError("openai returned no content");
      return content;
    },
    async embed(text: string): Promise<number[]> {
      const mod = await import("openai");
      const OpenAI = mod.default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return res.data[0]!.embedding as number[];
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/providers.real.test.ts && npm run typecheck`
Expected: PASS. Then run the FULL suite: `npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/providers/anthropic.ts src/providers/openai.ts test/providers.real.test.ts
git commit -m "feat(providers): lazy anthropic + openai SDK wrappers with retry"
```

---

### Task 14: End-to-end lifecycle test + `.gitignore` for generated dirs

**Files:**
- Create: `test/e2e.mock.test.ts`
- Modify: `.gitignore` (ignore cache + last-run; keep baselines tracked)

**Interfaces:**
- Consumes: the compiled behavior of all handlers via `cmd*` functions.

- [ ] **Step 1: Write the failing e2e test**

Create `test/e2e.mock.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdInit } from "../src/commands/init";
import { cmdRun } from "../src/commands/run";
import { cmdApprove } from "../src/commands/approve";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-e2e-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("full lifecycle: init → NEW → PASS → edit → DRIFT(1) → approve → PASS(0)", async () => {
  const root = tmp();
  const cfg = join(root, "prompt-regression.config.yaml");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  expect(cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfg })).toBe(0);

  const base = { cwd: root, configPath: cfg, ci: false, updateOnNew: true, color: false, now: "t" };
  expect(await cmdRun({ ...base, useCache: true })).toBe(0); // NEW
  expect(await cmdRun({ ...base, useCache: true })).toBe(0); // PASS

  writeFileSync(join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Warmly greet {{name}} and wish them a splendid day\ninput:\n  name: Ada\n");

  expect(await cmdRun({ ...base, useCache: false })).toBe(1); // DRIFT
  expect(await cmdApprove({ cwd: root, configPath: cfg, all: true, yes: true, now: "t" })).toBe(0);
  expect(await cmdRun({ cwd: root, configPath: cfg, ci: true, updateOnNew: true, useCache: false, color: false, now: "t" })).toBe(0); // PASS

  log.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run test/e2e.mock.test.ts`
Expected: PASS (all handlers exist). If it fails, fix the offending handler before continuing — this test IS the exit-code contract from DESIGN §12.

- [ ] **Step 3: Ensure `.gitignore` tracks baselines but ignores cache/last-run**

Append to `.gitignore` (create if missing) — do not duplicate existing lines:
```
node_modules/
dist/
.prompt-regression/cache/
.prompt-regression/last-run.json
```
> Baselines (`.prompt-regression/baselines/`) are intentionally NOT ignored — they are committed so drift shows up in code review.

- [ ] **Step 4: Full suite green**

Run: `npm run typecheck && npm run build && npm test`
Expected: all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add test/e2e.mock.test.ts .gitignore
git commit -m "test(e2e): full mock lifecycle asserts the exit-code contract"
```

---

### Task 15: Docs polish, model-id modernization, publish

**Files:**
- Modify: `README.md` (model id examples; verify quickstart verbatim), `DESIGN.md` (model id examples)
- Create: `.github/workflows/ci.yml` (build + test on push)

**Interfaces:** none (docs + CI).

- [ ] **Step 1: Modernize model-id examples**

In `README.md` and `DESIGN.md`, replace the Anthropic example model `claude-3-5-haiku-latest` with a current model id `claude-haiku-4-5`. Leave the OpenAI example as `gpt-4o-mini` (still a valid, cheap default). Verify:
```bash
grep -rn "claude-3-5-haiku-latest" . --include="*.md"
```
Expected: no output.

- [ ] **Step 2: Verify the README quickstart works verbatim from a clean dir**

Run:
```bash
npm run build
rm -rf /tmp/pr-readme && mkdir -p /tmp/pr-readme && cd /tmp/pr-readme
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js init
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run    # NEW
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run    # PASS
# edit the prompt to force a drift:
node -e "const fs=require('fs');const p='cases/hello.case.yaml';fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace('in one short sentence','warmly and wish them a good day'))"
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run    # DRIFT, exit 1
echo "drift-exit=$?"
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js approve --all --yes
node /home/keith/projects/portfolio/prompt-regression/dist/cli.js run --ci  # PASS, exit 0
echo "final-exit=$?"
cd /home/keith/projects/portfolio/prompt-regression
```
Expected: `drift-exit=1`, `final-exit=0`, and the DRIFT run prints a colored unified diff. This is the sequence to screen-capture for the README GIF (the `docs/screenshot.png` placeholder).

- [ ] **Step 3: Add CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```
> Uses `npm ci`, so ensure `package-lock.json` is committed (it was created in Task 1's `npm install`).

- [ ] **Step 4: Commit docs + CI**

```bash
git add README.md DESIGN.md .github/workflows/ci.yml package-lock.json
git commit -m "docs+ci: modern model ids, verified quickstart, GitHub Actions"
```

- [ ] **Step 5: Create the GitHub repo and push (keithalindsay)**

> `gh` is currently authenticated as the `Aigeninc` account. Publishing under `keithalindsay` requires that account be available to `gh`. Confirm the active account first; if it is not `keithalindsay`, STOP and ask the user how they want to authenticate (e.g. `gh auth switch` or `gh auth login`) rather than pushing to the wrong owner.

Run:
```bash
gh auth status
# Only if the intended owner keithalindsay is available:
gh repo create keithalindsay/prompt-regression --public --source=. --remote=origin \
  --description "Snapshot testing for LLM prompts — catch prompt & model regressions before you ship." --push
```
Expected: repo created and `main` pushed. If auth is wrong, do not force it — surface it to the user.

- [ ] **Step 6: Final verification**

Run:
```bash
git -C /home/keith/projects/portfolio/prompt-regression status
gh repo view keithalindsay/prompt-regression --json name,visibility,url 2>/dev/null || echo "not pushed yet — awaiting auth decision"
```
Expected: clean tree; repo visible (or a clear note that push awaits the auth decision).

---

## Self-Review Notes

- **Spec coverage:** every DESIGN §11 build step maps to a task — bootstrap (T1), schemas (T2), utils (T3), config (T4), cases+prompt (T5), providers+mock+registry (T6), cache (T7), baselines (T8), comparator (T9), runner (T10), reporter (T11), commands+CLI+init templates+sample case (T12), real providers (T13), e2e mock lifecycle (T14), docs polish (T15). CLI surface (§7), data models (§8), verdict logic (§8), and testing approach (§12) are all exercised by tests.
- **Determinism:** the only `new Date()` call is in `cli.ts`; all lower modules receive `now`/`createdAt` as parameters (satisfies "no Date.now in pure helpers" and keeps tests flake-free with the mock provider).
- **Identity:** Aigeninc → keithalindsay handled in T1 with a grep gate, and the publish step (T15) guards against pushing under the wrong `gh` account.
- **Known simplification:** `approve` stores an empty `renderedPrompt` because `last-run.json` doesn't persist it; the resulting `renderedPromptHash` is informational only and unused by verdict logic (documented inline in T12).
- **Glob scope:** `findCaseFiles` supports only the project's own glob shapes (`[dir/]**/*.{exts}`); documented in T3. Sufficient for v1; a full glob library is deliberately avoided (dependency-light).
