# AutoSplice v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features to AutoSplice: Combined Workflow (multi-cam + jump cut in one pass), Filler Word Detection (local Whisper), and Auto-Zoom on Active Speaker.

**Architecture:** Each feature builds on the existing CEP panel architecture. Combined Workflow orchestrates existing engines. Filler Detection adds a Whisper bridge for transcription + a filler matching engine. Auto-Zoom adds ExtendScript functions for Scale keyframes. All three share new types, defaults, and tab bar changes.

**Tech Stack:** Bolt CEP (React + TypeScript + Vite), whisper.cpp (bundled binary), ExtendScript (Motion/Scale keyframes), Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-autosplice-v2-design.md`

---

## Phase 1: Shared Foundation

### Task 1: Add v2 Types and Defaults

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/defaults.ts`

- [ ] **Step 1: Add filler types to `src/shared/types.ts`**

Append after the existing types:

```typescript
// ---- Filler Detection Types ----

export type FillerMode = "markers" | "remove";

export interface FillerSettings {
  readonly enabledFillers: readonly string[];
  readonly mode: FillerMode;
}

export interface FillerEntry {
  readonly word: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface FillerResult {
  readonly fillers: readonly FillerEntry[];
  readonly totalCount: number;
  readonly countsByWord: Record<string, number>;
}

// ---- Auto-Zoom Types ----

export interface AutoZoomSettings {
  readonly enabled: boolean;
  readonly zoomPercent: number;
  readonly animated: boolean;
  readonly easeDurationSeconds: number;
}

// ---- Full Edit Types ----

export interface FullEditSettings {
  readonly multiCam: MultiCamSettings;
  readonly jumpCut: JumpCutSettings;
  readonly autoZoom: AutoZoomSettings;
}
```

Also extend `AnalysisPhase` to include `"transcribing"`:

```typescript
export type AnalysisPhase =
  | "extracting"
  | "analyzing"
  | "detecting"
  | "transcribing"
  | "generating"
  | "complete"
  | "error";
```

- [ ] **Step 2: Add defaults to `src/shared/defaults.ts`**

```typescript
export const DEFAULT_FILLER_WORDS: readonly string[] = [
  "um", "umm", "uh", "uhh", "hmm", "hm",
  "like", "you know", "basically", "actually",
  "so", "right", "i mean",
] as const;

export const DEFAULT_FILLER_SETTINGS: FillerSettings = {
  enabledFillers: [...DEFAULT_FILLER_WORDS],
  mode: "markers",
} as const;

export const DEFAULT_AUTO_ZOOM: AutoZoomSettings = {
  enabled: false,
  zoomPercent: 108,
  animated: false,
  easeDurationSeconds: 0.5,
} as const;

export const DEFAULT_FULL_EDIT: FullEditSettings = {
  multiCam: DEFAULT_MULTI_CAM,
  jumpCut: DEFAULT_JUMP_CUT,
  autoZoom: DEFAULT_AUTO_ZOOM,
} as const;
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test && git add src/shared/ && git commit -m "feat: add v2 types and defaults (filler, auto-zoom, full edit)"
```

---

### Task 2: Update Tab Bar for 4 Tabs

**Files:**
- Modify: `src/js/main/main.tsx`
- Modify: `src/js/main/main.scss`

- [ ] **Step 1: Extend TabId and add new tab buttons**

In `main.tsx`, change `TabId` to:
```typescript
type TabId = "jumpcut" | "multicam" | "fulledit" | "fillers";
```

Add placeholder imports for new tabs (create empty components first):
```typescript
const FullEditTab = () => <div className="tab-content"><div className="scope-indicator">Full Edit — coming soon</div></div>;
const FillerTab = () => <div className="tab-content"><div className="scope-indicator">Fillers — coming soon</div></div>;
```

Add tab buttons for "Full Edit" and "Fillers" in the tab bar.

Add conditional renders:
```tsx
{activeTab === "fulledit" && <FullEditTab />}
{activeTab === "fillers" && <FillerTab />}
```

- [ ] **Step 2: Adjust tab styling for 4 tabs**

