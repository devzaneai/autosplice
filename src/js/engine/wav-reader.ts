export interface WavData {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly channels: number;
  readonly duration: number;
}

export const readWav = (buffer: Buffer): WavData => {
  const riff = buffer.toString("ascii", 0, 4);
  if (riff !== "RIFF") throw new Error("Not a valid WAV file: missing RIFF header");

  const format = buffer.toString("ascii", 8, 12);
  if (format !== "WAVE") throw new Error("Not a valid WAV file: missing WAVE format");

  let offset = 12;
  let channels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    }

    if (chunkId === "data") {
      const dataStart = offset + 8;
      const bytesPerSample = bitsPerSample / 8;
      const totalSamples = chunkSize / bytesPerSample;
      const samples = new Float32Array(totalSamples);

      for (let i = 0; i < totalSamples; i++) {
        const byteOffset = dataStart + i * bytesPerSample;
        if (bitsPerSample === 16) {
          samples[i] = buffer.readInt16LE(byteOffset) / 32768;
        } else if (bitsPerSample === 32) {
          samples[i] = buffer.readFloatLE(byteOffset);
        }
      }

      return {
        samples,
        sampleRate,
        channels,
        duration: totalSamples / (sampleRate * channels),
      };
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  throw new Error("Not a valid WAV file: missing data chunk");
};
