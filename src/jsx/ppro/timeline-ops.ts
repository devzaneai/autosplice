export var initQE = function(): boolean {
  if (typeof qe === "undefined") {
    app.enableQE();
  }
  return typeof qe !== "undefined";
};

export var razorAtTime = function(timeSeconds: number, trackIndex: number, isVideo: boolean): boolean {
  if (!initQE()) return false;

  var seq = qe.project.getActiveSequence();
  if (!seq) return false;

  var ticks = Math.round(timeSeconds * 254016000000).toString();

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

// Converts seconds to Premiere's internal time code ticks string
var secondsToTicks = function(seconds: number): string {
  return Math.round(seconds * 254016000000).toString();
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

  // Phase 1: Razor all cuts first
  for (var ci = 0; ci < cutList.length; ci++) {
    cut = cutList[ci];
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      razorAtTime(cut.startTimecode, t, false);
      razorAtTime(cut.endTimecode, t, false);
    }
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      razorAtTime(cut.startTimecode, t, true);
      razorAtTime(cut.endTimecode, t, true);
    }
  }

  // Phase 2: Remove or disable the silent sections
  if (cutList.length > 0 && cutList[0].action === "delete") {
    // Use Premiere's in/out point + extract approach (most reliable)
    // Process in reverse order so earlier timecodes stay valid
    for (var di = 0; di < cutList.length; di++) {
      cut = cutList[di]; // already sorted in reverse

      // Set in and out points on the sequence
      var inTime = new Time();
      inTime.ticks = secondsToTicks(cut.startTimecode);
      var outTime = new Time();
      outTime.ticks = secondsToTicks(cut.endTimecode);

      seq.setInPoint(inTime.ticks);
      seq.setOutPoint(outTime.ticks);

      // Execute "Extract" command (ripple delete between in/out)
      // Extract = Premiere menu Edit > Extract (shortcut: ')
      // This removes content between in/out and closes the gap
      if (initQE()) {
        qe.project.getActiveSequence().extract();
      }

      appliedCount++;
    }

    // Clear in/out points after we're done
    seq.setInPoint("");
    seq.setOutPoint("");

  } else {
    // Disable mode: disable clips in each cut range
    var tolerance = 0.04;
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
        var aTrack = seq.audioTracks[t];
        for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
          var aClip = aTrack.clips[ac];
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
