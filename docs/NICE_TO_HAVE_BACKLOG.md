# OpenRec Nice-to-Have Backlog (Non-Blocking)

These items are intentionally **non-blocking** for current completion scope.
They are quality-of-life and polish opportunities that can be addressed in future iterations.

## Reliability / observability enhancements

1. **Configurable timeout presets**
   - Expose stop/finalization and widget-handoff timeout values via settings (advanced mode)
   - Keep safe defaults but allow controlled tuning for slower machines

## Test-depth improvements

2. **Targeted backend tests for ffmpeg timeout path**
   - Add deterministic tests around timeout-triggered process termination behavior
   - Requires command-process mocking or abstraction of command runner

3. **Frontend integration tests for multi-window event isolation**
   - Validate recorder/widget/main window event filtering behavior under simulated concurrent sessions

4. **Automated smoke test for export-job drift recovery**
   - Validate periodic/focus-based export job resync behavior against stale-state scenarios

