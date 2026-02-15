# OpenRec Nice-to-Have Backlog (Non-Blocking)

These items are intentionally **non-blocking** for current completion scope.
They are quality-of-life and polish opportunities that can be addressed in future iterations.

## Product / UX polish

1. **Inline diagnostics panel for recovery paths**
   - Surface recent recovery events (fallbacks, stop-finalization retries, export sync repairs)
   - Helps users understand what self-healed without checking logs

2. **More granular finalization progress text**
   - Optional finer-grained stop states beyond `merging/verifying/saving`
   - Could include segment counts, concat phase durations, and retry indicators

## Reliability / observability enhancements

3. **Structured telemetry for lifecycle event ordering**
   - Capture event ordering metrics for recorder/widget/main-window state sync
   - Useful to proactively detect race conditions that currently rely on defensive guards

4. **Configurable timeout presets**
   - Expose stop/finalization and widget-handoff timeout values via settings (advanced mode)
   - Keep safe defaults but allow controlled tuning for slower machines

5. **Dedicated retry command for failed finalization**
   - If stop-finalization fails, provide one-click retry path before requiring manual recovery

## Test-depth improvements

6. **Targeted backend tests for ffmpeg timeout path**
   - Add deterministic tests around timeout-triggered process termination behavior
   - Requires command-process mocking or abstraction of command runner

7. **Frontend integration tests for multi-window event isolation**
   - Validate recorder/widget/main window event filtering behavior under simulated concurrent sessions

8. **Automated smoke test for export-job drift recovery**
   - Validate periodic/focus-based export job resync behavior against stale-state scenarios

