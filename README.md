# OpenRec

OpenRec is a Tauri-based desktop screen recorder/editor focused on reliable capture,
recoverable stop/finalization flows, and practical export tooling.

> Naming note: the product is referred to as **OpenRec** in docs.  
> The macOS app bundle appears as **Open Rec.app** in Finder.

## Highlights

- Screen or window recording (ScreenCaptureKit)
- Optional camera + microphone tracks
- Pause/resume with segment stitching at stop
- Floating recording widget with shortcut-based fallback control
- Recovery-oriented stop/finalization flow with retry support
- Timeline editing (trim/cut, zoom, speed effects, undo)
- MP4/GIF exports with queueing, progress, and cancellation
- `.openrec` project association + recent-project window open actions

## Tech stack

- [Tauri 2](https://tauri.app/)
- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite 7](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://github.com/pmndrs/zustand)
- FFmpeg / ffprobe (bundled sidecars where available)

## Requirements

- macOS 15+ for ScreenCaptureKit runtime behavior
- Node.js + pnpm
- Rust toolchain

## Development quick start

```bash
# install dependencies
pnpm install

# frontend checks
pnpm run verify:frontend
pnpm run verify:docs
pnpm run test:frontend

# backend checks
cargo fmt --all --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml

# run app
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

## Documentation map

See [`docs/README.md`](docs/README.md) for full navigation.  
Quick links:

- Validation status snapshot:
  [`docs/FINAL_VALIDATION_STATUS.md`](docs/FINAL_VALIDATION_STATUS.md)
- Execution checklist:
  [`docs/PLAN_EXECUTION_CHECKLIST.md`](docs/PLAN_EXECUTION_CHECKLIST.md)
- macOS runtime acceptance checklist:
  [`docs/MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](docs/MACOS_RUNTIME_VALIDATION_CHECKLIST.md)
- Recovery warning playbook:
  [`docs/RECOVERY_WARNING_PLAYBOOK.md`](docs/RECOVERY_WARNING_PLAYBOOK.md)
- Unsigned install guide:
  [`docs/UNSIGNED_MAC_INSTALL.md`](docs/UNSIGNED_MAC_INSTALL.md)
- CI workflow reference:
  [`docs/CI_WORKFLOWS.md`](docs/CI_WORKFLOWS.md)

## Advanced runtime timeout overrides

Recorder/widget timeout budgets can be overridden through
`localStorage["openrec.runtime-timeout-settings-v1"]`.

See:
[`docs/RUNTIME_TIMEOUT_OVERRIDES.md`](docs/RUNTIME_TIMEOUT_OVERRIDES.md)
for supported fields, example payloads, and reset instructions.
