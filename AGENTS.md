# AGENTS.md

## Cursor Cloud specific instructions

OpenRec is a Tauri 2 desktop screen recorder/editor (React 19 + Vite 7 + Rust). See `README.md` for the full quick-start commands and `CONTRIBUTING.md` for the pre-push checklist.

### Key commands (reference)

All standard dev commands are in `package.json` scripts and `README.md § Development quick start`. The single local CI command is `pnpm run verify:ci-local`.

### Running on Linux (Cloud Agent environment)

- Linux recording is supported through an FFmpeg/X11 pipeline. Ensure `ffmpeg` is available on `PATH`.
- Linux system-audio capture uses PulseAudio/PipeWire monitor sources. Install `pactl`/PulseAudio tooling if system-audio capture is required.
- Wayland-only sessions without XWayland (`DISPLAY`) are not currently supported for screen capture.
- `pnpm run tauri:dev` launches the native desktop window via GTK/WebKit.
- The `libEGL` warnings about DRI3 at startup are harmless (no GPU acceleration in the VM) and can be ignored.
- `libayatana-appindicator3-dev` must be installed or the app will panic at launch (tray icon dependency).
- `libgbm-dev` must be installed for Linux backend test/build linking (`-lgbm` from Linux capture stack).
- `libpipewire-0.3-dev` must be installed for backend compilation (`xcap` Linux capture dependency).
- The standalone `pnpm run dev` in the workspace runs the desktop Vite frontend only and serves on `http://localhost:1420`, but the React app will error in a plain browser because it depends on Tauri runtime APIs. Use `pnpm run tauri:dev` to exercise the working desktop UI.
- `pnpm run dev:landing` starts the Next.js landing page.
- Port 1420 must be free before running `pnpm run tauri:dev`; it starts Vite internally and will fail with `strictPort: true` if the port is occupied.

### Rust toolchain

The project's dependencies require Rust ≥ 1.85 (edition 2024 support). The VM's pre-installed Rust may be older; run `rustup update stable && rustup default stable` if `cargo check` fails on `edition2024`.

### pnpm build script approval

pnpm 10 blocks build scripts by default. The `esbuild` postinstall is currently ignored (warning at `pnpm install`). Vite and Vitest still work because esbuild falls back to WASM, but it is slower. Do not run the interactive `pnpm approve-builds`.
