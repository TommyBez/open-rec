# Open Rec

A macOS screen and camera recording app with editing capabilities. Built with Tauri 2, React, and TypeScript.

## Features

- **Recording**
  - Screen or window capture (full display or specific app window)
  - Camera overlay
  - Microphone capture
  - System audio capture
  - Floating recording widget with pause/resume/stop controls, plus in-recorder fallback button to reopen controls
  - Automatic display/window fallback when the selected capture target disappears mid-session
  - Inline recovery diagnostics panel for recent recorder/export/runtime events
- **Editing**
  - Cut and trim segments on a timeline
  - Zoom effects (scale, position)
  - Speed effects (variable playback speed)
  - Undo support
- **Export**
  - MP4 or GIF output
  - Quality presets (minimal, social, web)
  - Resolution options (720p, 1080p, 4K)
- **My Recordings**
  - Browse and manage recorded projects
  - Open recordings in the editor
  - Open `.openrec` project files directly from Finder/Explorer
- **Distribution UX**
  - Help menu shortcuts for GitHub Releases and unsigned-install instructions

## Tech Stack

- **[Tauri 2](https://tauri.app/)** – Desktop app framework
- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** + **[Vite 7](https://vite.dev/)**
- **[Tailwind CSS 4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)**
- **[Zustand](https://github.com/pmndrs/zustand)** – State management
- **ScreenCaptureKit** – macOS native screen capture (macOS 15+)
- **FFmpeg** – Video export (bundled)

## Prerequisites

- **macOS 15.0+** (ScreenCaptureKit requirement)
- [Node.js](https://nodejs.org/) (with pnpm)
- [Rust](https://www.rust-lang.org/tools/install)
- Screen Recording permission (granted on first run)

## Development

```bash
# Install dependencies
pnpm install

# Verify backend checks
cargo fmt --all --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml

# Verify frontend constraints
pnpm run verify:frontend

# Run in development mode
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

### Unsigned macOS build

OpenRec is configured to build as an unsigned macOS app (`signingIdentity: null`).
This is useful for internal testing or distribution without an Apple Developer ID.

See the installation and Gatekeeper instructions in
[`docs/UNSIGNED_MAC_INSTALL.md`](docs/UNSIGNED_MAC_INSTALL.md).
Unsigned release workflows also publish `.sha256` checksum files for each DMG.
The app menu **Help** section links directly to both the releases page and install guide.
Current implementation and validation status is tracked in
[`docs/FINAL_VALIDATION_STATUS.md`](docs/FINAL_VALIDATION_STATUS.md).
Use [`docs/MACOS_RUNTIME_VALIDATION_CHECKLIST.md`](docs/MACOS_RUNTIME_VALIDATION_CHECKLIST.md)
to execute and record final macOS acceptance runs.
For warning-to-recovery guidance during manual validation, see
[`docs/RECOVERY_WARNING_PLAYBOOK.md`](docs/RECOVERY_WARNING_PLAYBOOK.md).
For optional post-closure polish items, see
[`docs/NICE_TO_HAVE_BACKLOG.md`](docs/NICE_TO_HAVE_BACKLOG.md).

### File associations

OpenRec registers the `.openrec` extension as a project document type.

- Double-clicking a `.openrec` file opens the project in an editor window.
- Tray and app menu recent-project entries also open project windows directly.

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Recorder, Editor, RecordingWidget, VideoSelection
│   ├── stores/             # Zustand stores (recording, editor)
│   ├── hooks/              # Custom hooks
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── recording/      # Screen capture, ScreenCaptureKit
│   │   ├── project/        # Project management
│   │   └── export/         # FFmpeg export
│   └── binaries/           # Bundled FFmpeg (plus Linux wrappers to system ffmpeg)
└── components.json         # shadcn/ui config
```

## Routes

| Path | Description |
|------|-------------|
| `/recorder` | Main recording interface |
| `/editor/:projectId` | Video editor |
| `/recording-widget` | Floating control during recording |
| `/videos` | My Recordings library |

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
