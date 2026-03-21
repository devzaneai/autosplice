# AutoSplice User Guide

## Overview

AutoSplice has two features, accessible via tabs in the panel:

1. **Jump Cut** — Removes silence from clips
2. **Multi-Cam** — Switches between camera angles based on active speaker

Both follow the same workflow: **Analyze** (preview) then **Apply** (commit). All edits can be undone with Ctrl+Z / Cmd+Z.

---

## Jump Cut Editor

### When to Use
- Solo talking-head videos (vlogs, tutorials)
- Podcast episodes (single speaker)
- Any footage where you want to remove dead air

### Setup
1. Place your clips on the timeline
2. Optionally select specific clips (otherwise AutoSplice analyzes the full sequence)

### Settings

| Setting | What It Does | Default |
|---|---|---|
| **Silence Threshold** | Audio below this level is considered silence. Lower values = more aggressive cutting. | -40 dB |
| **Min Silence Duration** | Silence must last at least this long to be cut. Prevents cutting natural pauses between words. | 500 ms |
| **Padding** | Buffer kept before and after speech segments. Prevents clipping the start/end of words. | 150 ms |
| **Mode** | **Delete** removes silent sections and ripples the timeline. **Disable** keeps clips but marks them as disabled for review. | Delete |

### Tips
- Start with defaults and adjust after previewing
- Use **Disable mode** first if you're unsure — you can re-enable any clip manually
- Lower the threshold (e.g., -50 dB) for quiet recordings with low noise floors
- Raise the threshold (e.g., -30 dB) for noisier environments
- Increase padding if words are getting clipped at the edges

---

## Multi-Camera Editor

### When to Use
- Podcast interviews with 2+ cameras and separate mics per speaker
- Panel discussions with multiple participants
- Any multi-cam shoot where each speaker has a dedicated microphone

### Prerequisites
- Each speaker must have their own microphone on a **separate audio track**
- Each camera angle must be on a **separate video track**
- All clips should be synced on the timeline before running AutoSplice

### Setup
1. Arrange your footage:
   - Video Track 1: Camera 1 (e.g., Host)
   - Video Track 2: Camera 2 (e.g., Guest)
   - Audio Track 1: Mic 1 (e.g., Host's lav mic)
   - Audio Track 2: Mic 2 (e.g., Guest's lav mic)
2. Open AutoSplice > Multi-Cam tab
3. Map speakers: A1 → V1, A2 → V2, etc.

### Settings

| Setting | What It Does | Default |
|---|---|---|
| **Speaker Mapping** | Which audio track (microphone) corresponds to which video track (camera) | Sequential |
| **Min Cut Duration** | Minimum time before switching cameras. Prevents rapid, jarring cuts. | 3 seconds |
| **Crosstalk Sensitivity** | How much louder a mic must be than others to trigger a switch. Higher = more conservative. | 6 dB |
| **Wide Shot Frequency** | How often to insert a wide/group shot (if configured). | 30 seconds |

### Tips
- The 6 dB crosstalk sensitivity works well for lavalier mics. Increase to 10+ dB for boom mics with more bleed.
- Set minimum cut duration to 2-3 seconds for fast-paced conversations, 5+ seconds for calmer interviews.
- Use the wide shot feature to add visual variety — assign a wide camera to a video track and select it as the wide shot track.
- After applying, manually review transitions where speakers overlap — AutoSplice holds the current camera during ambiguous moments.

---

## General Tips

- **Always preview first** — Click Analyze before Apply to see what will change
- **Undo is your friend** — Ctrl+Z / Cmd+Z reverts the entire AutoSplice operation as one step
- **Save first** — Save your project before applying edits, as a precaution
- **Work on a duplicate sequence** — If you're nervous, duplicate your sequence first and run AutoSplice on the copy
