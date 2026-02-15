# Contributing to OpenRec

Thanks for contributing.

## 1) Local validation before pushing

Run the full local baseline:

```bash
pnpm run verify:ci-local
```

This includes:

- docs link verification
- frontend type/component-size checks
- frontend runtime tests
- backend fmt/check/test

## 2) Documentation update expectations

When behavior, workflows, or validation scope changes, update docs in the same PR.

Primary references:

- docs index: [`docs/README.md`](./docs/README.md)
- validation snapshot: [`docs/FINAL_VALIDATION_STATUS.md`](./docs/FINAL_VALIDATION_STATUS.md)
- execution checklist: [`docs/PLAN_EXECUTION_CHECKLIST.md`](./docs/PLAN_EXECUTION_CHECKLIST.md)
- CI matrix: [`docs/CI_WORKFLOWS.md`](./docs/CI_WORKFLOWS.md)

## 3) CI behavior note

Some workflows use concurrency with `cancel-in-progress: true`.
Older in-flight runs can appear as **cancelled** when newer commits are pushed quickly.
See [`docs/CI_WORKFLOWS.md`](./docs/CI_WORKFLOWS.md) for interpretation guidance.
