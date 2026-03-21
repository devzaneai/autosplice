export interface SpeakerSegment {
  readonly speaker: number;
  readonly startFrame: number;
  readonly endFrame: number;
}

export const detectActiveSpeaker = (
  channelDbfs: readonly (readonly number[])[],
  sensitivityDb: number
): number[] => {
  return channelDbfs.map((frame) => {
    const validChannels = frame
      .map((db, idx) => ({ db, idx }))
      .filter((c) => isFinite(c.db))
      .sort((a, b) => b.db - a.db);

    if (validChannels.length === 0) return -1;
    if (validChannels.length === 1) return validChannels[0].idx;

    const loudest = validChannels[0];
    const secondLoudest = validChannels[1];
    const differential = loudest.db - secondLoudest.db;

    return differential >= sensitivityDb ? loudest.idx : -1;
  });
};

export const applyHysteresis = (rawSpeakers: readonly number[]): number[] => {
  const result = [...rawSpeakers];
  let currentSpeaker = -1;

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== -1) {
      currentSpeaker = result[i];
    } else if (currentSpeaker !== -1) {
      result[i] = currentSpeaker;
    }
  }

  return result;
};

export const segmentSpeakers = (speakers: readonly number[]): SpeakerSegment[] => {
  if (speakers.length === 0) return [];

  const segments: SpeakerSegment[] = [];
  let currentSpeaker = speakers[0];
  let startFrame = 0;

  for (let i = 1; i < speakers.length; i++) {
    if (speakers[i] !== currentSpeaker) {
      segments.push({ speaker: currentSpeaker, startFrame, endFrame: i });
      currentSpeaker = speakers[i];
      startFrame = i;
    }
  }

  segments.push({ speaker: currentSpeaker, startFrame, endFrame: speakers.length });
  return segments;
};

export const enforceMinCutDuration = (
  segments: readonly SpeakerSegment[],
  minDurationSeconds: number,
  hopSize: number,
  sampleRate: number
): SpeakerSegment[] => {
  if (segments.length === 0) return [];

  const minFrames = Math.ceil((minDurationSeconds * sampleRate) / hopSize);
  const result: SpeakerSegment[] = [{ ...segments[0] }];

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const duration = segment.endFrame - segment.startFrame;
    const prev = result[result.length - 1];

    if (duration < minFrames) {
      result[result.length - 1] = { ...prev, endFrame: segment.endFrame };
    } else {
      result.push({ ...segment });
    }
  }

  return result;
};
