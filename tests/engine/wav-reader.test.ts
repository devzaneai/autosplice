import { describe, it, expect } from "vitest";
import { readWav } from "../../src/js/engine/wav-reader";

const createWavBuffer = (samples: number[], sampleRate: number = 44100): Buffer => {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);        // chunk size
  buffer.writeUInt16LE(1, 20);         // PCM format
  buffer.writeUInt16LE(1, 22);         // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);  // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32);               // block align
  buffer.writeUInt16LE(16, 34);        // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const intVal = Math.round(samples[i] * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, intVal)), 44 + i * 2);
  }

  return buffer;
};

describe("readWav", () => {
  it("reads a valid WAV file", () => {
    const inputSamples = [0, 0.5, -0.5, 1.0, -1.0];
    const buffer = createWavBuffer(inputSamples);
    const result = readWav(buffer);

    expect(result.sampleRate).toBe(44100);
    expect(result.channels).toBe(1);
    expect(result.samples.length).toBe(5);
    expect(result.samples[0]).toBeCloseTo(0, 2);
    expect(result.samples[1]).toBeCloseTo(0.5, 2);
    expect(result.samples[2]).toBeCloseTo(-0.5, 2);
  });

  it("throws on invalid RIFF header", () => {
    const buffer = Buffer.from("NOT_A_WAV_FILE");
    expect(() => readWav(buffer)).toThrow("missing RIFF header");
  });

  it("throws on missing data chunk", () => {
    const buffer = Buffer.alloc(44);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    // No data chunk
    expect(() => readWav(buffer)).toThrow("missing data chunk");
  });

  it("calculates correct duration", () => {
    const samples = new Array(44100).fill(0);
    const buffer = createWavBuffer(samples, 44100);
    const result = readWav(buffer);
    expect(result.duration).toBeCloseTo(1.0, 2);
  });
});
