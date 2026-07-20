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
