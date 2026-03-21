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

// Check if a clip's center falls within any silence region
var isInSilenceRegion = function(clipStartSec: number, clipEndSec: number, cuts: any[], tolerance: number): boolean {
  var clipCenter = (clipStartSec + clipEndSec) / 2;
  for (var i = 0; i < cuts.length; i++) {
    var cut = cuts[i];
    if (clipCenter >= cut.startTimecode - tolerance &&
        clipCenter <= cut.endTimecode + tolerance) {
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
  var tolerance = 0.04;

  if (cutList.length > 0 && cutList[0].action === "delete") {

    // =====================================================
    // PHASE 1: Razor at ALL cut boundaries on ALL tracks
    // Both video AND audio must be razored explicitly.
    // =====================================================
    for (var ci = 0; ci < cutList.length; ci++) {
      cut = cutList[ci];
      // Razor every video track
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
      // Razor every audio track explicitly
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, false);
        razorAtTime(cut.endTimecode, t, false);
      }
    }

    // =====================================================
    // PHASE 2: Remove silent clips with ripple delete.
    // Process ALL tracks. Reverse index order so indices
    // don't shift as we remove.
    // =====================================================

    // Video tracks
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      var vTrack = seq.videoTracks[t];
      for (var vc = vTrack.clips.numItems - 1; vc >= 0; vc--) {
        var vClip = vTrack.clips[vc];
        if (isInSilenceRegion(vClip.start.seconds, vClip.end.seconds, cutList, tolerance)) {
          vClip.remove(true, true);
        }
      }
    }

    // Audio tracks
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      var aTrack = seq.audioTracks[t];
      for (var ac = aTrack.clips.numItems - 1; ac >= 0; ac--) {
        var aClip = aTrack.clips[ac];
        if (isInSilenceRegion(aClip.start.seconds, aClip.end.seconds, cutList, tolerance)) {
          aClip.remove(true, true);
        }
      }
    }

    return JSON.stringify({ success: true, cutsApplied: cutList.length });

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
          if (isInSilenceRegion(dvClip.start.seconds, dvClip.end.seconds, [cut], tolerance)) {
            dvClip.disabled = true;
          }
        }
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        var dat = seq.audioTracks[t];
        for (var dac = 0; dac < dat.clips.numItems; dac++) {
          var daClip = dat.clips[dac];
          if (isInSilenceRegion(daClip.start.seconds, daClip.end.seconds, [cut], tolerance)) {
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
  var tolerance = 0.04;
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
        if (clip.start.seconds >= sw.startTimecode - tolerance &&
            clip.end.seconds <= sw.endTimecode + tolerance) {
          clip.disabled = (t !== sw.cameraTrackIndex);
        }
      }
    }
  }

  return JSON.stringify({ success: true, switchesApplied: switches.length });
};
