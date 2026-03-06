const latestReleaseBase =
  "https://github.com/TommyBez/open-rec/releases/latest/download";

export const downloads = [
  {
    platform: "macOS",
    artifact: "Apple Silicon DMG",
    note: "Free desktop build for M-series Macs.",
    href: `${latestReleaseBase}/openrec-macos-apple-silicon.dmg`,
  },
  {
    platform: "macOS",
    artifact: "Intel DMG",
    note: "Free desktop build for Intel Macs.",
    href: `${latestReleaseBase}/openrec-macos-intel.dmg`,
  },
  {
    platform: "Linux",
    artifact: "AppImage",
    note: "Portable free build for Ubuntu, Fedora, and other major distros.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.AppImage`,
  },
  {
    platform: "Linux",
    artifact: "Debian package",
    note: "Native free installer for Debian and Ubuntu systems.",
    href: `${latestReleaseBase}/openrec-linux-x86_64.deb`,
  },
] as const;

export const capabilityCards = [
  {
    title: "Capture every layer",
    body: "Record the full screen or one window, then add camera and microphone tracks so bug reports, walkthroughs, and demos keep their context.",
  },
  {
    title: "Edit before you share",
    body: "Trim mistakes, cut waiting, zoom into the important moment, adjust speed, and annotate the timeline without bouncing into another app.",
  },
  {
    title: "Export and reuse",
    body: "Export MP4 or GIF, save the project, and come back later when you need a cleaner version or a follow-up clip.",
  },
] as const;

export const positioningPillars = [
  {
    title: "Free to download",
    body: "Install OpenRec on macOS or Linux and start recording without trials, seat limits, or upgrade gates.",
  },
  {
    title: "Open source by default",
    body: "Inspect the code, follow development on GitHub, and adapt the workflow to your own setup.",
  },
  {
    title: "Built for useful captures",
    body: "Screen, window, camera, mic, timeline edits, and clean exports all live in one desktop workflow.",
  },
] as const;
