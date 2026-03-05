# OpenRec CI Workflows

Documentation index: [`README.md`](./README.md)

This reference explains what each GitHub Actions workflow validates and why some
runs can appear as **cancelled** during rapid push sequences.

## Workflow matrix

| Workflow | Purpose | Host |
|---|---|---|
| `frontend-checks.yml` | docs links, Turborepo frontend checks for `apps/desktop` + `apps/landing`, desktop frontend tests, frontend app builds | `ubuntu-latest` |
| `backend-checks.yml` | docs links + backend check/test/build on Linux+macOS (fmt on Linux lane; macOS lane configures Swift runtime paths before tests) | matrix: `ubuntu-latest`, `macos-14` |
| `release-artifacts.yml` | merged-PR-to-`main` desktop release flow: patch bump desktop version, create release tag, build Linux (`.AppImage`, `.deb`) and unsigned macOS (`.dmg`) artifacts, upload stable filenames + checksums | `ubuntu-latest`, `macos-14` |

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

## Release workflow behavior

`release-artifacts.yml` only runs for PRs that are actually merged into `main`.

- If the merged PR does **not** change `apps/desktop/**` (excluding the desktop version files), the workflow exits without creating a release.
- If the merged PR **does** change desktop app files, the workflow:
  1. bumps the desktop patch version in `apps/desktop/package.json`, `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/src-tauri/tauri.conf.json`
  2. commits that version bump back to `main`
  3. creates a GitHub release tag for the bumped version
  4. builds and uploads the desktop artifacts for macOS and Linux

## Local equivalents

Use these commands before pushing:

```bash
pnpm run verify:docs
pnpm run check
pnpm run test
pnpm --filter @openrec/desktop run cargo:fmt
pnpm --filter @openrec/desktop run cargo:check
pnpm --filter @openrec/desktop run cargo:test
```

Or run the single aggregate command:

```bash
pnpm run verify:ci-local
```

## Related references

- contributor workflow: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- local failure patterns: [`LOCAL_BUILD_TROUBLESHOOTING.md`](./LOCAL_BUILD_TROUBLESHOOTING.md)
