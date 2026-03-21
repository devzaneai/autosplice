export const sampleToSeconds = (
  sampleIndex: number,
  sampleRate: number
): number => {
  return sampleIndex / sampleRate;
};

export const snapToFrame = (
  timeSeconds: number,
  frameRate: number
): number => {
  return Math.round(timeSeconds * frameRate) / frameRate;
};

export const analysisTimeToTimeline = (
  analysisTimeSeconds: number,
  clipStartTime: number,
  clipInPoint: number,
  frameRate: number
): number => {
  const timelineSeconds = clipStartTime + (analysisTimeSeconds - clipInPoint);
  return snapToFrame(timelineSeconds, frameRate);
};

export const frameIndexToSeconds = (
  frameIndex: number,
  hopSize: number,
  sampleRate: number
): number => {
  return (frameIndex * hopSize) / sampleRate;
};
