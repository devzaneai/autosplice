export var initQE = function(): boolean {
  if (typeof qe === "undefined") {
    app.enableQE();
  }
  return typeof qe !== "undefined";
};

// Get ticks-per-frame for the active sequence
var getTicksPerFrame = function(): number {
  var seq = app.project.activeSequence;
  if (!seq) return 8475667200; // default 29.97fps
  var settings = seq.getSettings();
  return parseInt(settings.videoFrameRate.ticks, 10);
};

// Converts seconds to Premiere ticks, snapped to nearest frame boundary
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

// Close all gaps on a track by moving clips to fill empty spaces
var closeTrackGaps = function(trackRef: any, isQETrack: boolean): number {
  if (!isQETrack) return 0;
  var gapsClosed = 0;
  var numItems = trackRef.numItems;

  for (var i = 0; i < numItems; i++) {
    var item = trackRef.getItemAt(i);
    // QE DOM items have a type property: "Clip" or "Empty"
    //@ts-ignore
    if (item && item.type === "Empty") {
      // This is a gap — try to remove it
      //@ts-ignore
      item.remove(true, true);
      gapsClosed++;
      // After removing, indices shift, so restart
      numItems = trackRef.numItems;
      i = -1; // will be incremented to 0
    }
  }

  return gapsClosed;
};

export var applyJumpCuts = function(cutListJson: string): string {
  var cutList = JSON.parse(cutListJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  // Sort cuts in reverse to preserve timecodes
  cutList.sort(function(a: any, b: any) {
    return b.startTimecode - a.startTimecode;
  });

  var appliedCount = 0;
  var t, cut;

  if (cutList.length > 0 && cutList[0].action === "delete") {

    // Phase 1: Razor only video tracks at all cut points.
    // Premiere will auto-razor linked audio clips.
    for (var ci = 0; ci < cutList.length; ci++) {
      cut = cutList[ci];
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        razorAtTime(cut.startTimecode, t, true);
        razorAtTime(cut.endTimecode, t, true);
      }
    }

    // Phase 2: Extract each silent region (reverse order)
    for (var di = 0; di < cutList.length; di++) {
      cut = cutList[di];

      seq.setInPoint(secondsToFrameAlignedTicks(cut.startTimecode));
      seq.setOutPoint(secondsToFrameAlignedTicks(cut.endTimecode));

      if (initQE()) {
        qe.project.getActiveSequence().extract();
      }

      appliedCount++;
    }

    // Clear in/out points
    seq.setInPoint("");
    seq.setOutPoint("");

    // Phase 3: Close any remaining gaps on all tracks using QE DOM
    if (initQE()) {
      var qeSeq = qe.project.getActiveSequence();
      if (qeSeq) {
        // Close gaps on video tracks
        for (t = 0; t < seq.videoTracks.numTracks; t++) {
          var qeVTrack = qeSeq.getVideoTrackAt(t);
          if (qeVTrack) {
            closeTrackGaps(qeVTrack, true);
          }
        }
        // Close gaps on audio tracks
        for (t = 0; t < seq.audioTracks.numTracks; t++) {
          var qeATrack = qeSeq.getAudioTrackAt(t);
          if (qeATrack) {
            closeTrackGaps(qeATrack, true);
          }
        }
      }
    }

  } else {
    // Disable mode: razor and disable clips in each cut range
    var tolerance = 0.04;

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
        var vTrack = seq.videoTracks[t];
        for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
          var vClip = vTrack.clips[vc];
          if (vClip.start.seconds >= cut.startTimecode - tolerance &&
              vClip.end.seconds <= cut.endTimecode + tolerance) {
            vClip.disabled = true;
          }
        }
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        var aTrack2 = seq.audioTracks[t];
        for (var ac = 0; ac < aTrack2.clips.numItems; ac++) {
          var aClip = aTrack2.clips[ac];
          if (aClip.start.seconds >= cut.startTimecode - tolerance &&
              aClip.end.seconds <= cut.endTimecode + tolerance) {
            aClip.disabled = true;
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
