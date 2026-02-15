# OpenRec Recovery Warning Playbook

This playbook maps runtime warning messages to expected causes and recommended recovery steps.
It is intended for operators validating reliability behavior during recording, widget handoff,
and export/finalization recovery flows.

## Recording source fallback warnings

### `Selected display became unavailable. Recorder switched to Display N.`
- **Surface:** Recorder page error banner
- **Meaning:** The chosen display disconnected or changed identity while recording.
- **What OpenRec already did:** Automatically switched to an available display fallback.
- **Recommended user action:** Continue recording if output looks correct; otherwise stop and restart after reconnecting displays.

### `Selected window became unavailable. Recorder switched to window source ...`
- **Surface:** Recorder page error banner
- **Meaning:** The target window closed/minimized/recreated and its capture ID became invalid.
- **What OpenRec already did:** Switched to a detected fallback window source.
- **Recommended user action:** Verify the intended app window is still visible and continue or restart.

### `Display "..." is unavailable. Switched to "...".`
- **Surface:** Recorder page error banner before/around start
- **Meaning:** Persisted display preference no longer matches currently available display set.
- **What OpenRec already did:** Selected a safe fallback display before capture.
- **Recommended user action:** Confirm the fallback source in the recorder selector.

### `Saved display is unavailable. Recording will use "...".`
- **Surface:** Recorder page error banner before start
- **Meaning:** Last-saved display could not be restored for the current hardware state.
- **What OpenRec already did:** Selected the nearest valid display fallback.
- **Recommended user action:** Proceed or manually reselect the preferred display.

### `The selected display is disconnected. Recording will continue on Display N when capture resumes.`
- **Surface:** Recording widget warning text
- **Meaning:** Current recording source is disconnected while session is active.
- **What OpenRec already did:** Polling for source recovery and fallback continuity.
- **Recommended user action:** Reconnect display if possible; avoid repeated pause/resume until source stabilizes.

### `The selected window is unavailable. Recording may fail when resuming.`
- **Surface:** Recording widget warning text
- **Meaning:** Current window capture target disappeared during session.
- **What OpenRec already did:** Continues session with warning; resume may fail if no window fallback is viable.
- **Recommended user action:** Bring the target app/window back, then resume or stop safely.

## Floating controls / handoff warnings

### `Recording started, but floating controls failed to open. Use global shortcuts to pause or stop.`
- **Surface:** Recorder page error banner
- **Meaning:** Screen capture started, but widget creation/show/focus path failed or timed out.
- **What OpenRec already did:** Recording continues and global shortcuts remain active.
- **Recommended user action:** Use shortcuts to continue control flow, or press **Open Floating Controls** in recorder.

### `Unable to open floating controls. Use global shortcuts to pause or stop.`
- **Surface:** Recorder page error banner
- **Meaning:** Manual widget open action failed (no active session or runtime window error).
- **What OpenRec already did:** Preserved recording state.
- **Recommended user action:** Use global shortcuts and finish recording, then inspect logs if this repeats.

## Permission and disk-pressure warnings

### `Screen recording permission was revoked...`
- **Surface:** Recording widget warning text
- **Meaning:** Permission check failed mid-session.
- **What OpenRec already did:** Keeps session state visible and surfaces warning.
- **Recommended user action:** Stop recording, re-enable permission in System Settings, relaunch if needed.

### `Unable to verify screen recording permission...`
- **Surface:** Recording widget warning text
- **Meaning:** Permission polling errored unexpectedly.
- **What OpenRec already did:** Preserved state and showed conservative warning.
- **Recommended user action:** Validate permissions manually in System Settings before continuing long sessions.

### `Recording stopped automatically because free disk space dropped below ...`
- **Surface:** Recording widget warning text
- **Meaning:** Disk guardrail detected low free space while recording.
- **What OpenRec already did:** Triggered auto-stop to reduce corruption risk.
- **Recommended user action:** Free disk space, then validate the saved project before recording again.

## Stop/finalization warnings

### Finalization status timeline (normal path)
- `stopping-capture` → `concatenating-segments` → `verifying-duration` → `verifying-dimensions` → `saving-project` → `refreshing-ui`
- **Surface:** Recorder finalization banner + widget status text
- **Meaning:** Progressive backend stop/finalization milestones are being emitted.
- **Operator tip:** If status stalls for an unusual duration, check disk space and ffmpeg availability before retry.

### `Recording stopped, but finalization failed...`
- **Surface:** Recorder page and/or recording widget warning text
- **Meaning:** Capture stopped, but one or more finalization steps failed (merge, probe, save).
- **What OpenRec already did:** Forced UI/session recovery and emitted failure event.
- **Recommended user action:** Click **Retry Finalization** in the recorder first; if retry still fails, open recordings list and verify artifacts manually.
- **Note:** Pending retry context is persisted locally so the retry action remains available after route changes.

### `Recording finalization timed out in the widget...`
- **Surface:** Recording widget warning text
- **Meaning:** Finalization exceeded recovery timeout budget.
- **What OpenRec already did:** Reset widget state so controls do not remain stuck.
- **Recommended user action:** Verify project integrity in recordings list before starting a new session.

## General triage checklist (when warnings repeat)

1. Confirm current capture source still exists (display/window still present).
2. Confirm permissions are granted (Screen Recording, Camera, Microphone as used).
3. Confirm free disk space is above guardrail.
4. Tune advanced timeout overrides (if needed) via `openrec.runtime-timeout-settings-v1`.
5. Retry on a short recording session to validate recovery path quickly.
6. Collect console/backend logs if the same warning persists across multiple runs.
