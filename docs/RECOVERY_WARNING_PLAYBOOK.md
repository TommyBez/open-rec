# OpenRec Recovery Warning Playbook

Use this playbook during manual validation and support triage.

Format per entry:
- **Message / signal**
- **Likely cause**
- **What OpenRec already did**
- **Operator action**

## 1) Recording source fallback warnings

### Display/window target changed mid-session

| Message / signal | Likely cause | What OpenRec already did | Operator action |
|---|---|---|---|
| `Selected display became unavailable. Recorder switched to Display N.` | Selected monitor disconnected or changed identity | Switched to available display fallback | Continue if capture is acceptable; otherwise stop and restart after hardware stabilizes |
| `Selected window became unavailable. Recorder switched to window source ...` | Target window closed/recreated/minimized | Switched to fallback window source | Verify intended window is visible; continue or restart |
| `Display "..." is unavailable. Switched to "...".` | Saved display preference no longer valid at start time | Applied safe fallback source | Confirm selected source before recording |
| `Saved display is unavailable. Recording will use "...".` | Previous display ID not present in current session | Applied nearest valid display fallback | Continue or manually reselect source |

### Source missing while session remains active

| Message / signal | Likely cause | What OpenRec already did | Operator action |
|---|---|---|---|
| `The selected display is disconnected. Recording will continue on Display N when capture resumes.` | Display disconnected while recording/paused | Continued session; fallback monitoring remains active | Reconnect display if possible; avoid repeated pause/resume until stable |
| `The selected window is unavailable. Recording may fail when resuming.` | Window source disappeared | Session remains active with warning | Restore target window, then resume or stop safely |

## 2) Floating controls / widget handoff warnings

| Message / signal | Likely cause | What OpenRec already did | Operator action |
|---|---|---|---|
| `Recording started, but floating controls failed to open. Use global shortcuts to pause or stop.` | Widget creation/show/focus timed out or failed | Recording kept running; shortcut controls remain available | Use shortcuts or reopen controls from recorder |
| `Unable to open floating controls. Use global shortcuts to pause or stop.` | Manual widget-open action failed (session/window issue) | Preserved recording state | Continue via shortcuts, then inspect logs if repeatable |

## 3) Permission and disk-pressure warnings

| Message / signal | Likely cause | What OpenRec already did | Operator action |
|---|---|---|---|
| `Screen recording permission was revoked...` | Permission revoked during session | Preserved session state and surfaced warning | Stop recording, re-enable permission, relaunch if needed |
| `Unable to verify screen recording permission...` | Permission poll/check errored | Preserved state and emitted conservative warning | Verify permissions manually before continuing long run |
| `Recording stopped automatically because free disk space dropped below ...` | Disk guardrail threshold crossed | Triggered auto-stop to reduce corruption risk | Free space and verify generated project before next run |

## 4) Stop/finalization warnings

### Normal finalization timeline (reference)
`stopping-capture` → `concatenating-segments` → `verifying-duration` → `verifying-dimensions` → `saving-project` → `refreshing-ui`

### Failure/retry warnings

| Message / signal | Likely cause | What OpenRec already did | Operator action |
|---|---|---|---|
| `Recording stopped, but finalization failed...` | Merge/probe/save finalization step failed | Emitted failure event; recovered UI/session state | Use **Retry Finalization** first, then inspect recordings list if failure persists |
| `No pending finalization context is available for retry...` | Backend no longer has retry artifacts/context | Cleared stale retry context and blocked no-op retry | Verify project state in recordings list; continue with new recording if needed |
| `Recording finalization timed out in the widget...` | Finalization exceeded widget recovery budget | Reset widget state to avoid stuck controls | Verify output integrity before starting another session |

## 5) Quick triage when warnings repeat

1. Confirm active source still exists (display/window is present).
2. Confirm required permissions are granted (Screen Recording, Camera, Microphone).
3. Confirm free disk space is above guardrail threshold.
4. Retry with a short capture to validate recovery path quickly.
5. If still reproducible, collect logs + exact warning sequence and attach to issue report.
