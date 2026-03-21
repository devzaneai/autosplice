export var initQE = function(): boolean {
  if (typeof qe === "undefined") {
    app.enableQE();
  }
  return typeof qe !== "undefined";
};

var getTicksPerFrame = function(): number {
  var seq = app.project.activeSequence;
  if (!seq) return 8475667200;
  var settings = seq.getSettings();
  return parseInt(settings.videoFrameRate.ticks, 10);
};

var secondsToFrameAlignedTicks = function(seconds: number): string {
  var rawTicks = seconds * 254016000000;
  var ticksPerFrame = getTicksPerFrame();
  var frameNumber = Math.round(rawTicks / ticksPerFrame);
  return (frameNumber * ticksPerFrame).toString();
};

export var razorAtTime = function(timeSeconds: number, trackIndex: number, isVideo: boolean): boolean {
  if (!initQE()) return false;
  var seq = qe.project.getActiveSequence();
  if (!seq) return false;
  var ticks = secondsToFrameAlignedTicks(timeSeconds);
  if (isVideo) {
    var vTrack = seq.getVideoTrackAt(trackIndex);
    if (vTrack) { vTrack.razor(ticks); return true; }
  } else {
    var aTrack = seq.getAudioTrackAt(trackIndex);
    if (aTrack) { aTrack.razor(ticks); return true; }
  }
  return false;
};

// Check if a clip should be removed.
// After razor, each clip should be fully inside or outside a cut region.
// A clip matches a cut if it overlaps with the cut region by more than 50%.
var shouldRemoveClip = function(clipStart: number, clipEnd: number, cuts: any[]): boolean {
  var clipDuration = clipEnd - clipStart;
  if (clipDuration < 0.001) return false; // skip zero-duration clips

  for (var i = 0; i < cuts.length; i++) {
    var cut = cuts[i];
    // Calculate overlap between clip and cut region
    var overlapStart = Math.max(clipStart, cut.startTimecode);
    var overlapEnd = Math.min(clipEnd, cut.endTimecode);
    var overlap = Math.max(0, overlapEnd - overlapStart);

    // Remove if more than 50% of the clip is inside the cut region
    if (overlap > clipDuration * 0.5) {
      return true;
    }
  }
  return false;
};

export var applyJumpCuts = function(cutListJson: string): string {
  var cutList = JSON.parse(cutListJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  var t, cut;

  if (cutList.length > 0 && cutList[0].action === "delete") {

    // =====================================================
    // PHASE 1: Razor at ALL cut boundaries on ALL tracks
    // =====================================================
    for (var ci = 0; ci < cutList.length; ci++) {
      cut = cutList[ci];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, false);
        razorAtTime(cut.endTimecode, t, false);
      }
    }

    // =====================================================
    // PHASE 2: Remove silent clips with ripple delete.
    // Process each track in reverse index order.
    // Use overlap-based matching (>50% inside a cut region).
    // =====================================================

    // Count for diagnostics
    var vRemovedCount = 0;
    var vKeptCount = 0;
    var aRemovedCount = 0;
    var aKeptCount = 0;

    // Video tracks
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      var vTrack = seq.videoTracks[t];
      for (var vc = vTrack.clips.numItems - 1; vc >= 0; vc--) {
        var vClip = vTrack.clips[vc];
        if (shouldRemoveClip(vClip.start.seconds, vClip.end.seconds, cutList)) {
          vClip.remove(true, true);
          vRemovedCount++;
        } else {
          vKeptCount++;
        }
      }
    }

    // Audio tracks
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      var aTrack = seq.audioTracks[t];
      for (var ac = aTrack.clips.numItems - 1; ac >= 0; ac--) {
        var aClip = aTrack.clips[ac];
        if (shouldRemoveClip(aClip.start.seconds, aClip.end.seconds, cutList)) {
          aClip.remove(true, true);
          aRemovedCount++;
        } else {
          aKeptCount++;
        }
      }
    }

    return JSON.stringify({
      success: true,
      cutsApplied: cutList.length,
      videoRemoved: vRemovedCount,
      videoKept: vKeptCount,
      audioRemoved: aRemovedCount,
      audioKept: aKeptCount
    });

  } else {
    // =====================================================
    // DISABLE MODE
    // =====================================================
    for (var rci = 0; rci < cutList.length; rci++) {
      cut = cutList[rci];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, false);
        razorAtTime(cut.endTimecode, t, false);
      }
    }
    for (var dsi = 0; dsi < cutList.length; dsi++) {
      cut = cutList[dsi];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        var dvt = seq.videoTracks[t];
        for (var dvc = 0; dvc < dvt.clips.numItems; dvc++) {
          var dvClip = dvt.clips[dvc];
          if (shouldRemoveClip(dvClip.start.seconds, dvClip.end.seconds, [cut])) {
            dvClip.disabled = true;
          }
        }
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        var dat = seq.audioTracks[t];
        for (var dac = 0; dac < dat.clips.numItems; dac++) {
          var daClip = dat.clips[dac];
          if (shouldRemoveClip(daClip.start.seconds, daClip.end.seconds, [cut])) {
            daClip.disabled = true;
          }
        }
      }
    }
    return JSON.stringify({ success: true, cutsApplied: cutList.length });
  }
};

export var applyMultiCamSwitches = function(switchesJson: string): string {
  var switches = JSON.parse(switchesJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  var timePoints: number[] = [];
  var sw;
  var seen: any = {};
  for (var si = 0; si < switches.length; si++) {
    sw = switches[si];
    if (!seen[sw.startTimecode]) { timePoints.push(sw.startTimecode); seen[sw.startTimecode] = true; }
    if (!seen[sw.endTimecode]) { timePoints.push(sw.endTimecode); seen[sw.endTimecode] = true; }
  }

  var t, c, track, clip;
  for (var ti = 0; ti < timePoints.length; ti++) {
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      razorAtTime(timePoints[ti], t, true);
    }
  }

  for (var si2 = 0; si2 < switches.length; si2++) {
    sw = switches[si2];
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      track = seq.videoTracks[t];
      for (c = 0; c < track.clips.numItems; c++) {
        clip = track.clips[c];
        if (shouldRemoveClip(clip.start.seconds, clip.end.seconds, [sw])) {
          clip.disabled = (t !== sw.cameraTrackIndex);
        }
      }
    }
  }

  return JSON.stringify({ success: true, switchesApplied: switches.length });
};
