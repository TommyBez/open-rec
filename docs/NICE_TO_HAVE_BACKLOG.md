# OpenRec Nice-to-Have Backlog (Non-Blocking)

These items are intentionally **non-blocking** for current completion scope.
They are quality-of-life and polish opportunities that can be addressed in future iterations.

## Reliability / observability enhancements

1. **Structured telemetry for lifecycle event ordering**
   - Capture event ordering metrics for recorder/widget/main-window state sync
   - Useful to proactively detect race conditions that currently rely on defensive guards

2. **Configurable timeout presets**
   - Expose stop/finalization and widget-handoff timeout values via settings (advanced mode)
   - Keep safe defaults but allow controlled tuning for slower machines

3. **Dedicated retry command for failed finalization**
   - If stop-finalization fails, provide one-click retry path before requiring manual recovery

## Test-depth improvements

4. **Targeted backend tests for ffmpeg timeout path**
   - Add deterministic tests around timeout-triggered process termination behavior
   - Requires command-process mocking or abstraction of command runner

5. **Frontend integration tests for multi-window event isolation**
   - Validate recorder/widget/main window event filtering behavior under simulated concurrent sessions

6. **Automated smoke test for export-job drift recovery**
   - Validate periodic/focus-based export job resync behavior against stale-state scenarios

