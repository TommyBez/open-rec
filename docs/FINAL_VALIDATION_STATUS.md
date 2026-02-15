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
- Finalization phase status progression (`merging` → `verifying` → `saving`) in backend and UI
- Async file I/O migration for runtime filesystem paths in backend
- Export preflight validation for required media file existence/readability
- Export speed-audio regression coverage (`atempo` chain)
- Help menu links for manual update/install docs via opener plugin

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

## Conclusion

Automated reliability/architecture hardening is continuously validated and currently green in this environment.
Final acceptance remains gated on the macOS manual validation items above.

