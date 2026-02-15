# Installing OpenRec Unsigned Builds (macOS)

OpenRec release artifacts can be distributed without Apple code signing/notarization.
Unsigned builds work, but macOS Gatekeeper will warn on first launch.

## Download and install

1. Download the `.dmg` for your Mac:
   - `aarch64-apple-darwin` for Apple Silicon (M1/M2/M3)
   - `x86_64-apple-darwin` for Intel Macs
2. (Optional) verify the SHA256 checksum from the matching `.sha256` file:
   ```bash
   shasum -a 256 -c OpenRec-<target>.dmg.sha256
   ```
3. Open the DMG and drag **Open Rec.app** into **Applications**.

The DMG includes a pre-arranged drag-and-drop layout (app icon + Applications link).

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

If permissions were changed while OpenRec was open, fully quit and relaunch before retesting.

## Updates for unsigned builds

Unsigned builds are currently updated manually:

1. Download the latest DMG from GitHub Releases
2. Replace the app in `/Applications`
3. Launch again (Gatekeeper may prompt for each new build)

## Troubleshooting quick notes

- **“App is damaged” / blocked launch:** re-download the DMG, verify checksum, repeat right-click → Open flow.
- **No recording prompt appears:** check existing deny/allow state under Privacy & Security and relaunch.
- **App opens but capture fails:** confirm Screen Recording permission is enabled for **Open Rec.app**.
