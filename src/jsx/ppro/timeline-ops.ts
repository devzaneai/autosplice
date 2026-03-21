export var initQE = function (): boolean {
  if (typeof qe === "undefined") {
    app.enableQE();
  }
  return typeof qe !== "undefined";
};

var getTicksPerFrame = function (): number {
  var seq = app.project.activeSequence;
  if (!seq) return 8475667200;
  return parseInt(seq.getSettings().videoFrameRate.ticks, 10);
};

var secondsToFrameAlignedTicks = function (seconds: number): string {
  var rawTicks = seconds * 254016000000;
  var ticksPerFrame = getTicksPerFrame();
  var frameNumber = Math.round(rawTicks / ticksPerFrame);
  return (frameNumber * ticksPerFrame).toString();
};

// Convert seconds to a Premiere timecode string using Time.getFormatted()
// This is the format the QE DOM razor() expects (e.g., "00;05;30;15")
var secondsToTimecode = function (seconds: number): string {
  var seq = app.project.activeSequence;
  var time = new Time();
  time.seconds = seconds;
  var settings = seq.getSettings();
  return time.getFormatted(
    settings.videoFrameRate,
    settings.videoDisplayFormat,
  );
};

export var razorAtTime = function (
  timeSeconds: number,
  trackIndex: number,
  isVideo: boolean,
): boolean {
  if (!initQE()) return false;
  var qeSeq = qe.project.getActiveSequence();
  if (!qeSeq) return false;
  var timecode = secondsToTimecode(timeSeconds);
  if (isVideo) {
    var vTrack = qeSeq.getVideoTrackAt(trackIndex);
    if (vTrack) {
      vTrack.razor(timecode);
      return true;
    }
  } else {
    var aTrack = qeSeq.getAudioTrackAt(trackIndex);
    if (aTrack) {
      aTrack.razor(timecode);
      return true;
    }
  }
  return false;
};

export var applyJumpCuts = function (cutListJson: string): any {
  var cutList = JSON.parse(cutListJson);
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

  var t, i;
  var numVideoTracks = seq.videoTracks.numTracks;
  var numAudioTracks = seq.audioTracks.numTracks;
  var isDelete = cutList.length > 0 && cutList[0].action === "delete";

  // =====================================================
  // PHASE 1: Razor at ALL cut boundaries on ALL tracks
  // =====================================================
  for (i = 0; i < cutList.length; i++) {
    for (t = 0; t < numVideoTracks; t++) {
      razorAtTime(cutList[i].startTimecode, t, true);
      razorAtTime(cutList[i].endTimecode, t, true);
    }
    for (t = 0; t < numAudioTracks; t++) {
      razorAtTime(cutList[i].startTimecode, t, false);
      razorAtTime(cutList[i].endTimecode, t, false);
    }
  }

  if (!isDelete) {
    // Disable mode: mark matching clips as disabled
    for (i = 0; i < cutList.length; i++) {
      var cutStart = cutList[i].startTimecode;
      var cutEnd = cutList[i].endTimecode;
      for (t = 0; t < numVideoTracks; t++) {
        var vt = seq.videoTracks[t];
        for (var vc = 0; vc < vt.clips.numItems; vc++) {
          var vcClip = vt.clips[vc];
          var vcMid = (vcClip.start.seconds + vcClip.end.seconds) / 2;
          if (vcMid >= cutStart && vcMid <= cutEnd) {
            vcClip.disabled = true;
          }
        }
      }
      for (t = 0; t < numAudioTracks; t++) {
        var at = seq.audioTracks[t];
        for (var ac = 0; ac < at.clips.numItems; ac++) {
          var acClip = at.clips[ac];
          var acMid = (acClip.start.seconds + acClip.end.seconds) / 2;
          if (acMid >= cutStart && acMid <= cutEnd) {
            acClip.disabled = true;
          }
        }
      }
    }
    return { success: true, cutsApplied: cutList.length, mode: "disable" };
  }

  // DIAGNOSTIC: clip count after razor
  var v1After = seq.videoTracks[0].clips.numItems;
  var a1After = seq.audioTracks[0].clips.numItems;
  var sampleClips: string[] = [];
  for (var fc = 0; fc < v1After && fc < 5; fc++) {
    var fcC = seq.videoTracks[0].clips[fc];
    sampleClips.push(
      fcC.start.seconds.toFixed(2) + "-" + fcC.end.seconds.toFixed(2),
    );
  }
  var sampleCuts: string[] = [];
  for (var fci = 0; fci < cutList.length && fci < 5; fci++) {
    sampleCuts.push(
      cutList[fci].startTimecode.toFixed(2) +
        "-" +
        cutList[fci].endTimecode.toFixed(2),
    );
  }

  // =====================================================
  // PHASE 2: Delete mode
  // =====================================================
  cutList.sort(function (a: any, b: any) {
    return b.startTimecode - a.startTimecode;
  });

  var removedVideo = 0;
  var removedAudio = 0;

  for (i = 0; i < cutList.length; i++) {
    var cStart = cutList[i].startTimecode;
    var cEnd = cutList[i].endTimecode;

    // Remove matching video clips (reverse index)
    for (t = 0; t < numVideoTracks; t++) {
      var vTrack = seq.videoTracks[t];
      for (var vIdx = vTrack.clips.numItems - 1; vIdx >= 0; vIdx--) {
        var vClip = vTrack.clips[vIdx];
        var vMid = (vClip.start.seconds + vClip.end.seconds) / 2;
        if (vMid >= cStart && vMid <= cEnd) {
          vClip.remove(true, true);
          removedVideo++;
          break; // Only one clip per track per cut region
        }
      }
    }

    // Remove matching audio clips (reverse index)
    for (t = 0; t < numAudioTracks; t++) {
      var aTrack = seq.audioTracks[t];
      for (var aIdx = aTrack.clips.numItems - 1; aIdx >= 0; aIdx--) {
        var aClip = aTrack.clips[aIdx];
        var aMid = (aClip.start.seconds + aClip.end.seconds) / 2;
        if (aMid >= cStart && aMid <= cEnd) {
          aClip.remove(true, true);
          removedAudio++;
          break; // Only one clip per track per cut region
        }
      }
    }
  }

  return {
    success: true,
    cutsApplied: cutList.length,
    mode: "delete",
    removedVideo: removedVideo,
    removedAudio: removedAudio,
    v1AfterRazor: v1After,
    a1AfterRazor: a1After,
    sampleClips: sampleClips,
    sampleCuts: sampleCuts,
  };
};

export var applyMultiCamSwitches = function (switchesJson: string): any {
  var switches = JSON.parse(switchesJson);
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

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
        var mid = (clip.start.seconds + clip.end.seconds) / 2;
        if (mid >= sw.startTimecode && mid <= sw.endTimecode) {
          clip.disabled = t !== sw.cameraTrackIndex;
        }
      }
    }
  }

  return { success: true, switchesApplied: switches.length };
};
