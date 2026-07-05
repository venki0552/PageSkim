/**
 * @pageskim/validator — CLI wrapper around @pageskim/core.
 * The validation pipeline lands in Phase 3; this stub defines the entry point
 * shape so the bin wiring and tests exist from day one.
 */

export const NOT_IMPLEMENTED_MESSAGE =
  "pageskim validate is not implemented yet (arrives in Phase 3). " +
  "Track progress in the repository README.";

/** Returns a process exit code. Real argument parsing arrives in Phase 3. */
export function run(_argv: string[]): number {
  console.error(NOT_IMPLEMENTED_MESSAGE);
  return 1;
}
