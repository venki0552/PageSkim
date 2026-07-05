## What

<!-- One-paragraph summary of the change. -->

## Why

<!-- Link the issue/RFC this addresses. Spec changes require a prior RFC issue — see CONTRIBUTING.md. -->

## Checklist

- [ ] One logical change; conventional commit message(s)
- [ ] Tests added/updated (new generator behavior ⇒ new fixture)
- [ ] `npm run lint && npm test && npm run build` pass locally
- [ ] No conversion logic added outside `packages/core`
- [ ] `packages/core` stays isomorphic (no Node-only APIs, no network calls)
- [ ] Spec changes: RFC issue linked, JSON Schema + changelog + worked example updated
