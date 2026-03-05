#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

SUDO=""
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

apt_install_if_missing() {
  local missing=()
  local pkg
  for pkg in "$@"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      missing+=("$pkg")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    ${SUDO} apt-get update
    ${SUDO} apt-get install -y --no-install-recommends "${missing[@]}"
  fi
}

ensure_ffmpeg_on_path() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    apt_install_if_missing ffmpeg
  fi
  command -v ffmpeg >/dev/null 2>&1
}

ensure_node_20() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$nvm_dir/nvm.sh"
    nvm install 20
    nvm alias default 20
    nvm use 20
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not available after bootstrap." >&2
    exit 1
  fi

  local major
  major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "$major" != "20" ]; then
    echo "Expected Node.js 20, found $(node -v)." >&2
    exit 1
  fi
}

ensure_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable
      corepack prepare pnpm@latest --activate
    else
      npm install -g pnpm
    fi
  fi
  command -v pnpm >/dev/null 2>&1
}

ensure_rust_stable() {
  if ! command -v rustup >/dev/null 2>&1; then
    curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable --profile minimal
    export PATH="$HOME/.cargo/bin:$PATH"
  fi

  rustup toolchain install stable --profile minimal --no-self-update
  rustup default stable
  command -v rustc >/dev/null 2>&1
  command -v cargo >/dev/null 2>&1
}

apt_install_if_missing libpipewire-0.3-dev libayatana-appindicator3-dev
ensure_ffmpeg_on_path
ensure_node_20
ensure_pnpm
ensure_rust_stable

echo "Cloud bootstrap complete."
echo "ffmpeg: $(command -v ffmpeg)"
echo "node: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "rustc: $(rustc --version)"
