# prompt-regression — Design Document

> Build-ready design package. An expert coding agent should be able to implement the v1 MVP
> from this document with **no further questions**. Read this top to bottom before writing code.
>
> Author: Keith Lindsay (GitHub: [Aigeninc](https://github.com/Aigeninc)) · License: MIT © 2026 Keith Lindsay

---

## 1. What it is (one-liner) + the problem it solves

**prompt-regression** is a CLI that does *snapshot testing for LLM prompts*: it runs a set of
prompt "cases" against a model, stores the outputs as **baselines**, and on every subsequent run
**diffs new outputs against the approved baseline** — surfacing textual and semantic drift — with a
CI-friendly exit code and an `approve` workflow to bless a new baseline.

**The problem.** When you change a prompt, swap a model, bump a model version, or tweak a
temperature, you have almost no way to know what *else* changed. Outputs shift silently: a format
regresses, a refusal appears, a tone drifts, a JSON field disappears. Teams either eyeball a few
examples by hand or ship blind. `prompt-regression` gives prompts the same safety net that
`jest --ci` / snapshot tests give UI components: **freeze a known-good output, then fail loudly when
it drifts** — until a human approves the new baseline.

---

## 2. Who it's for and why it's useful

- **AI feature engineers** shipping prompt-backed features who need a regression gate before merge.
- **Prompt / eval engineers** iterating on system prompts who want a diff, not a vibe.
- **Platform / DevEx teams** wiring an AI feature into CI who need a deterministic pass/fail signal.

Why it's useful:

- **Catch regressions before shipping.** One command in CI (`prompt-regression run --ci`) fails the
  build when outputs drift beyond thresholds.
- **See *what* changed, not just *that* it changed.** Character/line textual diff **plus** a semantic
  similarity score (embeddings, with a cheap local fallback) so reordering or paraphrase is
  distinguished from a real content change.
- **Human-in-the-loop by design.** Nothing auto-updates; a maintainer runs `approve` to move new
  output into the baseline, and baselines are committed to git for review in PRs.
- **Provider-agnostic and offline-testable.** A `mock` provider makes the whole tool runnable and
  demoable in seconds with zero API keys.

---

## 3. Scope: v1 MVP vs out-of-scope

### v1 MVP (must-have)

1. **Case files** in a `cases/` directory (YAML/JSON) describing a prompt, inputs/variables, and the
   model config to use.
2. **Providers**: `mock` (deterministic, no network — default for tests/demo), `anthropic`, and
   `openai`. Selected by config; keys via env.
3. **`run`**: execute all (or filtered) cases, compare against baselines, print a report, set exit
   code. Auto-creates baselines on first run for cases that have none (reported as `NEW`).
4. **Diffing**: textual (unified line diff) + semantic similarity score; a per-case verdict of
   `PASS | DRIFT | NEW | ERROR` decided by configurable thresholds.
5. **Baselines**: stored on disk under `.prompt-regression/baselines/`, one file per case, committed
   to the repo. Includes output text, provider/model metadata, a content hash, and timestamp.
6. **`approve`**: promote the latest run's outputs (all, or a filtered subset) to baseline.
7. **`init`**: scaffold config + a sample case so a new user is running in under a minute.
8. **`list`**: show cases and their baseline status.
9. **Config file** (`prompt-regression.config.yaml`) with defaults + thresholds.
10. **CI mode** (`--ci`): non-zero exit on any `DRIFT`/`ERROR`, machine-readable JSON report option.
11. **Deterministic runs**: temperature defaults to 0; a `--seed` passthrough where the provider
    supports it; response caching so re-runs are cheap.

### Explicitly OUT of scope for v1

- Web UI / dashboard (CLI + terminal report + JSON only).
- Multi-turn / agentic / tool-use conversations (single request → single response only).
- Prompt *authoring* / templating beyond simple `{{variable}}` substitution.
- Statistical eval over many samples per case (v1 does **one** sampled output per case).
- Auto-approve / auto-heal baselines, or PR-comment bots.
- Cost tracking / budgets, rate-limit orchestration, retries beyond a single bounded retry.
- Provider fine-tuning, streaming output, image/audio modalities.
- A hosted service, telemetry, or any network call other than the chosen model provider.

---

## 4. Tech stack + rationale

| Concern | Choice | Rationale |
|---|---|---|
| Language/runtime | **TypeScript on Node.js ≥ 20** | Mainstream for CLIs; great DX; ships as a single `npx`-able bin; strong typing for the config/data models below. |
| CLI framework | **commander** | Tiny, ubiquitous, zero-drama subcommand parsing. |
| Config/case parsing | **yaml** + built-in JSON | Human-friendly case authoring; JSON also accepted. |
| Schema validation | **zod** | Validate config, cases, and baselines with actionable errors; infer TS types from schemas (single source of truth). |
| Textual diff | **diff** (jsdiff) | Battle-tested unified/line diffs. |
| Terminal styling | **picocolors** | 2 KB color, no dependencies. |
| Providers | **@anthropic-ai/sdk**, **openai** | Official SDKs. Loaded lazily so neither is required unless used. |
| Semantic similarity | Embeddings via the active provider when available; **local fallback** = token-set cosine (bag-of-words) computed in-process, no deps | Keeps the tool runnable offline and dependency-light; upgrades to real embeddings automatically when a key is present. |
| Tests | **vitest** | Fast, TS-native, zero config. |
| Build | **tsup** | One command → ESM + `.d.ts` + shebang bin. |
| Lint/format | **eslint** + **prettier** (config only, optional to run) | Standard hygiene. |

> **Provider default is `mock`.** The tool is fully exercisable — including `run`, `approve`, diffs,
> and CI exit codes — with **no API keys**, which is what makes the demo and the test suite reliable.

---

## 5. Architecture overview

```
          ┌──────────────────────────────────────────────────────────┐
          │                        CLI (commander)                    │
          │   init │ run │ approve │ list                             │
          └───────────────┬──────────────────────────────────────────┘
                          │
        ┌─────────────────┼───────────────────────────────────────────┐
        │                 │                                            │
   ┌────▼─────┐    ┌───────▼────────┐    ┌───────────────┐    ┌────────▼────────┐
   │  Config  │    │  Case Loader   │    │   Provider    │    │   Baseline      │
   │  Loader  │    │ (glob+parse+   │    │   Registry    │    │   Store         │
   │ (zod)    │    │  validate)     │    │ mock/anthropic│    │ (.prompt-       │
   └────┬─────┘    └───────┬────────┘    │ /openai       │    │  regression/)   │
        │                  │             └───────┬───────┘    └────────┬────────┘
        │                  │                     │                     │
        └──────────────────┴─────────┬───────────┴─────────────────────┘
                                     │
                              ┌──────▼───────┐
                              │    Runner    │  for each case: render prompt →
                              │ (orchestrator)│  call provider (with cache) →
                              └──────┬───────┘  compare vs baseline
                                     │
                       ┌─────────────▼─────────────┐
                       │        Comparator          │  textual diff + semantic score
                       │  → verdict (PASS/DRIFT/…)   │  → thresholds
                       └─────────────┬──────────────┘
                                     │
                              ┌──────▼───────┐
                              │   Reporter    │  pretty terminal + JSON
                              └──────┬───────┘
                                     │
                              exit code (0 / 1)
```

**Flow:** `run` loads config → loads & validates cases → resolves provider → for each case, renders
the prompt (variable substitution), calls the provider (cache-aware), loads the baseline, runs the
comparator to get a verdict, collects results → reporter prints and returns an exit code. `approve`
reuses the last run's cached outputs (or re-runs) and writes them into the baseline store.

---

## 6. Key components / modules

- **`cli.ts`** — bin entrypoint; wires commander subcommands to the command handlers. (Stub exists.)
- **`config.ts`** — load + validate `prompt-regression.config.yaml`, apply defaults, merge CLI flags.
- **`cases.ts`** — discover case files via glob, parse YAML/JSON, validate with zod, resolve
  per-case overrides against config defaults.
- **`prompt.ts`** — render a case into concrete `system`/`user` messages via `{{variable}}`
  substitution from the case's `input` map. Throws on unknown/missing variables.
- **`providers/`**
  - `types.ts` — the `Provider` interface (`complete`, optional `embed`).
  - `mock.ts` — deterministic output derived from a hash of the rendered prompt; deterministic
    pseudo-embedding for semantic scoring.
  - `anthropic.ts`, `openai.ts` — lazy-loaded official SDK wrappers.
  - `registry.ts` — map provider name → factory; validate required env keys.
- **`cache.ts`** — content-addressed response cache keyed by `hash(provider+model+params+messages)`
  under `.prompt-regression/cache/`. Skips network on identical inputs.
- **`baselines.ts`** — read/write/promote baseline records; path helpers; content hashing.
- **`comparator.ts`** — textual diff (jsdiff), semantic similarity (cosine), threshold logic →
  `CaseResult`.
- **`runner.ts`** — orchestrates a full run; returns `RunReport`.
- **`reporter.ts`** — terminal rendering (colored summary + per-case diff) and `--json` output.
- **`commands/`** — `init.ts`, `run.ts`, `approve.ts`, `list.ts` (thin handlers over the modules).
- **`util/hash.ts`, `util/fs.ts`, `util/similarity.ts`** — small helpers.

---

## 7. Interface: CLI commands / config (exact signatures + examples)

Binary name: **`prompt-regression`** (alias `pr` set in `package.json` `bin`).

### Global options
```
--config <path>     Path to config file      (default: ./prompt-regression.config.yaml)
--cases <glob>      Override case glob        (default: from config, else ./cases/**/*.{yaml,yml,json})
--no-color          Disable ANSI colors
-h, --help / -V, --version
```

### `prompt-regression init`
Scaffold config + a sample case + baseline dir.
```
prompt-regression init [--provider <mock|anthropic|openai>] [--force]
```
Creates: `prompt-regression.config.yaml`, `cases/hello.case.yaml`, `.prompt-regression/.gitkeep`.
`--force` overwrites existing files.

### `prompt-regression run`
Run cases and compare to baselines.
```
prompt-regression run [--filter <substr>] [--provider <name>] [--model <id>]
                      [--ci] [--json [<path>]] [--update-on-new=<true|false>]
                      [--no-cache] [--seed <n>]
```
- `--filter <substr>`  Only run cases whose id/name contains `<substr>`.
- `--ci`               Exit non-zero on any `DRIFT` or `ERROR`. Disables the interactive diff pager;
                       prints a compact summary. New baselines still reported as `NEW` but do **not**
                       fail CI (a `NEW` case is informational; use `approve` to lock it).
- `--json [path]`      Emit the machine-readable `RunReport` to stdout (or to `path` if given).
- `--update-on-new`    Default `true`: auto-write baselines for cases that have none. `false` reports
                       `NEW` without writing (useful in CI to require an explicit `approve`).
- `--no-cache`         Force fresh provider calls.
- Exit codes: `0` = all `PASS`/`NEW`; `1` = at least one `DRIFT` or `ERROR`; `2` = usage/config error.

### `prompt-regression approve`
Promote the most recent run's outputs into the baseline store.
```
prompt-regression approve [--filter <substr>] [--all] [--yes]
```
- With no `--filter`/`--all`, prompts for confirmation and approves everything from the last run.
- `--all` approve every case; `--filter` approve a subset; `--yes` skip the confirmation prompt.
- Reads the last run from `.prompt-regression/last-run.json`; if absent, runs first.

### `prompt-regression list`
```
prompt-regression list [--json]
```
Prints each case id, name, provider/model, and baseline status (`baselined` | `no-baseline`).

### Example invocations
```bash
npx prompt-regression init                     # scaffold (mock provider, no keys needed)
npx prompt-regression run                       # first run: creates baselines, all NEW
npx prompt-regression run                       # second run: all PASS
# ...edit a prompt in cases/hello.case.yaml...
npx prompt-regression run                       # shows DRIFT with a diff, exit 1
npx prompt-regression approve --filter hello    # bless the new output
npx prompt-regression run --ci                  # green build

ANTHROPIC_API_KEY=sk-... npx prompt-regression run --provider anthropic --model claude-3-5-haiku-latest
```

### Config file: `prompt-regression.config.yaml`
```yaml
# All fields optional except where noted; shown with defaults.
version: 1
casesGlob: "cases/**/*.{yaml,yml,json}"
baselineDir: ".prompt-regression/baselines"
defaults:
  provider: mock                 # mock | anthropic | openai
  model: mock-1                  # provider-specific model id
  temperature: 0
  maxTokens: 1024
thresholds:
  semanticMin: 0.92              # semantic similarity >= this ⇒ not a semantic drift (0..1)
  textNormalize: true            # trim + collapse whitespace before textual compare
  ignorePatterns:                # regexes stripped before compare (e.g. timestamps)
    - "\\b\\d{4}-\\d{2}-\\d{2}T[0-9:.Z+-]+\\b"
report:
  showDiff: true                 # print per-case unified diff on DRIFT
  contextLines: 3
```

Provider keys come from env: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Never stored on disk.

---

## 8. Data models / schemas (concrete, zod-backed)

### Case file (`cases/*.case.{yaml,yml,json}`)
```yaml
id: hello                         # required, unique, kebab-case; used for baseline filename
name: "Friendly greeting"         # optional human label
provider: mock                    # optional; overrides config.defaults.provider
model: mock-1                     # optional; overrides config.defaults.model
temperature: 0                    # optional override
maxTokens: 256                    # optional override
system: |                         # optional system prompt (supports {{vars}})
  You are a concise assistant.
prompt: |                         # required user prompt (supports {{vars}})
  Greet {{name}} in one short sentence.
input:                            # optional variables substituted into system/prompt
  name: "Ada"
thresholds:                       # optional per-case override of the global thresholds block
  semanticMin: 0.95
```

TypeScript types (inferred from zod):
```ts
type Case = {
  id: string; name?: string;
  provider?: ProviderName; model?: string;
  temperature?: number; maxTokens?: number;
  system?: string; prompt: string;
  input?: Record<string, string | number | boolean>;
  thresholds?: Partial<Thresholds>;
};

type ProviderName = "mock" | "anthropic" | "openai";

type Thresholds = {
  semanticMin: number; textNormalize: boolean; ignorePatterns: string[];
};
```

### Baseline record — `.prompt-regression/baselines/<id>.json`
```json
{
  "schemaVersion": 1,
  "caseId": "hello",
  "provider": "mock",
  "model": "mock-1",
  "params": { "temperature": 0, "maxTokens": 256 },
  "renderedPromptHash": "sha256:3f9c…",
  "output": "Hello Ada, lovely to meet you!",
  "outputHash": "sha256:a17b…",
  "createdAt": "2026-07-15T12:00:00.000Z",
  "approvedBy": "cli"
}
```

### Run report (`--json` output & `.prompt-regression/last-run.json`)
```ts
type Verdict = "PASS" | "DRIFT" | "NEW" | "ERROR";

type CaseResult = {
  caseId: string;
  verdict: Verdict;
  provider: ProviderName; model: string;
  output: string;                 // the freshly produced output
  baselineOutput?: string;        // undefined when NEW
  semanticScore?: number;         // 0..1, undefined when NEW/ERROR
  textDiff?: string;              // unified diff string, present on DRIFT
  changedLines?: { added: number; removed: number };
  error?: string;                 // present on ERROR
};

type RunReport = {
  schemaVersion: 1;
  startedAt: string; finishedAt: string;
  provider: ProviderName; model: string;
  totals: { total: number; pass: number; drift: number; neu: number; error: number };
  results: CaseResult[];
  exitCode: 0 | 1;
};
```

### Verdict logic (in `comparator.ts`)
1. No baseline for case → **NEW** (write baseline if `updateOnNew`).
2. Provider/render error → **ERROR**.
3. Normalize both outputs (apply `textNormalize` + strip `ignorePatterns`).
   - If normalized strings are **identical** → **PASS**.
   - Else compute `semanticScore`. If `semanticScore >= semanticMin` → **PASS** (paraphrase within
     tolerance) but still attach the `textDiff` for visibility.
   - Else → **DRIFT** (attach `textDiff`, `changedLines`, `semanticScore`).

---

## 9. End-to-end example: input → output

**Given** `cases/hello.case.yaml`:
```yaml
id: hello
name: "Friendly greeting"
system: "You are a concise assistant."
prompt: "Greet {{name}} in one short sentence."
input: { name: "Ada" }
```

**First run** (mock provider, no baseline yet):
```
$ npx prompt-regression run

prompt-regression · provider=mock model=mock-1

  NEW    hello   Friendly greeting   (baseline created)

Summary: 1 total · 0 pass · 0 drift · 1 new · 0 error
Exit: 0
```

**Second run** (unchanged): `PASS`, exit 0.

**After editing the prompt** to `"Warmly greet {{name}} and wish them a good day."`:
```
$ npx prompt-regression run

prompt-regression · provider=mock model=mock-1

  DRIFT  hello   Friendly greeting   semantic=0.71 (min 0.92)  +1 / -1

    --- baseline
    +++ current
    @@ -1 +1 @@
    -Hello Ada, lovely to meet you!
    +Good day, Ada — wishing you a wonderful one!

Summary: 1 total · 0 pass · 1 drift · 0 new · 0 error
Exit: 1
```

**Approve and re-run:**
```
$ npx prompt-regression approve --filter hello --yes
approved 1 case → baseline updated

$ npx prompt-regression run --ci
Summary: 1 total · 1 pass · 0 drift · 0 new · 0 error
Exit: 0
```

`--json` for the DRIFT run yields a `RunReport` whose `results[0]` matches the `CaseResult` shape in §8.

---

## 10. File & directory structure (tree)

```
prompt-regression/
├── DESIGN.md
├── README.md
├── LICENSE
├── .gitignore
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── prompt-regression.config.yaml        # created by `init` in a user project (sample kept here)
├── cases/
│   └── hello.case.yaml                   # sample case (shipped for the demo/tests)
├── src/
│   ├── cli.ts                            # bin entrypoint (STUB provided)
│   ├── config.ts
│   ├── cases.ts
│   ├── prompt.ts
│   ├── cache.ts
│   ├── baselines.ts
│   ├── comparator.ts
│   ├── runner.ts
│   ├── reporter.ts
│   ├── schemas.ts                        # zod schemas + inferred types
│   ├── commands/
│   │   ├── init.ts
│   │   ├── run.ts
│   │   ├── approve.ts
│   │   └── list.ts
│   ├── providers/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── mock.ts
│   │   ├── anthropic.ts
│   │   └── openai.ts
│   └── util/
│       ├── hash.ts
│       ├── fs.ts
│       └── similarity.ts
├── test/
│   ├── comparator.test.ts
│   ├── prompt.test.ts
│   ├── runner.mock.test.ts
│   └── fixtures/
└── .prompt-regression/                   # generated; baselines committed, cache gitignored
    ├── baselines/
    │   └── hello.json
    ├── cache/                            # gitignored
    └── last-run.json                     # gitignored
```

---

## 11. Build plan (ordered checklist for the builder agent)

> Complete these **in order**. Each step should leave the repo in a working, testable state.

1. **Project bootstrap.** Initialize `package.json` (already provided), install deps, add
   `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`. Confirm `npm run build` and `npm test`
   run (empty pass).
2. **Schemas first (`src/schemas.ts`).** Implement zod schemas for `Config`, `Case`, `Thresholds`,
   `Baseline`, `RunReport`, `CaseResult`; export inferred TS types. Unit-test parse/validate.
3. **Utilities.** `util/hash.ts` (sha256 → `sha256:<hex>`), `util/fs.ts` (safe read/write/ensureDir,
   glob), `util/similarity.ts` (token-set cosine over normalized text). Test similarity edge cases.
4. **Config loader (`config.ts`).** Load YAML/JSON, apply defaults, validate, merge CLI overrides.
5. **Case loader (`cases.ts`) + prompt renderer (`prompt.ts`).** Glob + parse + validate cases;
   `{{var}}` substitution with strict unknown/missing-variable errors. Test rendering.
6. **Provider interface + mock (`providers/types.ts`, `mock.ts`, `registry.ts`).** Deterministic
   `complete()` (hash-derived text) and pseudo-`embed()`. Registry validates env keys per provider.
7. **Cache (`cache.ts`).** Content-addressed read/write under `.prompt-regression/cache/`.
8. **Baseline store (`baselines.ts`).** Read/write/promote records; path + hash helpers.
9. **Comparator (`comparator.ts`).** Normalize (textNormalize + ignorePatterns), textual diff via
   jsdiff, semantic score via provider embeddings-or-fallback, verdict per §8. Thorough unit tests.
10. **Runner (`runner.ts`).** Orchestrate: for each (filtered) case → render → cached provider call →
    load baseline → comparator → collect `RunReport`; write `last-run.json`; honor `updateOnNew`.
11. **Reporter (`reporter.ts`).** Colored terminal summary + per-case diff; `--json` output; totals.
12. **Commands.** `commands/run.ts`, `approve.ts`, `list.ts`, `init.ts` wired to the modules.
13. **CLI wiring (`cli.ts`).** Replace the stub: commander subcommands, global options, exit codes.
14. **Real providers (`anthropic.ts`, `openai.ts`).** Lazy-import official SDKs; map config → SDK
    calls; `embed()` where available; single bounded retry on transient errors.
15. **Sample case + `init` templates.** Ship `cases/hello.case.yaml`; `init` writes config + sample.
16. **End-to-end mock test (`runner.mock.test.ts`).** init → run(NEW) → run(PASS) → mutate →
    run(DRIFT, exit 1) → approve → run(PASS, exit 0). Assert exit codes and verdicts.
17. **Docs polish.** Verify README quickstart works verbatim; capture the screenshot/GIF placeholder;
    ensure `npx prompt-regression` runs from a clean checkout.

---

## 12. Testing approach

- **Framework:** vitest. Target the pure logic hardest.
- **Unit:** schemas (valid/invalid fixtures), `similarity` (identical=1, disjoint≈0, paraphrase mid),
  `prompt` rendering (missing/unknown var throws), `comparator` (PASS vs DRIFT vs NEW boundaries,
  `ignorePatterns` stripping, `textNormalize`).
- **Integration (mock provider, no network, deterministic):** the full `run → approve → run` lifecycle
  in a temp dir; assert verdicts, exit codes, and that baseline files are written/updated.
- **Determinism guardrails:** mock provider output is a pure function of the rendered prompt, so tests
  never flake and require no keys. Real-provider modules are unit-tested with the SDK mocked.
- **CI:** `npm run build && npm test`. The tool's own `run --ci` is *not* used to gate its own repo
  (that would need live models); the mock lifecycle test covers the exit-code contract instead.

---

## 13. Constraints & non-goals

- **IP clean-room note (required).** This is an **original, clean-room, generic** tool. It does **not**
  reference, reproduce, or depend on any specific employer's (e.g. Aerospike's) source code, internal
  data, proprietary metrics, product names, or confidential specifics. It is built solely from general,
  publicly-known software concepts and the author's own general know-how. Any resemblance to internal
  tooling is coincidental and conceptual only.
- **No hidden network calls.** The only network egress is to the explicitly-selected model provider.
  Default provider is `mock` (fully offline). No telemetry, analytics, or phone-home.
- **Secrets never touch disk.** API keys are read from environment variables only; baselines and cache
  never contain keys.
- **Non-goals** (see §3 "out of scope"): web UI, multi-turn/agentic flows, multi-sample statistical
  eval, auto-approve, cost tracking, streaming, non-text modalities, a hosted service.
- **Determinism caveat.** With real providers, outputs may vary even at temperature 0; the semantic
  threshold exists precisely to tolerate benign variation while still catching meaningful drift.

---

## 14. README outline + positioning

**Positioning (GitHub one-liner):** *"Snapshot testing for LLM prompts — catch prompt & model
regressions before you ship."* Aim for a strong first impression: green-badge simplicity, a copy-paste
quickstart that works with **zero API keys** (mock provider), and one screenshot/GIF of a `DRIFT` diff.

**README section order:**
1. Title + one-liner + badges (npm, CI, license).
2. `## Screenshot` — GIF/PNG of a `DRIFT` run with the colored diff.
3. **Why** — the 3-sentence problem statement.
4. **Install** — `npm i -g prompt-regression` / `npx prompt-regression`.
5. **Quickstart** — `init → run → edit → run(DRIFT) → approve → run(PASS)` in ~6 commands, no keys.
6. **How it works** — cases → baselines → diff → verdict; the §8 verdict rules in brief.
7. **Configuration** — the config block + thresholds explained.
8. **Using real models** — env keys, `--provider anthropic|openai`.
9. **CI** — the `run --ci` snippet + exit-code contract; a sample GitHub Actions step.
10. **FAQ / non-goals** — link to `DESIGN.md`.
11. License (MIT © 2026 Keith Lindsay) + companion blog link.

**Companion blog post:** *"How to Ship an AI Feature in a Quarter."* This tool is the concrete
"add a regression gate" artifact from that post — the post links here as the recommended way to keep a
prompt-backed feature from silently regressing after launch.
