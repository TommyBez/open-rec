# OpenRec Documentation Index

Use this index to quickly find the right document.

## Core documents

| Document | Purpose |
|---|---|
| [`FINAL_VALIDATION_STATUS.md`](./FINAL_VALIDATION_STATUS.md) | Current execution-scope validation snapshot and evidence summary |
| [`PLAN_EXECUTION_CHECKLIST.md`](./PLAN_EXECUTION_CHECKLIST.md) | Phase-by-phase completion checklist and closure gates |
| [`MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md) | Manual acceptance checklist to run on macOS hardware |
| [`RECOVERY_WARNING_PLAYBOOK.md`](./RECOVERY_WARNING_PLAYBOOK.md) | Warning triage playbook (cause, automatic recovery, operator action) |
| [`UNSIGNED_MAC_INSTALL.md`](./UNSIGNED_MAC_INSTALL.md) | Unsigned DMG install + Gatekeeper bypass instructions |
| [`CI_WORKFLOWS.md`](./CI_WORKFLOWS.md) | CI workflow matrix and cancelled-run interpretation guide |
| [`LOCAL_BUILD_TROUBLESHOOTING.md`](./LOCAL_BUILD_TROUBLESHOOTING.md) | Common local compile/check failure patterns and fixes |
| [`RUNTIME_TIMEOUT_OVERRIDES.md`](./RUNTIME_TIMEOUT_OVERRIDES.md) | Runtime timeout tuning reference (localStorage overrides) |
| [`NICE_TO_HAVE_BACKLOG.md`](./NICE_TO_HAVE_BACKLOG.md) | Non-blocking backlog items |

## Fast routing by goal

| If you need to... | Start here |
|---|---|
| Understand current execution-scope completion | [`FINAL_VALIDATION_STATUS.md`](./FINAL_VALIDATION_STATUS.md) |
| Track plan-phase closure items | [`PLAN_EXECUTION_CHECKLIST.md`](./PLAN_EXECUTION_CHECKLIST.md) |
| Run manual macOS acceptance | [`MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md) |
| Triage runtime warnings during validation | [`RECOVERY_WARNING_PLAYBOOK.md`](./RECOVERY_WARNING_PLAYBOOK.md) |
| Install unsigned builds on macOS | [`UNSIGNED_MAC_INSTALL.md`](./UNSIGNED_MAC_INSTALL.md) |
| Understand CI checks / cancelled runs | [`CI_WORKFLOWS.md`](./CI_WORKFLOWS.md) |
| Diagnose common local build/check failures | [`LOCAL_BUILD_TROUBLESHOOTING.md`](./LOCAL_BUILD_TROUBLESHOOTING.md) |
| Tune timeout budgets for debugging/recovery tests | [`RUNTIME_TIMEOUT_OVERRIDES.md`](./RUNTIME_TIMEOUT_OVERRIDES.md) |
| Review optional non-blocking follow-ups | [`NICE_TO_HAVE_BACKLOG.md`](./NICE_TO_HAVE_BACKLOG.md) |

## Suggested reading order

1. [`../README.md`](../README.md) — project overview + local quick start
2. [`FINAL_VALIDATION_STATUS.md`](./FINAL_VALIDATION_STATUS.md) — what is validated here
3. [`PLAN_EXECUTION_CHECKLIST.md`](./PLAN_EXECUTION_CHECKLIST.md) — closure checklist
4. [`MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md) — external runtime acceptance

## Documentation conventions

- Product name in docs: **OpenRec**
- macOS bundle label: **Open Rec.app**
- Use “Result / Evidence / Notes” blocks for manual runbooks/checklists.
- Keep validation status documents scoped to execution evidence; avoid duplicating full runbooks.

## Documentation maintenance checklist

When editing docs, quickly verify:

1. links resolve (`README.md` + `docs/*.md`)
   - run `pnpm run verify:docs`
2. no contradictory scope statements (Linux validation vs macOS manual gates)
3. no duplicate status text copied across multiple docs
4. warning/install/runtime procedures still point to the correct runbooks

Contributor guide:
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
