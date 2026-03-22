# AutoSplice v2 — Design Specification

## Overview

Three new features for AutoSplice, the open-source Adobe Premiere Pro CEP extension:

1. **Combined Workflow ("Full Edit")** — Multi-cam switching + silence removal in one operation
2. **Filler Word Detection** — Local Whisper transcription to detect and optionally remove filler words
3. **Auto-Zoom on Active Speaker** — Subtle zoom effect on active camera clips after multi-cam switching

## Feature 1: Combined Workflow

### Purpose

Run multi-cam camera switching and jump cut silence removal in a single operation, producing a fully edited rough cut from raw multi-cam footage with one click.

### Operation Order

1. Run multi-cam analysis (detect speakers from RODECaster/mic tracks)
2. Run jump cut analysis (detect silence from the same audio)
3. Apply multi-cam switches (razor video, lift inactive cameras)
4. Apply jump cuts (razor + ripple delete silent segments)

Multi-cam applies first because it only modifies video (audio stays untouched). Jump cut applies second because ripple delete shortens the timeline — doing it last preserves the timecodes for the multi-cam phase.

Both analyses can run in parallel since they independently analyze the same audio.

### UI

A third tab called **"Full Edit"** that combines:
- Speaker Mapping section (from Multi-Cam tab)
- Silence settings section (from Jump Cut tab): threshold, min duration, padding
- Auto-Zoom settings (collapsible, see Feature 3)
- Wide shot track selector
- Single Analyze button → shows combined preview
- Single Apply button → executes both phases sequentially

### New Files

- `src/js/main/components/FullEditTab.tsx` — combined UI
- `src/js/engine/full-edit-engine.ts` — orchestrates both analyses

### Dependencies

- Reuses `analyzeMultiCam` from `multi-cam-engine.ts`
- Reuses silence detection from `silence-detector.ts` and analysis from `analyzer.ts`
- Reuses `applyMultiCamSwitches` and `applyJumpCuts` from `timeline-ops.ts`

---

## Feature 2: Filler Word Detection

### Purpose

Transcribe audio using a bundled local Whisper model, detect filler words (um, uh, like, you know, etc.), and either place Premiere markers at each filler or auto-remove them.

### Architecture

```
User clicks Analyze
    → FFmpeg extracts audio to WAV (existing)
    → whisper-cpp binary transcribes WAV → word-level JSON
    → Filler detector matches words against filler list
    → Returns detected fillers with timestamps

User clicks Apply
    → Marker mode: ExtendScript places sequence markers at each filler
    → Remove mode: Reuses applyJumpCuts to razor + ripple delete filler regions
```

### Whisper Integration

**Binary:** whisper.cpp pre-built binaries bundled with the extension:
- `bin/whisper-cpp-mac-arm64` (~5MB, Metal GPU acceleration)
- `bin/whisper-cpp-mac-x64` (~5MB)
- `bin/whisper-cpp-win-x64.exe` (~5MB)

**Model:** `bin/models/ggml-small-q5_1.bin` (182MB quantized)
- The `small` model is the minimum for reliable filler word detection
- Quantized Q5_1 reduces size from 466MB to 182MB with minimal accuracy loss

**Invocation:**
```
whisper-cpp -m models/ggml-small-q5_1.bin -f audio.wav -ml 1 -oj --prompt "Um, uh, like, you know"
```
- `-ml 1` — word-level timestamps (max segment length 1 word)
- `-oj` — output JSON format
- `--prompt "Um, uh, like, you know"` — guides Whisper to transcribe fillers instead of suppressing them

**Processing time:** ~2-3 minutes for 10 minutes of audio on Apple Silicon.

### Filler Detection

Default filler word list:
```
um, umm, uh, uhh, hmm, hm, like, you know, basically, actually, so, right, i mean
```

User can toggle individual fillers on/off in the UI.

Matching is case-insensitive. Multi-word fillers ("you know", "i mean") are matched by checking consecutive words.

### Modes

