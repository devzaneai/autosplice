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

export var applyJumpCuts = function(cutListJson: string): string {
  var cutList = JSON.parse(cutListJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  // Sort cuts in reverse to preserve timecodes when deleting
  cutList.sort(function(a: any, b: any) {
    return b.startTimecode - a.startTimecode;
  });

  var appliedCount = 0;
  var t, c, cut, track, clip;
  var tolerance = 0.04; // ~1 frame at 30fps

  for (var ci = 0; ci < cutList.length; ci++) {
    cut = cutList[ci];

    // Razor at start and end on all tracks
    for (t = 0; t < seq.audioTracks.numTracks; t++) {
      razorAtTime(cut.startTimecode, t, false);
      razorAtTime(cut.endTimecode, t, false);
    }
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
      razorAtTime(cut.startTimecode, t, true);
      razorAtTime(cut.endTimecode, t, true);
    }

    if (cut.action === "delete") {
      // After razoring, find clips that fall within the cut range and remove them.
      // A clip is "inside" the cut if its start >= cut start AND its end <= cut end.
      // We iterate in reverse so removing doesn't shift indices.

      // Process video tracks
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        track = seq.videoTracks[t];
        for (c = track.clips.numItems - 1; c >= 0; c--) {
          clip = track.clips[c];
          var clipStart = clip.start.seconds;
          var clipEnd = clip.end.seconds;
          // Check if clip is fully inside the cut range
          if (clipStart >= cut.startTimecode - tolerance &&
              clipEnd <= cut.endTimecode + tolerance &&
              clipStart < cut.endTimecode &&
              clipEnd > cut.startTimecode) {
            clip.remove(true, true);
          }
        }
      }

      // Process audio tracks
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        track = seq.audioTracks[t];
        for (c = track.clips.numItems - 1; c >= 0; c--) {
          clip = track.clips[c];
          var aClipStart = clip.start.seconds;
          var aClipEnd = clip.end.seconds;
          if (aClipStart >= cut.startTimecode - tolerance &&
              aClipEnd <= cut.endTimecode + tolerance &&
              aClipStart < cut.endTimecode &&
              aClipEnd > cut.startTimecode) {
            clip.remove(true, true);
          }
        }
      }
    } else {
      // Disable mode: disable clips in the range
      for (t = 0; t < seq.videoTracks.numTracks; t++) {
        track = seq.videoTracks[t];
        for (c = 0; c < track.clips.numItems; c++) {
          clip = track.clips[c];
          if (clip.start.seconds >= cut.startTimecode - tolerance &&
              clip.end.seconds <= cut.endTimecode + tolerance) {
            clip.disabled = true;
          }
        }
      }
      for (t = 0; t < seq.audioTracks.numTracks; t++) {
        track = seq.audioTracks[t];
        for (c = 0; c < track.clips.numItems; c++) {
          clip = track.clips[c];
          if (clip.start.seconds >= cut.startTimecode - tolerance &&
              clip.end.seconds <= cut.endTimecode + tolerance) {
            clip.disabled = true;
          }
        }
      }
    }

    appliedCount++;
  }

  return JSON.stringify({ success: true, cutsApplied: appliedCount });
};

export var applyMultiCamSwitches = function(switchesJson: string): string {
  var switches = JSON.parse(switchesJson);
  var seq = app.project.activeSequence;
  if (!seq) return JSON.stringify({ error: "No active sequence" });

  var timePoints: number[] = [];
  var sw, time;
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
