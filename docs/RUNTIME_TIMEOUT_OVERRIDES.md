# OpenRec Runtime Timeout Overrides

Documentation index: [`README.md`](./README.md)

Use this reference to tune recorder/widget timeout budgets for slower machines,
debug workflows, or stress-testing recovery behavior.

## Storage key

Timeout overrides are loaded from:

`localStorage["openrec.runtime-timeout-settings-v1"]`

## Supported fields

| Key | Used by |
|---|---|
| `recorderStartRecordingTimeoutMs` | recorder start flow |
| `recorderStopFinalizationTimeoutMs` | recorder stop/finalization flow |
| `recorderOpenWidgetTimeoutMs` | floating widget open handoff |
| `recorderHideWindowTimeoutMs` | main-window hide handoff during start |
| `widgetStopRecordingTimeoutMs` | widget stop flow |
| `widgetPauseResumeTimeoutMs` | widget pause/resume flow |
| `widgetStoppingRecoveryTimeoutMs` | widget recovery timeout while stopping |

## Example override payload

```json
{
  "recorderStartRecordingTimeoutMs": 30000,
  "recorderStopFinalizationTimeoutMs": 180000,
  "recorderOpenWidgetTimeoutMs": 25000,
  "recorderHideWindowTimeoutMs": 8000,
  "widgetStopRecordingTimeoutMs": 120000,
  "widgetPauseResumeTimeoutMs": 12000,
  "widgetStoppingRecoveryTimeoutMs": 15000
}
```

## Guardrails and behavior

- Missing keys fall back to built-in defaults.
- Invalid or malformed persisted JSON is ignored; defaults are used.
- Values are sanitized/clamped by the runtime settings loader.
- Diagnostics may emit a timeout-override lifecycle event when custom settings are active.

## Recommended usage

1. Start from defaults and increase only the timeout you need.
2. Change one field at a time, then retry the scenario.
3. Revert overrides after debugging to avoid masking real regressions.

## Reset overrides

Clear the key in dev tools:

```js
localStorage.removeItem("openrec.runtime-timeout-settings-v1");
```
