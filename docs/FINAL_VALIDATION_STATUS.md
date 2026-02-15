# OpenRec Validation Status

Documentation index: [`docs/README.md`](./README.md)

This document summarizes what is validated inside the Linux execution environment
and what still requires manual macOS runtime verification.

## 1) Automated baseline (in-scope evidence)

The following checks are run repeatedly and are expected green:

- `pnpm run verify:frontend`
  - component-size guard
  - TypeScript compile (`tsc --noEmit`)
- `pnpm run test:frontend`
  - frontend runtime/store regression suites
- `cargo fmt --all --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
  - backend coverage around recording/export/project/opened-path reliability helpers

## 2) Validated implementation areas

### Recording stop/finalization reliability
- bounded stop finalization with explicit timeout/failure event (`recording-stop-failed`)
- deterministic finalization status progression in backend + UI
- recorder/widget recovery behavior on stop/finalization failures
- retry finalization flow with telemetry (`recording-finalization-retry-status`)
- stale retry-context cleanup (backend + frontend affordance clearing)
- persisted retry affordance with project-scoped clearing rules

### Recording/export runtime correctness
- export preflight media validation before ffmpeg spawn
- export speed/audio sync regression coverage (`atempo` chain)
- deterministic ffmpeg timeout handling tests
- export job drift/stale-process pruning coverage
- async filesystem migration for runtime I/O paths
- advanced runtime timeout overrides (guarded localStorage settings)

### Frontend runtime/state hardening
- scoped event isolation tests (`recordingEventScope`)
- runtime timeout storage resilience tests (including malformed JSON fallback)
- pending-finalization retry storage resilience tests
- runtime diagnostics store coverage (dedupe/order/metadata/capped history)
- export store coverage (registration, drift-resync preservation, reset/unregister)
- inline diagnostics panel + structured lifecycle telemetry plumbing

### Project/opened-path association reliability
- `.openrec` sidecar persistence on save/delete
- sidecar write/delete error surfacing (non-silent I/O failure handling)
- startup/opened-path parsing coverage for:
  - percent-decoded file URIs
  - uppercase file scheme handling
  - localhost vs non-local file-host validation
- `.openrec` payload `projectDir` resolution coverage for:
  - file URL decoding
  - stale/missing path fallback behavior
  - metadata-required directory acceptance
  - `projectDir` precedence over stale `projectId` with safe fallback to `projectId`

## 3) Remaining manual gates (macOS-only)

These are out of scope for Linux-only execution and must be run on real macOS hosts:

1. Display/window disconnect-reconnect handling during recording and paused states
2. Mid-session permission revocation (Screen Recording, Camera, Microphone)
3. Long-duration stability runs (including pause/resume and auto-segmentation)
4. Apple Silicon export performance target verification
5. Unsigned Gatekeeper install/open flow validation (Intel + Apple Silicon)

Use:
[`MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md)

## 4) Closure scope for this execution environment

Completion in this workspace is defined by:

1. automated baseline checks staying green
2. no known open P0/P1 blockers in implemented cross-platform runtime scope
3. macOS runtime validation packaged as an external checklist/runbook

## Related documents

- Execution checklist: [`PLAN_EXECUTION_CHECKLIST.md`](./PLAN_EXECUTION_CHECKLIST.md)
- Recovery triage playbook: [`RECOVERY_WARNING_PLAYBOOK.md`](./RECOVERY_WARNING_PLAYBOOK.md)
- Unsigned install guide: [`UNSIGNED_MAC_INSTALL.md`](./UNSIGNED_MAC_INSTALL.md)
- Non-blocking backlog: [`NICE_TO_HAVE_BACKLOG.md`](./NICE_TO_HAVE_BACKLOG.md)

