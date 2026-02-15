# OpenRec Nice-to-Have Backlog (Non-Blocking)

These items are intentionally **non-blocking** for current completion scope.
They are quality-of-life and polish opportunities that can be addressed in future iterations.

## Test-depth improvements

1. **Targeted backend tests for ffmpeg timeout path**
   - Add deterministic tests around timeout-triggered process termination behavior
   - Requires command-process mocking or abstraction of command runner

2. **Frontend integration tests for multi-window event isolation**
   - Validate recorder/widget/main window event filtering behavior under simulated concurrent sessions

3. **Automated smoke test for export-job drift recovery**
   - Validate periodic/focus-based export job resync behavior against stale-state scenarios

