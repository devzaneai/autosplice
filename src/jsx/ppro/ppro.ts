export var getSequenceInfo = function () {
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

  var selectedClips: any[] = [];
  var t, c, track, clip;
  for (t = 0; t < seq.audioTracks.numTracks; t++) {
    track = seq.audioTracks[t];
    for (c = 0; c < track.clips.numItems; c++) {
      clip = track.clips[c];
      if (clip.isSelected()) {
        selectedClips.push({
          mediaPath: clip.projectItem.getMediaPath(),
          startTime: clip.start.seconds,
          endTime: clip.end.seconds,
          inPoint: clip.inPoint.seconds,
          outPoint: clip.outPoint.seconds,
          trackIndex: t,
        });
      }
    }
  }

  var settings = seq.getSettings();
  var frameRate = 30;
  if (settings && settings.videoFrameRate && settings.videoFrameRate.seconds) {
    frameRate = 1 / settings.videoFrameRate.seconds;
  }

  var inPointVal = null;
  var outPointVal = null;
  try {
    var inPt = seq.getInPoint();
    if (inPt && inPt !== "0") {
      inPointVal = parseFloat(inPt) / 254016000000;
    }
  } catch (e) {}
  try {
    var outPt = seq.getOutPoint();
    if (outPt && outPt !== "0") {
      outPointVal = parseFloat(outPt) / 254016000000;
    }
  } catch (e) {}

  return {
    name: seq.name,
    frameRate: frameRate,
    durationSeconds: seq.end ? parseFloat(seq.end) / 254016000000 : 0,
    audioTrackCount: seq.audioTracks.numTracks,
    videoTrackCount: seq.videoTracks.numTracks,
    inPoint: inPointVal,
    outPoint: outPointVal,
    selectedClips: selectedClips,
  };
};

export var getAudioTrackClips = function (trackIndex: number) {
  var seq = app.project.activeSequence;
  if (!seq) return [];

  var track = seq.audioTracks[trackIndex];
  if (!track) return [];

  var clips: any[] = [];
  var c, clip;
  for (c = 0; c < track.clips.numItems; c++) {
    clip = track.clips[c];
    clips.push({
      mediaPath: clip.projectItem.getMediaPath(),
      startTime: clip.start.seconds,
      endTime: clip.end.seconds,
      inPoint: clip.inPoint.seconds,
      outPoint: clip.outPoint.seconds,
      trackIndex: trackIndex,
    });
  }

  return clips;
};

// Diagnostic: read clip positions WITHOUT modifying anything
export var debugTrackState = function () {
  var seq = app.project.activeSequence;
  if (!seq) return { error: "No active sequence" };

  var result: any = {
    videoTrackCount: seq.videoTracks.numTracks,
    audioTrackCount: seq.audioTracks.numTracks,
  };

  // Read first 10 clips on V1
  var v1Clips: any[] = [];
  if (seq.videoTracks.numTracks > 0) {
    var vt = seq.videoTracks[0];
    result.v1ClipCount = vt.clips.numItems;
    for (var i = 0; i < vt.clips.numItems && i < 10; i++) {
      var vc = vt.clips[i];
      v1Clips.push({
        idx: i,
        start: vc.start.seconds,
        end: vc.end.seconds,
        dur: vc.end.seconds - vc.start.seconds,
        mediaType: vc.mediaType,
      });
    }
  }
  result.v1Clips = v1Clips;

  // Read first 10 clips on A1
  var a1Clips: any[] = [];
  if (seq.audioTracks.numTracks > 0) {
    var at = seq.audioTracks[0];
    result.a1ClipCount = at.clips.numItems;
    for (var j = 0; j < at.clips.numItems && j < 10; j++) {
      var ac = at.clips[j];
      a1Clips.push({
        idx: j,
        start: ac.start.seconds,
        end: ac.end.seconds,
        dur: ac.end.seconds - ac.start.seconds,
        mediaType: ac.mediaType,
      });
    }
  }
  result.a1Clips = a1Clips;

  return result;
};

export var getTrackNames = function () {
  var seq = app.project.activeSequence;
  if (!seq) return { audio: [], video: [] };

  var audio: string[] = [];
  var video: string[] = [];
  var i;

  for (i = 0; i < seq.audioTracks.numTracks; i++) {
    audio.push(seq.audioTracks[i].name || "A" + (i + 1));
  }

  for (i = 0; i < seq.videoTracks.numTracks; i++) {
    video.push(seq.videoTracks[i].name || "V" + (i + 1));
  }

  return { audio: audio, video: video };
};
