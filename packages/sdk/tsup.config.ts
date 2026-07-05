import { defineConfig } from "tsup";

export default defineConfig([
  // ESM library build for bundlers/Node. Core stays external (regular dep);
  // the tokenizer is reached via dynamic import so bundlers code-split it.
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["@pageskim/core", "@pageskim/core/tokenizer", "gpt-tokenizer"],
  },
  // Umbrella CLI: pageskim generate|validate.
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    platform: "node",
    banner: { js: "#!/usr/bin/env node" },
    external: ["@pageskim/core", "@pageskim/core/tokenizer", "@pageskim/generator", "@pageskim/validator", "gpt-tokenizer"],
  },
  // Self-contained browser build: <script src=".../pageskim.min.js"> → global
  // PageSkim. No tokenizer inside (size budget); counts use the budget metric
  // unless pageskim.tokenizer.min.js is also loaded.
  {
    entry: { "pageskim.min": "src/iife.ts" },
    format: ["iife"],
    globalName: "PageSkim",
    platform: "browser",
    minify: true,
    sourcemap: true,
    noExternal: [/.*/],
    outExtension: () => ({ js: ".js" }),
  },
  // Optional tokenizer addon (heavy: bundles the o200k BPE ranks). Load
  // order-independent: registers into PageSkim if present, else parks itself.
  {
    entry: { "pageskim.tokenizer.min": "src/tokenizer-iife.ts" },
    format: ["iife"],
    platform: "browser",
    minify: true,
    noExternal: [/.*/],
    outExtension: () => ({ js: ".js" }),
  },
]);
