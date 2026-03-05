const latestReleaseBase =
  "https://github.com/TommyBez/open-rec/releases/latest/download";

export const downloads = [
  {
    platform: "macOS",
    artifact: "Apple Silicon DMG",
    note: "Optimized for M-series Macs. Unsigned preview build.",
    href: `${latestReleaseBase}/openrec-macos-apple-silicon.dmg`,
    checksumHref: `${latestReleaseBase}/openrec-macos-apple-silicon.dmg.sha256`,
  },
  {
    platform: "macOS",
    artifact: "Intel DMG",
    note: "For Intel Macs. Unsigned preview build.",
    href: `${latestReleaseBase}/openrec-macos-intel.dmg`,
    checksumHref: `${latestReleaseBase}/openrec-macos-intel.dmg.sha256`,
  },
  {
    platform: "Linux",
    artifact: "AppImage",
    note: "Portable x86_64 bundle for Ubuntu, Fedora, and other distros.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.AppImage`,
    checksumHref: `${latestReleaseBase}/openrec-linux-x86_64.AppImage.sha256`,
  },
  {
    platform: "Linux",
    artifact: "Debian package",
    note: "Native x86_64 package for Debian and Ubuntu systems.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.deb`,
    checksumHref: `${latestReleaseBase}/openrec-linux-x86_64.deb.sha256`,
  },
] as const;

export const capabilityCards = [
  {
    title: "Capture without panic",
    body: "Screen, window, camera, and microphone capture are built around recoverable stop flows instead of best-effort exits.",
  },
  {
    title: "Edit like an operator",
    body: "Trim, cut, zoom, annotate, and shape exports from a timeline that stays close to the recording workflow.",
  },
  {
    title: "Ship the result",
    body: "Queue MP4 and GIF exports, reopen `.openrec` projects, and hand teammates a reproducible artifact instead of a one-off screen grab.",
  },
] as const;

export const releaseSignals = [
  "GitHub Actions builds Linux artifacts on ubuntu-latest.",
  "GitHub Actions builds Apple Silicon and Intel DMGs on macOS.",
  "Checksums ship beside every binary for verification.",
] as const;
