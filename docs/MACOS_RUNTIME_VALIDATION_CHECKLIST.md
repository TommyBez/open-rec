# macOS Runtime Validation Checklist

Use this checklist to complete final acceptance outside the Linux execution environment.

## Test metadata (fill before running)

- Date:
- Tester:
- macOS version:
- Hardware:
  - [ ] Apple Silicon
  - [ ] Intel
- Build identifier / commit:

---

## 1) Source disconnect / reconnect behavior

### 1.1 Display recording fallback
**Steps**
1. Start display recording.
2. Disconnect selected monitor or simulate display removal.
3. Continue for 20+ seconds, then stop.

**Pass criteria**
- Recording does not crash/hang.
- Fallback warning is shown.
- Stop/finalize succeeds.
- Output plays and project opens.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 1.2 Window recording fallback
**Steps**
1. Start window recording.
2. Close or hide the recorded window.
3. Continue briefly, then stop.

**Pass criteria**
- Fallback handling message appears.
- Recording remains stable and finalizes cleanly.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 1.3 Pause-state fallback
**Steps**
1. Start recording, pause.
2. Disconnect display / close window target.
3. Resume, record briefly, stop.

**Pass criteria**
- Resume works without crash.
- Fallback source is used if needed.
- Final output is playable and complete.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 2) Permission revocation flows

### 2.1 Screen Recording revoked mid-session
**Steps**
1. Start recording.
2. Revoke Screen Recording permission in System Settings.
3. Attempt pause/resume/stop.

**Pass criteria**
- App shows actionable error.
- UI recovers to non-stuck state.
- No crash.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 2.2 Microphone and Camera revoked
**Steps**
1. Enable mic/camera capture and start recording.
2. Revoke permissions while active.
3. Stop recording and inspect output/project.

**Pass criteria**
- App remains responsive.
- Errors are surfaced clearly.
- Stop/finalization path remains recoverable.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 3) Long-run stability

### 3.1 Extended recording reliability
**Steps**
1. Record for extended duration (target: multi-hour if feasible).
2. Include multiple pause/resume cycles.
3. Stop and finalize.

**Pass criteria**
- No stuck states (`starting`/`stopping`/`paused`) after completion.
- No obvious performance collapse.
- Final project/media are valid.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 3.2 Process hygiene
**Steps**
1. During export and stop finalization, inspect process list.
2. After completion/failure, verify no orphan ffmpeg processes remain.

**Pass criteria**
- No persistent orphan ffmpeg processes after terminal state.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 4) Export correctness and cancellation

### 4.1 Export matrix
Run representative exports across:
- MP4 + GIF
- 720p / 1080p / 4K (as available)
- speed edits + zoom + camera overlay

**Pass criteria**
- Output generated correctly.
- Speed-edit audio remains synchronized.
- Missing-file conditions fail early with clear errors.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 4.2 Cancellation
**Steps**
1. Start export.
2. Cancel mid-run.

**Pass criteria**
- Cancel succeeds.
- UI returns to healthy state.
- No stuck export count.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 5) Performance gate (Apple Silicon)

### 5.1 Target benchmark
**Scenario**
- 5-minute 1080p project with representative edits.

**Pass criteria**
- Meets target export SLA defined by plan.
- No quality/correctness regression.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 6) Unsigned distribution and Gatekeeper flow

### 6.1 Fresh install from DMG
**Steps**
1. Download DMG + checksum.
2. Verify checksum.
3. Install from DMG.
4. Execute Gatekeeper bypass flow.

**Pass criteria**
- Install instructions are sufficient and accurate.
- App launches successfully after bypass.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

### 6.2 First-run permissions
**Pass criteria**
- Permission prompts occur correctly.
- App works after grants.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## 7) Multi-window / tray / menu behavior

### 7.1 Tray + app menu actions
Validate:
- Open Recorder
- Open Projects
- Recent project open
- New Window
- Help links

**Pass criteria**
- Correct navigation/window behavior.
- No duplicate notification spam across windows.

Result: [ ] PASS [ ] FAIL  
Evidence:  
Notes:

---

## Final sign-off

All sections above must be PASS for final acceptance.

- Final result: [ ] PASS [ ] FAIL
- Remaining blockers:
- Follow-up issues filed:
