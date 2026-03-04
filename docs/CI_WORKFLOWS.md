# OpenRec CI Workflows

Documentation index: [`README.md`](./README.md)

This reference explains what each GitHub Actions workflow validates and why some
runs can appear as **cancelled** during rapid push sequences.

## Workflow matrix

| Workflow | Purpose | Host |
|---|---|---|
| `frontend-checks.yml` | docs links, frontend type checks, frontend tests, frontend build | `ubuntu-latest` |
| `backend-checks.yml` | docs links, backend fmt/check/test | `ubuntu-latest` |
| `backend-macos-checks.yml` | docs links + backend compile guard for `#[cfg(target_os = "macos")]` code paths | `macos-14` |
| `unsigned-macos-build.yml` | unsigned DMG release builds + checksums | `macos-14` |

## Why runs may show as “cancelled”

Most workflows use:

```yaml
concurrency:
  cancel-in-progress: true
```

When multiple commits are pushed quickly to the same branch, older in-progress
runs are cancelled in favor of the newest run. This is expected behavior and
helps avoid redundant CI usage.

Interpretation guidance:

- **cancelled** + newer run exists: usually expected concurrency behavior
- **failure**: investigate logs for a real regression

## Quick CI inspection commands

Use GitHub CLI from repo root:

```bash
# recent runs for current branch
gh run list --branch <branch-name> --limit 20

# inspect one run in detail (jobs + step outcomes)
gh run view <run-id>

# stream logs for a run
gh run view <run-id> --log
```

If a run is marked `cancelled`, first verify whether a newer run for the same
branch/commit range completed successfully before treating it as a blocker.

## Local equivalents

Use these commands before pushing:

```bash
pnpm run verify:docs
pnpm run verify:frontend
pnpm run test:frontend
cargo fmt --all --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Or run the single aggregate command:

```bash
pnpm run verify:ci-local
```

## Related references

- contributor workflow: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- local failure patterns: [`LOCAL_BUILD_TROUBLESHOOTING.md`](./LOCAL_BUILD_TROUBLESHOOTING.md)
