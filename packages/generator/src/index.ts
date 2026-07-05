/**
 * @agentpage/generator — CLI wrapper around @agentpage/core.
 * The generate pipeline lands in Phase 2; this stub defines the entry point
 * shape so the bin wiring and tests exist from day one.
 */

export const NOT_IMPLEMENTED_MESSAGE =
  "agentpage generate is not implemented yet (arrives in Phase 2). " +
  "Track progress in the repository README.";

/** Returns a process exit code. Real argument parsing arrives in Phase 2. */
export function run(_argv: string[]): number {
  console.error(NOT_IMPLEMENTED_MESSAGE);
  return 1;
}
