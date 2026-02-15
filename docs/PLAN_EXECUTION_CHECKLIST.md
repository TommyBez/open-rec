# OpenRec Plan Execution Checklist

Documentation index: [`README.md`](./README.md)

This checklist tracks implementation closure status for this execution environment.

## Quick navigation

1. [Delivery checklist by plan phase](#1-delivery-checklist-by-plan-phase)
2. [Remaining manual gates (macOS runtime)](#2-remaining-manual-gates-macos-runtime)
3. [Workspace closure criteria](#3-workspace-closure-criteria)
4. [Pointer documents](#4-pointer-documents)

## 1) Delivery checklist by plan phase

### Phase 0 — Audit + critical reliability
- [x] Dynamic recording resolution (source-derived dimensions, quality presets, codec selection)
- [x] Duration no longer hardcoded in project metadata (session timing + ffprobe fallback)
- [x] Pause/resume segment stitching into canonical `screen.mp4`
- [x] Camera + microphone tracks captured from frontend and persisted with offsets
- [x] Export speed effects keep audio aligned (`atempo` chain support)
- [x] Export preflight validates required media inputs before ffmpeg spawn
- [x] Recording source fallback handling (display/window disconnect/reconnect resilience)
- [x] Recorder preferences persisted/restored with source-type-aware fields

### Phase 1 — Architecture hardening

- [x] Commands standardized on `Result<T, AppError>` with serialized user-facing errors
- [x] Critical runtime `.ok()` drops removed from backend execution paths
- [x] Runtime `std::fs` paths migrated to Tokio fs for async-safe operations
- [x] App shutdown cleanup for active recordings and active export jobs
- [x] Backend checks automated in CI (`cargo fmt`, `cargo check`, `cargo test`)
- [x] macOS-host backend compile guard added in CI (`backend-macos-checks.yml`)

### Phase 2 / 3 — Recording + editor capability upgrades

- [x] Recording quality presets (`720p30`, `1080p30`, `1080p60`, `4k30`, `4k60`)
- [x] Codec selection (`h264` / `hevc`)
- [x] Countdown flow + global start/stop + pause/resume shortcuts
- [x] Disk-space guardrails and auto-segmentation behavior
- [x] Camera overlay controls persisted in project data and used during export
- [x] Timeline/editor refactors into hook/component architecture with component-size guardrails
- [x] Export queue with cancellation and progress eventing

### Phase 4 / 5 / 6 — Native integration + distribution workflow

- [x] Tray menu + app menu with recorder/projects/recent-project actions
- [x] `.openrec` file association support and startup/opened-event handling
- [x] Unsigned macOS build config (`signingIdentity: null`)
- [x] Unsigned DMG workflow with release artifact upload + checksums
- [x] Unsigned installation documentation (Gatekeeper bypass + permissions)
- [x] In-app Help menu links for release downloads + unsigned install guide

## 2) Remaining manual gates (macOS runtime)

- [ ] End-to-end monitor unplug/replug tests while recording and while paused
- [ ] Permission revocation flows (screen/camera/mic) during active sessions
- [ ] Long-session stability pass (multi-hour run with pause/resume and auto-segmentation)
- [ ] Hardware export performance benchmark validation against target metrics
- [ ] Unsigned Gatekeeper install/open flow validation on clean machines (Intel + Apple Silicon)

## 3) Workspace closure criteria

Per approved scope, macOS runtime validation is out of scope for this Linux host.
Completion for this workspace is gated by:

- [x] Automated baseline green (`pnpm run verify:frontend`, `cargo fmt`, `cargo test`)
- [x] Documentation link baseline green (`pnpm run verify:docs`)
- [x] Frontend regression baseline green (`pnpm run test:frontend`)
- [x] No known open P0/P1 blockers in implemented cross-platform/runtime logic
- [x] Final sign-off documentation updated with explicit out-of-scope macOS runtime checklist

## 4) Pointer documents

- Validation snapshot: [`FINAL_VALIDATION_STATUS.md`](./FINAL_VALIDATION_STATUS.md)
- macOS acceptance runbook: [`MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md)
- Recovery triage playbook: [`RECOVERY_WARNING_PLAYBOOK.md`](./RECOVERY_WARNING_PLAYBOOK.md)

