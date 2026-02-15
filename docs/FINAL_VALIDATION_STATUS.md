# OpenRec Validation Status (Execution Snapshot)

This document captures current validation evidence for implemented plan items and
explicitly lists the remaining macOS-only runtime gates that require manual verification.

## Automated validation evidence (Linux execution environment)

The following checks are run repeatedly after reliability and architecture commits:

- `pnpm run verify:frontend`
  - component size guard (`check-component-size`) passes
  - TypeScript compile (`tsc --noEmit`) passes
- `cargo fmt --all --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
  - backend unit tests cover export validation paths, ffprobe parsing helpers,
    process-termination resilience, source fallback helpers, and startup/opened-path parsing.

## Validated reliability behaviors implemented

- Bounded stop finalization with timeout + explicit failure event (`recording-stop-failed`)
- Frontend recovery when stop/finalization fails (recorder + widget)
- Main-window restoration and widget closure on stop failure paths
- Expanded finalization phase status progression (`stopping-capture` → `concatenating-segments` → `verifying-duration` → `verifying-dimensions` → `saving-project` → `refreshing-ui`) in backend and UI
- Frontend regression coverage for finalization status-to-message/status-label mapping
- Manual retry command for failed finalization (`retry_recording_finalization`) exposed through recorder UI recovery action
- Pending retry context persisted in local storage so retry action survives recorder route reloads
- Retry context validation command (`has_pending_recording_finalization`) clears stale retry affordances when backend state no longer has pending artifacts
- Retry telemetry eventing (`recording-finalization-retry-status`) provides started/succeeded/failed visibility in recorder diagnostics
- Backend auto-prunes stale pending-finalization contexts when required screen artifacts are missing
- Advanced runtime timeout presets for recorder/widget flows (localStorage-backed overrides with guarded defaults)
- Async file I/O migration for runtime filesystem paths in backend
- Export preflight validation for required media file existence/readability
- Export speed-audio regression coverage (`atempo` chain)
- Deterministic backend coverage for ffmpeg timeout handling path (termination callback + timeout error mapping)
- Automated export drift recovery coverage for stale-process pruning while preserving running jobs
- Frontend scoped-event isolation coverage via `recordingEventScope` tests (project-id filtering and active-project resolution)
- Frontend local-storage resilience coverage for runtime timeout overrides and pending finalization retry context stores
- Frontend runtime diagnostics store coverage (dedupe window, sequence ordering, lifecycle metadata, capped history)
- Frontend export store coverage for active-job registration, drift resync metadata preservation, and reset/unregister behavior
- Help menu links for manual update/install docs via opener plugin
- Inline recovery diagnostics panel for recorder/export/runtime warning visibility
- Structured telemetry sequencing for recorder/export/system lifecycle events in diagnostics

## Remaining required manual gates (macOS)

These cannot be conclusively verified in the Linux execution host and must be
run on real macOS machines before declaring full plan completion:

1. Screen/window source disconnect-reconnect behavior during active recording and paused state
2. Mid-session permission revocation flows (Screen Recording, Microphone, Camera)
3. Long-running stability pass (multi-hour + pause/resume + auto-segmentation)
4. Hardware export performance target verification on Apple Silicon
5. Unsigned Gatekeeper install/open validation on clean Intel + Apple Silicon systems

For execution details and pass/fail capture fields, use:
[`docs/MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](./MACOS_RUNTIME_VALIDATION_CHECKLIST.md).

## Closure scope for this execution

macOS runtime validation is explicitly out of scope for completion in this environment.
Completion for this execution therefore requires:

1. Automated baseline remains green:
   - `pnpm run verify:frontend`
   - `cargo fmt --all --manifest-path src-tauri/Cargo.toml`
   - `cargo test --manifest-path src-tauri/Cargo.toml`
2. No known open P0/P1 issues in the implemented reliability scope.
3. Runtime validation checklist is prepared for external macOS execution.

## Conclusion

Automated reliability/architecture hardening is continuously validated and currently green in this environment.
macOS runtime gates remain to be executed externally using the dedicated checklist artifact.

For non-blocking future polish opportunities, see:
[`docs/NICE_TO_HAVE_BACKLOG.md`](./NICE_TO_HAVE_BACKLOG.md).

For operator guidance on runtime warnings and expected recovery actions, see:
[`docs/RECOVERY_WARNING_PLAYBOOK.md`](./RECOVERY_WARNING_PLAYBOOK.md).

