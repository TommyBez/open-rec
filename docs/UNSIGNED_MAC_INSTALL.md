# Installing OpenRec Unsigned Builds (macOS)

OpenRec release artifacts can be distributed without Apple code signing/notarization.
Unsigned builds work, but macOS Gatekeeper will warn on first launch.

## Download and install

1. Download the `.dmg` for your Mac:
   - `aarch64-apple-darwin` for Apple Silicon (M1/M2/M3)
   - `x86_64-apple-darwin` for Intel Macs
2. Open the DMG and drag **Open Rec.app** into **Applications**.

## First launch (Gatekeeper bypass)

Unsigned apps are blocked by default on first run.

Use either method:

### Method A (recommended)

1. In Finder, open **Applications**
2. Right-click **Open Rec.app**
3. Click **Open**
4. Click **Open** again in the system dialog

### Method B (System Settings)

1. Attempt to launch OpenRec once
2. Open **System Settings → Privacy & Security**
3. In the Security section, click **Open Anyway** for OpenRec
4. Confirm in the dialog

## Required permissions on first use

OpenRec will request:

- **Screen Recording**
- **Microphone** (if enabled)
- **Camera** (if enabled)

If recording fails, verify permissions in:

- **System Settings → Privacy & Security → Screen Recording**
- **System Settings → Privacy & Security → Microphone**
- **System Settings → Privacy & Security → Camera**

## Updates for unsigned builds

Unsigned builds are currently updated manually:

1. Download the latest DMG from GitHub Releases
2. Replace the app in `/Applications`
3. Launch again (Gatekeeper may prompt after each new build)