In `main.scss`, reduce tab font size to fit 4 tabs:
```scss
.tab {
  font-size: 11px;
  padding: 6px 8px;
}
```

- [ ] **Step 3: Build, verify, commit**

```bash
npm run build && git add src/js/main/ && git commit -m "feat: add 4-tab layout with placeholder Full Edit and Fillers tabs"
```

---

## Phase 2: Auto-Zoom (Simplest Feature First)

### Task 3: ExtendScript Zoom Operations

**Files:**
- Create: `src/jsx/ppro/zoom-ops.ts`
- Modify: `src/jsx/index.ts`

- [ ] **Step 1: Create `src/jsx/ppro/zoom-ops.ts`**

```typescript
export var applyAutoZoom = function(settingsJson: string): any {
  var settings = JSON.parse(settingsJson);
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

  var clips = settings.clips;
  var zoomPercent = settings.zoomPercent || 108;
  var animated = settings.animated || false;
  var easeDuration = settings.easeDurationSeconds || 0.5;
  var appliedCount = 0;

  for (var i = 0; i < clips.length; i++) {
    var sw = clips[i];
    var track = seq.videoTracks[sw.trackIndex];
    if (!track) continue;

    for (var c = 0; c < track.clips.numItems; c++) {
      var clip = track.clips[c];
      var mid = (clip.start.seconds + clip.end.seconds) / 2;

      if (mid >= sw.startTimecode && mid <= sw.endTimecode) {
        // Access Motion > Scale: components[1].properties[1]
        var motionComponent = clip.components[1];
        if (!motionComponent) continue;
        var scaleProp = motionComponent.properties[1];
        if (!scaleProp) continue;

        if (animated) {
          scaleProp.setTimeVarying(true);
          var startTicks = clip.start.ticks;
          var easeTicks = parseInt(startTicks, 10) + Math.round(easeDuration * 254016000000);
          var easeTime = new Time();
          easeTime.ticks = easeTicks.toString();

          scaleProp.addKey(clip.start);
          scaleProp.setValueAtKey(clip.start, 100, true);
          scaleProp.addKey(easeTime);
          scaleProp.setValueAtKey(easeTime, zoomPercent, true);
        } else {
          scaleProp.setValue(zoomPercent, true);
        }

        appliedCount++;
        break;
      }
    }
  }

  return { success: true, zoomApplied: appliedCount };
};
```

NOTE: Return plain object, NOT JSON.stringify (evalTS handles serialization).

- [ ] **Step 2: Register in `src/jsx/index.ts`**

Add import and merge:
```typescript
import * as zoomOps from "./ppro/zoom-ops";
// In the merge loop:
for (k in zoomOps) { allFunctions[k] = (zoomOps as any)[k]; }
```

Update Scripts type:
```typescript
export type Scripts = typeof ppro & typeof timelineOps & typeof zoomOps;
```

Wait — we use `for...in` loops, not the `&` type. The type should match. Since we use `var allFunctions: any = {}`, the Scripts type is just informational. Add:
```typescript
for (k in zoomOps) { allFunctions[k] = (zoomOps as any)[k]; }
```

- [ ] **Step 3: Build, commit**

```bash
npm run build && git add src/jsx/ && git commit -m "feat: add ExtendScript auto-zoom with Scale keyframes"
```

---

### Task 4: Auto-Zoom UI in Multi-Cam Tab

**Files:**
- Modify: `src/js/main/components/MultiCamTab.tsx`

- [ ] **Step 1: Add auto-zoom settings state and UI**

Add to MultiCamTab:
- `autoZoomSettings` state using `DEFAULT_AUTO_ZOOM`
- Collapsible "Auto-Zoom" section with:
  - Enable toggle (checkbox)
  - Zoom amount slider (100-120%, default 108%)
  - Mode toggle (Instant / Animated)
  - Ease duration slider (0.2-1.0s, only visible when animated)

- [ ] **Step 2: Wire auto-zoom into handleApply**

