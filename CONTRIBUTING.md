# Contributing to PageSkim

Thanks for your interest! This document covers dev setup, PR rules, and the process for proposing changes to the format spec.

## Dev setup

Prerequisites: **Node.js ≥ 20**, **Python ≥ 3.11** (only for `bench/`), git.

```bash
git clone <repo-url> && cd pageskim
npm install                # installs all npm workspaces
npm test                   # vitest across packages
npm run lint               # eslint (flat config, typescript-eslint)
npm run build              # tsc build across packages
npm run typecheck          # tsc --noEmit across packages
```

Python (benchmark harness only):

```bash
python3.11 -m venv bench/.venv
bench/.venv/bin/pip install -e "bench[dev]"
bench/.venv/bin/pytest bench
```

### Repository invariants (please keep these true)

- `packages/core` is **pure and isomorphic**: it must run unmodified in Node and the browser/edge. No Node-only APIs on the hot path, no framework dependencies (Next.js/React are for `apps/playground` only), **no network calls at runtime**.
- The CLI (`generator`, `validator`), browser SDK, and playground all import conversion logic from `packages/core`. Never reimplement conversion logic elsewhere.
- Generator and validator output is **deterministic**: same input → byte-identical output (stable sorting, stable slugs).
- Every edge case in the spec's edge-case matrix has a test fixture. If you fix a behavior, add or update the fixture.

## Pull requests

- `main` is protected by a ruleset (see `.github/rulesets/`): changes land via
  pull request, both CI checks must pass, merges are squash-only (keeps a
  linear, signed history), and force pushes/deletions are blocked.
- One logical change per PR; keep diffs focused.
- Conventional commit messages: `feat(core): …`, `fix(validator): …`, `docs(spec): …`, `test: …`, `chore: …`.
- All PRs need green CI (lint, test, build) and tests for behavior changes.
- New generator behaviors need a fixture under the relevant package's `test/fixtures/`.
- Public API changes (core/SDK) need a README update in the affected package.

## Spec changes (RFC process)

The format spec (`spec/SPEC.md`) is normative — generators, validators, and third-party implementations depend on it. Changes follow an RFC process:

1. **Open an issue** using the "Spec change (RFC)" template. Describe the problem, the proposed change, backward-compatibility impact, and how validators/generators must change.
2. **Discussion period**: at least 7 days for non-trivial changes, so third-party implementers can weigh in.
3. **PR against `spec/SPEC.md`** referencing the RFC issue. The PR must update: the spec text, the JSON Schema (if the `.json` rendering changes), the changelog, and the worked example.
4. **Versioning**: the spec uses semver. Breaking format changes bump the minor version pre-1.0 (`0.1` → `0.2`) and are batched; editorial fixes are patch-level. Every emitted sibling file carries the spec version it conforms to, so tooling can handle mixed-version sites.
5. Tooling PRs implementing the spec change land only after the spec PR merges.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
