/** Umbrella CLI: `pageskim generate …` / `pageskim validate …`. */

const USAGE = `pageskim — make your site readable by LLMs and agents

Usage:
  pageskim generate <file|dir|-> [options]   Emit .llm.md siblings
  pageskim validate <page.html> <sibling>    Check a sibling against its page

Run either subcommand with --help for its options.`;

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "generate") {
    const { run } = await import("@pageskim/generator");
    return run(rest);
  }
  if (cmd === "validate") {
    const { run } = await import("@pageskim/validator");
    return run(rest);
  }
  console.error(USAGE);
  return cmd === undefined || cmd === "--help" || cmd === "-h" ? 0 : 1;
}

main().then((code) => {
  process.exitCode = code;
});
