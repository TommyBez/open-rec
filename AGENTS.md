# AGENTS.md

## Cursor Cloud specific instructions

OpenRec is a Tauri 2 desktop screen recorder/editor (React 19 + Vite 7 + Rust). See `README.md` for the full quick-start commands and `CONTRIBUTING.md` for the pre-push checklist.

### Key commands (reference)

All standard dev commands are in `package.json` scripts and `README.md § Development quick start`. The single local CI command is `pnpm run verify:ci-local`.

### Running on Linux (Cloud Agent environment)

- **Recording features are macOS-only** (ScreenCaptureKit). On Linux, the Tauri app launches and renders the UI but recording/capture will not function.
- `pnpm tauri dev` launches the native desktop window via GTK/WebKit. The app will show a "Permission Required" screen on first load — this is expected; navigate via **File → Open Projects** to reach the My Recordings page and explore the UI.
- The `libEGL` warnings about DRI3 at startup are harmless (no GPU acceleration in the VM) and can be ignored.
- `libayatana-appindicator3-dev` must be installed or the app will panic at launch (tray icon dependency).
- The standalone `pnpm dev` (Vite only) serves on `http://localhost:1420`, but the React app will error in a plain browser because it depends on Tauri runtime APIs. Always use `pnpm tauri dev` to see the working UI.
- Port 1420 must be free before running `pnpm tauri dev`; it starts Vite internally and will fail with `strictPort: true` if the port is occupied.

### Rust toolchain

The project's dependencies require Rust ≥ 1.85 (edition 2024 support). The VM's pre-installed Rust may be older; run `rustup update stable && rustup default stable` if `cargo check` fails on `edition2024`.

### pnpm build script approval

pnpm 10 blocks build scripts by default. The `esbuild` postinstall is currently ignored (warning at `pnpm install`). Vite and Vitest still work because esbuild falls back to WASM, but it is slower. Do not run the interactive `pnpm approve-builds`.
