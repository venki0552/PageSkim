// Regenerates the golden fixtures under test/fixtures/expected/ from the
// current build. Run via: npm run fixtures:update -w @pageskim/core
// Review the diff before committing — goldens define spec-conformant output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convert } from "../dist/index.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const outDir = fileURLToPath(new URL("../test/fixtures/expected/", import.meta.url));
mkdirSync(outDir, { recursive: true });

for (const name of ["article-infobox", "docs", "blog", "product"]) {
  const html = readFileSync(`${root}/examples/${name}/page.html`, "utf8");
  const r = convert(html);
  if (!r.ok) throw new Error(`${name}: ${r.error.code}`);
  writeFileSync(`${outDir}/${name}.llm.md`, r.md);
  if (name === "article-infobox") writeFileSync(`${outDir}/${name}.llm.json`, r.json);
  console.log(`updated ${name} (md ${r.md.length} bytes)`);
}
