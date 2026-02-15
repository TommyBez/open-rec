# OpenRec Local Build Troubleshooting

Documentation index: [`README.md`](./README.md)

Use this guide for common local compile/check failures.

## 1) Rust compile error in `#[cfg(target_os = "macos")]` paths

### Symptom

Errors like:

- `E0515: cannot return value referencing temporary value`
- `E0716: temporary value dropped while borrowed`

often in `src-tauri/src/recording/recorder.rs` around `SCShareableContent::windows()`.

### Cause

macOS-only code can compile differently from Linux-host checks, especially when
references are taken from temporary collections returned by ScreenCaptureKit APIs.

### Fix pattern

- Prefer owned iteration (`into_iter()`) over borrowing from temporary values.
- Return owned values (`SCWindow`) instead of references tied to temporary collections.
- Build derived vectors (window IDs, displays) from owned iterators.

### Verification

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

CI guard:

- `backend-macos-checks.yml` compiles backend on `macos-14` to catch this class of regression early.

## 2) `pnpm` not found in CI/setup steps

### Symptom

GitHub Actions fails at Node setup/cache with “Unable to locate executable file: pnpm”.

### Fix

Ensure workflow order is:

1. `pnpm/action-setup`
2. `actions/setup-node` (with pnpm cache)
3. `pnpm install`

## 3) Documentation link breakages

### Symptom

Docs references drift or become stale after refactors.

### Fix / check

Run:

```bash
pnpm run verify:docs
```

This validates internal markdown file links for `README.md` and `docs/*.md`.