After `applyMultiCamSwitches` completes, if auto-zoom is enabled:
```typescript
if (autoZoomSettings.enabled && result) {
  const evalTS = await getEvalTS();
  const zoomClips = result.switches.map(sw => ({
    trackIndex: sw.cameraTrackIndex,
    startTimecode: sw.startTimecode,
    endTimecode: sw.endTimecode,
  }));
  await evalTS("applyAutoZoom", JSON.stringify({
    clips: zoomClips,
    zoomPercent: autoZoomSettings.zoomPercent,
    animated: autoZoomSettings.animated,
    easeDurationSeconds: autoZoomSettings.easeDurationSeconds,
  }));
}
```

- [ ] **Step 3: Build, commit**

```bash
npm run build && git add src/js/main/components/MultiCamTab.tsx && git commit -m "feat: add auto-zoom controls to Multi-Cam tab"
```

---

## Phase 3: Filler Word Detection

### Task 5: Filler Detector Engine (Pure Logic, Testable)

**Files:**
- Create: `src/js/engine/filler-detector.ts`
- Create: `tests/engine/filler-detector.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { detectFillers } from "../../src/js/engine/filler-detector";

describe("detectFillers", () => {
  it("detects single-word fillers", () => {
    const words = [
      { word: "so", start: 0, end: 0.3 },
      { word: "um", start: 0.5, end: 0.8 },
      { word: "I", start: 1.0, end: 1.1 },
      { word: "think", start: 1.2, end: 1.5 },
    ];
    const fillers = detectFillers(words, ["um", "uh"]);
    expect(fillers.length).toBe(1);
    expect(fillers[0].word).toBe("um");
    expect(fillers[0].startSeconds).toBe(0.5);
  });

  it("detects multi-word fillers (you know)", () => {
    const words = [
      { word: "you", start: 1.0, end: 1.2 },
      { word: "know", start: 1.3, end: 1.5 },
      { word: "it's", start: 1.6, end: 1.8 },
    ];
    const fillers = detectFillers(words, ["you know"]);
    expect(fillers.length).toBe(1);
    expect(fillers[0].word).toBe("you know");
    expect(fillers[0].startSeconds).toBe(1.0);
    expect(fillers[0].endSeconds).toBe(1.5);
  });

  it("is case-insensitive", () => {
    const words = [{ word: "Um", start: 0, end: 0.3 }];
    const fillers = detectFillers(words, ["um"]);
    expect(fillers.length).toBe(1);
  });

  it("returns empty for no matches", () => {
    const words = [{ word: "hello", start: 0, end: 0.5 }];
    const fillers = detectFillers(words, ["um", "uh"]);
    expect(fillers.length).toBe(0);
  });
});
```

- [ ] **Step 2: Implement filler detector**

```typescript
import type { FillerEntry } from "../../shared/types";

export interface WhisperWord {
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

export const detectFillers = (
  words: readonly WhisperWord[],
  enabledFillers: readonly string[]
): FillerEntry[] => {
  const results: FillerEntry[] = [];
  const singleFillers = enabledFillers.filter(f => !f.includes(" "));
  const multiFillers = enabledFillers.filter(f => f.includes(" "));

  for (let i = 0; i < words.length; i++) {
    const w = words[i].word.toLowerCase().replace(/[.,!?]/g, "");

    // Check single-word fillers
    if (singleFillers.includes(w)) {
      results.push({
        word: w,
        startSeconds: words[i].start,
        endSeconds: words[i].end,
      });
      continue;
    }

    // Check multi-word fillers
    for (const mf of multiFillers) {
      const parts = mf.split(" ");
      if (i + parts.length > words.length) continue;

      let matches = true;
      for (let j = 0; j < parts.length; j++) {
        const wj = words[i + j].word.toLowerCase().replace(/[.,!?]/g, "");
        if (wj !== parts[j]) { matches = false; break; }
      }

      if (matches) {
        results.push({
          word: mf,
          startSeconds: words[i].start,
          endSeconds: words[i + parts.length - 1].end,
        });
        i += parts.length - 1; // skip matched words
        break;
      }
    }
  }

  return results;
};
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test && git add src/js/engine/filler-detector.ts tests/engine/filler-detector.test.ts && git commit -m "feat: add filler word detector with multi-word support"
```

