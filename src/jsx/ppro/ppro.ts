export var getSequenceInfo = function() {
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
          trackIndex: t
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
  } catch(e) {}
  try {
    var outPt = seq.getOutPoint();
    if (outPt && outPt !== "0") {
      outPointVal = parseFloat(outPt) / 254016000000;
    }
  } catch(e) {}

  return {
    name: seq.name,
    frameRate: frameRate,
    durationSeconds: seq.end ? parseFloat(seq.end) / 254016000000 : 0,
    audioTrackCount: seq.audioTracks.numTracks,
    videoTrackCount: seq.videoTracks.numTracks,
    inPoint: inPointVal,
    outPoint: outPointVal,
    selectedClips: selectedClips
  };
};

export var getAudioTrackClips = function(trackIndex: number) {
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
      trackIndex: trackIndex
    });
  }

  return clips;
};

export var getTrackNames = function() {
  var seq = app.project.activeSequence;
  if (!seq) return { audio: [], video: [] };

  var audio: string[] = [];
  var video: string[] = [];
  var i;

  for (i = 0; i < seq.audioTracks.numTracks; i++) {
    audio.push(seq.audioTracks[i].name || ("A" + (i + 1)));
  }

  for (i = 0; i < seq.videoTracks.numTracks; i++) {
    video.push(seq.videoTracks[i].name || ("V" + (i + 1)));
  }

  return { audio: audio, video: video };
};