- **Markers (default):** Places Premiere sequence markers at each filler. Marker name = the filler word, marker color = red. Non-destructive — user reviews and decides.
- **Remove:** Converts each filler's time range to a cut region and reuses the existing `applyJumpCuts` function for razor + ripple delete.

### UI

A new tab called **"Fillers"** with:
- Analyze button (runs FFmpeg → Whisper → filler detection)
- Results summary: "Found 23 filler words (8 um, 6 uh, 5 like, 4 you know)"
- Filler word checklist: checkboxes to toggle which words to target
- Mode selector: Markers (default) / Remove
- Apply button
- Progress bar (Whisper can take 2-3 minutes)

### New Files

- `src/js/engine/whisper-bridge.ts` — spawns whisper-cpp, parses JSON output
- `src/js/engine/filler-detector.ts` — matches transcription against filler list
- `src/js/main/components/FillerTab.tsx` — UI tab
- `src/jsx/ppro/markers.ts` — ExtendScript function to add sequence markers

### ExtendScript Functions

`addFillerMarkers(markersJson)`:
- Takes `{word, startSeconds}[]`
- Creates sequence markers via `seq.markers.createMarker(time)` with name and color

### Bundled Files

Total addition to release: ~192MB (5MB binary + 182MB model + overhead)

---

## Feature 3: Auto-Zoom on Active Speaker

### Purpose

After multi-cam camera switches are applied, add a subtle zoom effect on each active camera clip. Makes the edit feel more dynamic and professional without manual keyframing.

### How It Works

For each active video clip (the ones NOT lifted during multi-cam switching):
1. Access the clip's Motion component: `clip.components[1]`
2. Access the Scale property: `components[1].properties[1]`
3. Apply zoom based on mode:
   - **Instant:** `scaleProp.setValue(zoomPercent, true)` — static zoom
   - **Animated:** Enable keyframing, set 100% at clip start, ease to target zoom over configured duration

### Settings

| Setting | Range | Default |
|---|---|---|
| Enable auto-zoom | Boolean | false |
| Zoom amount | 100-120% | 108% |
| Mode | Instant / Animated | Instant |
| Ease duration (animated only) | 0.2s - 1.0s | 0.5s |

### ExtendScript Function

`applyAutoZoom(zoomSettingsJson)`:
- Takes `{clips: [{trackIndex, startTimecode, endTimecode}], zoomPercent, animated, easeDurationSeconds}`
- For each matching clip on the specified video track:
  - Access `clip.components[1].properties[1]` (Motion > Scale)
  - Instant: `setValue(zoomPercent, true)`
  - Animated: `setTimeVarying(true)`, `addKey(clipStart)` at 100, `addKey(clipStart + duration)` at zoomPercent

### Limitations

- **Scale only, no position reframe.** ExtendScript's `setValue` for Position (X,Y array) is broken in Premiere 2020+. Zoom is from center only.
- **Linear interpolation for animated mode.** Bezier easing requires manual configuration that's unreliable in ExtendScript. Linear still looks clean.

### Integration

Auto-zoom settings appear as a collapsible section in the Multi-Cam tab and the Full Edit tab. When Apply is clicked, auto-zoom runs automatically after camera switches are applied (if enabled).

### New Files

- `src/jsx/ppro/zoom-ops.ts` — ExtendScript functions for Scale keyframes
- Auto-zoom settings added to `MultiCamTab.tsx` and `FullEditTab.tsx`

---

## UI Changes Summary

### New Tabs

| Tab | Purpose |
|---|---|
| **Full Edit** | Combined multi-cam + jump cut workflow |
| **Fillers** | Filler word detection and removal |

### Modified Tabs

| Tab | Change |
|---|---|
| **Multi-Cam** | Add collapsible Auto-Zoom section |

### Tab Bar

Current: `Jump Cut | Multi-Cam`
New: `Jump Cut | Multi-Cam | Full Edit | Fillers`

---

## Bundled Dependencies