---

### Task 6: Whisper Bridge

**Files:**
- Create: `src/js/engine/whisper-bridge.ts`

- [ ] **Step 1: Implement whisper bridge**

```typescript
import { child_process, fs, os, path } from "../lib/cep/node";
import { csi } from "../lib/utils/bolt";
import type { AnalysisProgress } from "../../shared/types";

type ProgressCallback = (progress: AnalysisProgress) => void;

const getWhisperPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") {
    const binary = arch === "arm64" ? "whisper-cpp-mac-arm64" : "whisper-cpp-mac-x64";
    return path.join(extRoot, "bin", binary);
  } else if (platform === "win32") {
    return path.join(extRoot, "bin", "whisper-cpp-win-x64.exe");
  }

  throw new Error(`Unsupported platform: ${platform}`);
};

const getModelPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "bin", "models", "ggml-small-q5_1.bin");
};

export interface WhisperSegment {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

export const transcribeAudio = (
  wavPath: string,
  onProgress: ProgressCallback
): Promise<WhisperSegment[]> => {
  return new Promise((resolve, reject) => {
    const whisperPath = getWhisperPath();
    const modelPath = getModelPath();

    if (!fs.existsSync(whisperPath)) {
      reject(new Error("Whisper not found — try reinstalling AutoSplice"));
      return;
    }
    if (!fs.existsSync(modelPath)) {
      reject(new Error("Whisper model not found in bin/models/"));
      return;
    }

    onProgress({ phase: "transcribing", percent: 10, message: "Starting transcription..." });

    const outputPath = wavPath.replace(".wav", ".json");

    const args = [
      "-m", modelPath,
      "-f", wavPath,
      "-ml", "1",
      "--split-on-word",
      "-oj",
      "--prompt", "Um, uh, like, you know",
      "-of", wavPath.replace(".wav", ""),
    ];

    const proc = child_process.spawn(whisperPath, args);
    let stderr = "";

    proc.stderr.on("data", (data: Buffer) => {
      const line = data.toString();
      stderr += line;
      // Parse progress from whisper-cpp stderr
      const match = line.match(/(\d+)%/);
      if (match) {
        const pct = parseInt(match[1], 10);
        onProgress({
          phase: "transcribing",
          percent: 10 + Math.round(pct * 0.8),
          message: `Transcribing... ${pct}%`,
        });
      }
    });

    proc.on("close", (code: number) => {
      if (code !== 0) {
        reject(new Error(`Whisper exited with code ${code}: ${stderr.slice(-200)}`));
        return;
      }

      try {
        const jsonContent = fs.readFileSync(outputPath, "utf-8");
        const parsed = JSON.parse(jsonContent);
        const segments: WhisperSegment[] = (parsed.transcription || []).map((seg: any) => ({
          text: (seg.text || "").trim(),
          start: seg.timestamps?.from ? parseTimestamp(seg.timestamps.from) : 0,
          end: seg.timestamps?.to ? parseTimestamp(seg.timestamps.to) : 0,
        }));
        resolve(segments);
      } catch (err) {
        reject(new Error("Transcription failed — could not parse results"));
      }
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Failed to start Whisper: ${err.message}`));
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      proc.kill();
      reject(new Error("Transcription timed out (>10 min)"));
    }, 600000);
  });
};

