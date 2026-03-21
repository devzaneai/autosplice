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
    if (vTrack) {
      vTrack.razor(ticks);
      return true;
    }
  } else {
    var aTrack = seq.getAudioTrackAt(trackIndex);
    if (aTrack) {
      aTrack.razor(ticks);
      return true;
    }
  }

  return false;
};

// Close gaps on a track by finding empty items and ripple-removing them
var closeTrackGapsQE = function(qeTrack: any): void {
  // Scan for empty items and remove them, which should close the gap
  // Restart from beginning each time since indices shift
  var maxPasses = 500; // safety limit
  var pass = 0;

  while (pass < maxPasses) {
    var foundGap = false;
    var numItems = qeTrack.numItems;

    for (var i = 0; i < numItems; i++) {
      var item = qeTrack.getItemAt(i);
      //@ts-ignore
      if (item && item.type === "Empty") {
        //@ts-ignore
        item.remove(true, true); // ripple delete the empty space
        foundGap = true;
        break; // restart scan since indices shifted
      }
    }

    if (!foundGap) break;
    pass++;
  }
};

// Alternative: close gaps by moving clips on a standard API track
var closeTrackGapsStandard = function(track: any): void {
  var expectedStartTicks = "0";

  for (var i = 0; i < track.clips.numItems; i++) {
    var clip = track.clips[i];
    var clipStartTicks = clip.start.ticks;

    if (clipStartTicks !== expectedStartTicks) {
      // There's a gap — move this clip to close it
      var gapTicks = parseInt(clipStartTicks, 10) - parseInt(expectedStartTicks, 10);
      if (gapTicks > 0) {
        // Create a Time object for the offset
        var moveTime = new Time();
        moveTime.ticks = (-gapTicks).toString();
        clip.move(moveTime);
      }
    }

    // After potential move, recalculate end position
    expectedStartTicks = track.clips[i].end.ticks;
  }
};

export var applyJumpCuts = function(cutListJson: string): string {
  var cutList = JSON.parse(cutListJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  // Sort cuts in reverse for razor phase
  cutList.sort(function(a: any, b: any) {
    return b.startTimecode - a.startTimecode;
  });

  var appliedCount = 0;
  var t, cut;

  if (cutList.length > 0 && cutList[0].action === "delete") {

    // Phase 1: Razor at all cut boundaries (video tracks only; linked audio follows)
    for (var ci = 0; ci < cutList.length; ci++) {
      cut = cutList[ci];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
    }

    // Phase 2: Disable clips in silent regions (instead of extract)
    // This is reliable — it marks clips without removing them
    var tolerance = 0.04;
    for (var di = 0; di < cutList.length; di++) {
      cut = cutList[di];

      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        var vTrack = seq.videoTracks[t];
        for (var vc = vTrack.clips.numItems - 1; vc >= 0; vc--) {
          var vClip = vTrack.clips[vc];
          if (vClip.start.seconds >= cut.startTimecode - tolerance &&
              vClip.end.seconds <= cut.endTimecode + tolerance &&
              vClip.start.seconds < cut.endTimecode &&
              vClip.end.seconds > cut.startTimecode) {
            vClip.disabled = true;
          }
        }
      }

      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        var aTrack = seq.audioTracks[t];
        for (var ac = aTrack.clips.numItems - 1; ac >= 0; ac--) {
          var aClip = aTrack.clips[ac];
          if (aClip.start.seconds >= cut.startTimecode - tolerance &&
              aClip.end.seconds <= cut.endTimecode + tolerance &&
              aClip.start.seconds < cut.endTimecode &&
              aClip.end.seconds > cut.startTimecode) {
            aClip.disabled = true;
          }
        }
      }

      appliedCount++;
    }

    // Phase 3: Remove disabled clips and close gaps
    // First, remove all disabled clips from all tracks
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      var vt = seq.videoTracks[t];
      for (var vr = vt.clips.numItems - 1; vr >= 0; vr--) {
        if (vt.clips[vr].disabled) {
          // Use setInPoint/setOutPoint to shrink clip to zero, effectively removing it
          // Or try direct removal approaches
        }
      }
    }

    // Phase 3 (actual): Use QE DOM to find and remove empty/disabled items, then close gaps
    if (initQE()) {
      var qeSeq = qe.project.getActiveSequence();
      if (qeSeq) {
        // Set in/out for each disabled region and extract one by one (reverse order)
        // Since extract does a LIFT, we then close gaps manually
        for (var ei = 0; ei < cutList.length; ei++) {
          cut = cutList[ei]; // already reverse sorted
          seq.setInPoint(secondsToFrameAlignedTicks(cut.startTimecode));
          seq.setOutPoint(secondsToFrameAlignedTicks(cut.endTimecode));
          qeSeq.extract();
        }
        seq.setInPoint("");
        seq.setOutPoint("");

        // Now close all gaps on every track
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          var qeVT = qeSeq.getVideoTrackAt(t);
          if (qeVT) closeTrackGapsQE(qeVT);
        }
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          var qeAT = qeSeq.getAudioTrackAt(t);
          if (qeAT) closeTrackGapsQE(qeAT);
        }
      }
    }

    // Phase 4: Fallback — also try standard API gap closing
    // In case QE gap closing didn't work, shift clips using the standard API
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      closeTrackGapsStandard(seq.videoTracks[t]);
    }
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      closeTrackGapsStandard(seq.audioTracks[t]);
    }

  } else {
    // Disable mode only — no removal, just mark clips
    var dtolerance = 0.04;
    for (var rci = 0; rci < cutList.length; rci++) {
      cut = cutList[rci];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
    }

    for (var dsi = 0; dsi < cutList.length; dsi++) {
      cut = cutList[dsi];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        var dvt = seq.videoTracks[t];
        for (var dvc = 0; dvc < dvt.clips.numItems; dvc++) {
          var dvClip = dvt.clips[dvc];
          if (dvClip.start.seconds >= cut.startTimecode - dtolerance &&
              dvClip.end.seconds <= cut.endTimecode + dtolerance) {
            dvClip.disabled = true;
          }
        }
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        var dat = seq.audioTracks[t];
        for (var dac = 0; dac < dat.clips.numItems; dac++) {
          var daClip = dat.clips[dac];
          if (daClip.start.seconds >= cut.startTimecode - dtolerance &&
              daClip.end.seconds <= cut.endTimecode + dtolerance) {
            daClip.disabled = true;
          }
        }
      }
      appliedCount++;
    }
  }

  return JSON.stringify({ success: true, cutsApplied: appliedCount });
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
    if (!seen[sw.startTimecode]) {
      timePoints.push(sw.startTimecode);
      seen[sw.startTimecode] = true;
    }
    if (!seen[sw.endTimecode]) {
      timePoints.push(sw.endTimecode);
      seen[sw.endTimecode] = true;
    }
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