| File | Size | Purpose |
|---|---|---|
| `bin/whisper-cpp-mac-arm64` | ~5MB | Whisper binary (macOS Apple Silicon) |
| `bin/whisper-cpp-mac-x64` | ~5MB | Whisper binary (macOS Intel) |
| `bin/whisper-cpp-win-x64.exe` | ~5MB | Whisper binary (Windows) |
| `bin/models/ggml-small-q5_1.bin` | ~182MB | Whisper small model (quantized) |
| `bin/ffmpeg-*` | ~430KB each | FFmpeg (existing) |

Total release size increases from ~500KB to ~200MB, primarily from the Whisper model.

---

## Integration Details

### ExtendScript Module Registration

New ExtendScript files (`markers.ts`, `zoom-ops.ts`) must be imported in `src/jsx/index.ts` and merged into `allFunctions` using the existing `for...in` pattern (no object spread — ES3 constraint). The `Scripts` type must also be extended.

### New Types (`src/shared/types.ts`)

```typescript
// Filler detection
type FillerMode = "markers" | "remove";

interface FillerSettings {
  readonly enabledFillers: readonly string[];
  readonly mode: FillerMode;
}

interface FillerEntry {
  readonly word: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

interface FillerResult {
  readonly fillers: readonly FillerEntry[];
  readonly totalCount: number;
  readonly countsByWord: Record<string, number>;
}

// Auto-zoom
interface AutoZoomSettings {
  readonly enabled: boolean;
  readonly zoomPercent: number;        // 100-120, default 108
  readonly animated: boolean;          // default false (instant)
  readonly easeDurationSeconds: number; // 0.2-1.0, default 0.5
}

// Full Edit combines existing settings
interface FullEditSettings {
  readonly multiCam: MultiCamSettings;
  readonly jumpCut: JumpCutSettings;
  readonly autoZoom: AutoZoomSettings;
}
```

### New Defaults (`src/shared/defaults.ts`)

```typescript
const DEFAULT_FILLER_SETTINGS: FillerSettings;
const DEFAULT_AUTO_ZOOM: AutoZoomSettings;
const DEFAULT_FILLER_WORDS: string[];
```

### Whisper Invocation Correction

Use `--split-on-word true` alongside `-ml 1` to ensure word boundaries are respected:
```
whisper-cpp -m models/ggml-small-q5_1.bin -f audio.wav -ml 1 --split-on-word -oj --prompt "Um, uh, like, you know"
```

### Audio Track for Filler Detection

Filler detection analyzes the same audio track as jump cut: selected clips, or the lowest-numbered audio track (A1) by default. In the Fillers tab, the user can optionally select which audio track to transcribe.

### Error Handling for Whisper

`whisper-bridge.ts` follows the existing try/finally pattern with `cleanupTempFiles()`. Specific errors:
- Binary not found → "Whisper not found — try reinstalling AutoSplice"
- Model not found → "Whisper model not found in bin/models/"
- Process timeout (>10 min) → kill process, show "Transcription timed out"
- Invalid JSON output → "Transcription failed — could not parse results"

### Whisper Progress Reporting

whisper-cpp writes progress to stderr. `whisper-bridge.ts` parses stderr lines for percentage updates and emits them via the existing `ProgressCallback` pattern. The `AnalysisPhase` type is extended with `"transcribing"`.

### Auto-Zoom Clip Identification

After `applyMultiCamSwitches`, the camera switch list already contains `{cameraTrackIndex, startTimecode, endTimecode}` for each active segment. This list is passed directly to `applyAutoZoom` — no additional query needed. The ExtendScript function matches clips using the same midpoint matching as multi-cam (center of clip must fall within the timecode range).

### Tab Bar Update

`main.tsx` extends `TabId` to `"jumpcut" | "multicam" | "fulledit" | "fillers"` and adds the corresponding tab buttons and conditional renders.

---

## Non-Goals (v2)

- Face detection / auto-reframe (Position API broken)
- Social media clip creator
- Preset system
- Batch processing
- Settings persistence