// Parse whisper timestamp "00:01:23.456" to seconds
const parseTimestamp = (ts: string): number => {
  const parts = ts.split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return parseFloat(ts);
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/engine/whisper-bridge.ts && git commit -m "feat: add whisper bridge for local audio transcription"
```

---

### Task 7: ExtendScript Marker Functions

**Files:**
- Create: `src/jsx/ppro/markers.ts`
- Modify: `src/jsx/index.ts`

- [ ] **Step 1: Create `src/jsx/ppro/markers.ts`**

```typescript
export var addFillerMarkers = function(markersJson: string): any {
  var markers = JSON.parse(markersJson);
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

  var addedCount = 0;
  for (var i = 0; i < markers.length; i++) {
    var m = markers[i];
    var time = new Time();
    time.seconds = m.startSeconds;

    var marker = seq.markers.createMarker(parseFloat(time.ticks));
    if (marker) {
      marker.name = m.word;
      marker.comments = "Filler word detected by AutoSplice";
      // Set marker color to red (index 1)
      marker.setColorByIndex(1);
      addedCount++;
    }
  }

  return { success: true, markersAdded: addedCount };
};
```

- [ ] **Step 2: Register in `src/jsx/index.ts`**

Add import and merge loop for markers module.

- [ ] **Step 3: Build, commit**

```bash
npm run build && git add src/jsx/ && git commit -m "feat: add ExtendScript marker functions for filler word annotation"
```

---

### Task 8: Fillers Tab UI

**Files:**
- Create: `src/js/main/components/FillerTab.tsx`
- Modify: `src/js/main/main.tsx` (replace placeholder)

- [ ] **Step 1: Create FillerTab component**

Full React component with:
- Status label (scope indicator style)
- Filler word checklist (checkboxes for each word in DEFAULT_FILLER_WORDS)
- Mode selector: Markers (default) / Remove
- Analyze button → calls FFmpeg audio extraction, then whisper bridge, then filler detector
- Results summary: "Found 23 fillers (8 um, 6 uh, ...)"
- Apply button → calls addFillerMarkers (marker mode) or applyJumpCuts (remove mode)
- Progress bar for Whisper transcription
- Error handling matching existing patterns (lazy imports for CEP modules)

- [ ] **Step 2: Replace placeholder in main.tsx**

Import the real FillerTab and replace the placeholder.

- [ ] **Step 3: Build, commit**

```bash
npm run build && git add src/js/main/ && git commit -m "feat: add Fillers tab with Whisper transcription and filler detection"
```

---

## Phase 4: Combined Workflow

### Task 9: Full Edit Engine

**Files:**
- Create: `src/js/engine/full-edit-engine.ts`

- [ ] **Step 1: Create orchestrator engine**

```typescript
import type {
  MultiCamSettings, JumpCutSettings, AutoZoomSettings,
  MultiCamResult, JumpCutResult, AnalysisProgress
} from "../../shared/types";

type ProgressCallback = (progress: AnalysisProgress) => void;

export interface FullEditResult {
  readonly multiCamResult: MultiCamResult;
  readonly jumpCutResult: JumpCutResult;
}

export const analyzeFullEdit = async (
  multiCamSettings: MultiCamSettings,
  jumpCutSettings: JumpCutSettings,
  onProgress: ProgressCallback
): Promise<FullEditResult> => {
  // Phase 1: Multi-cam analysis
  onProgress({ phase: "analyzing", percent: 10, message: "Analyzing speakers..." });
  const { analyzeMultiCam } = await import("./multi-cam-engine");
  const multiCamResult = await analyzeMultiCam(multiCamSettings, (p) => {
    onProgress({ ...p, percent: Math.round(p.percent * 0.5), message: `Multi-cam: ${p.message}` });
  });

  // Phase 2: Jump cut analysis
  onProgress({ phase: "detecting", percent: 55, message: "Detecting silence..." });
  const { analyzeJumpCuts } = await import("./jump-cut-engine");
  const jumpCutResult = await analyzeJumpCuts(jumpCutSettings, (p) => {
    onProgress({ ...p, percent: 50 + Math.round(p.percent * 0.5), message: `Jump cut: ${p.message}` });
  });

  onProgress({ phase: "complete", percent: 100, message: "Analysis complete" });

  return { multiCamResult, jumpCutResult };
};
```

- [ ] **Step 2: Commit**

```bash
git add src/js/engine/full-edit-engine.ts && git commit -m "feat: add full edit engine orchestrating multi-cam + jump cut"
```

---

### Task 10: Full Edit Tab UI

**Files:**
- Create: `src/js/main/components/FullEditTab.tsx`
- Modify: `src/js/main/main.tsx` (replace placeholder)

- [ ] **Step 1: Create FullEditTab component**

Combines:
- SpeakerMap component (from MultiCamTab)
- Silence settings: threshold, min duration, padding sliders (from JumpCutTab)
- Auto-zoom collapsible section
- Wide shot track selector
- Single Analyze → runs full edit engine
- Single Apply → calls applyMultiCamSwitches, then applyAutoZoom (if enabled), then applyJumpCuts
- Preview showing camera switches
- Status/progress reporting

- [ ] **Step 2: Replace placeholder in main.tsx**

Import the real FullEditTab and replace the placeholder.

- [ ] **Step 3: Build, commit**

```bash
npm run build && git add src/js/main/ && git commit -m "feat: add Full Edit tab combining multi-cam + jump cut + auto-zoom"
```

---

## Phase 5: Whisper Binary Bundling & Distribution

### Task 11: Whisper Binary Setup

**Files:**
- Create: `scripts/package-whisper.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Create whisper download script**

```bash
#!/bin/bash
# scripts/package-whisper.sh
# Downloads whisper.cpp binaries and small model for bundling

set -e
OUTDIR="src/bin"
MODELDIR="$OUTDIR/models"
mkdir -p "$MODELDIR"

echo "=== AutoSplice Whisper Packager ==="

# macOS arm64 (with Metal)
echo "Downloading whisper-cpp for macOS arm64..."
# Use Homebrew or pre-built binary from GitHub releases
if command -v brew &>/dev/null; then
  brew install whisper-cpp 2>/dev/null || true
  cp $(brew --prefix whisper-cpp)/bin/whisper-cpp "$OUTDIR/whisper-cpp-mac-arm64" 2>/dev/null || \
  cp $(which whisper-cpp) "$OUTDIR/whisper-cpp-mac-arm64" 2>/dev/null || \
  echo "Could not find whisper-cpp via Homebrew"
fi

# Download quantized small model
echo "Downloading ggml-small-q5_1 model (182MB)..."
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin" \
  -o "$MODELDIR/ggml-small-q5_1.bin"

echo ""
echo "Whisper setup complete!"
ls -lh "$OUTDIR/whisper-cpp-"* 2>/dev/null
ls -lh "$MODELDIR/"*.bin 2>/dev/null
```

- [ ] **Step 2: Update .gitignore**

Add:
```
src/bin/whisper-cpp-*
src/bin/models/
```

- [ ] **Step 3: Commit**

```bash
chmod +x scripts/package-whisper.sh && git add scripts/package-whisper.sh .gitignore && git commit -m "feat: add whisper binary and model packaging script"
```

---

### Task 12: Final Build, Test, and Push

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

- [ ] **Step 3: Install and test in Premiere**

```bash
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/autosplice"
chmod -R u+w "$DEST/"
rm -rf "$DEST/assets" "$DEST/main" "$DEST/jsx" "$DEST/CSXS"
cp -R dist/cep/* "$DEST/"
cp dist/cep/.debug "$DEST/.debug"
```

- [ ] **Step 4: Commit and push**

```bash
git add -A && git commit -m "chore: v2 build verification" && git push
```

---

## Summary

| Phase | Tasks | Features |
|---|---|---|
| 1: Foundation | 1-2 | Types, defaults, tab bar |
| 2: Auto-Zoom | 3-4 | ExtendScript zoom + Multi-Cam UI |
| 3: Fillers | 5-8 | Filler detector, Whisper bridge, markers, UI |
| 4: Combined | 9-10 | Full edit engine + UI |
| 5: Distribution | 11-12 | Whisper binaries, final build |

**Total: 12 tasks**

---

## Implementation Notes

- All new ExtendScript functions must return plain objects (NOT JSON.stringify) — evalTS handles serialization
- All new ExtendScript must use ES3 syntax (var, function(){}, for loops, no const/let/arrow/spread)
- QE DOM razor takes timecode strings from `Time.getFormatted()`, NOT ticks
- All CEP-dependent imports in React components must be lazy (dynamic import) to prevent panel crash
- The `whisper-bridge.ts` imports from `../lib/cep/node` at the top level — this is fine since it's only loaded via dynamic import when the user clicks Analyze
