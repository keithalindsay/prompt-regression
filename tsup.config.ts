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
