const latestReleaseBase =
  "https://github.com/TommyBez/open-rec/releases/latest/download";

export const downloads = [
  {
    platform: "macOS",
    artifact: "Apple Silicon DMG",
    note: "Preview build for M-series Macs. Unsigned so fresh releases can ship faster.",
    href: `${latestReleaseBase}/openrec-macos-apple-silicon.dmg`,
    checksumHref: `${latestReleaseBase}/openrec-macos-apple-silicon.dmg.sha256`,
  },
  {
    platform: "macOS",
    artifact: "Intel DMG",
    note: "Preview build for Intel Macs. Unsigned so fresh releases can ship faster.",
    href: `${latestReleaseBase}/openrec-macos-intel.dmg`,
    checksumHref: `${latestReleaseBase}/openrec-macos-intel.dmg.sha256`,
  },
  {
    platform: "Linux",
    artifact: "AppImage",
    note: "Portable x86_64 build for Ubuntu, Fedora, and other major distros.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.AppImage`,
    checksumHref: `${latestReleaseBase}/openrec-linux-x86_64.AppImage.sha256`,
  },
  {
    platform: "Linux",
    artifact: "Debian package",
    note: "Native x86_64 installer for Debian and Ubuntu systems.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.deb`,
    checksumHref: `${latestReleaseBase}/openrec-linux-x86_64.deb.sha256`,
  },
] as const;

export const capabilityCards = [
  {
    title: "Capture the full story",
    body: "Record your screen or a window, then add camera and microphone tracks so the handoff includes context instead of guesswork.",
  },
  {
    title: "Clean up before you send",
    body: "Trim dead space, cut mistakes, add zoom, adjust speed, and annotate the timeline so people land on the important moment faster.",
  },
  {
    title: "Export what the next person needs",
    body: "Send an MP4 or GIF, reopen the project later, and hand over a file your team can review, verify, and reuse.",
  },
] as const;

export const releaseSignals = [
  "Every download points to the latest GitHub release asset.",
  "macOS and Linux preview builds are produced in CI.",
  "Each binary ships with a published SHA256 checksum.",
] as const;
