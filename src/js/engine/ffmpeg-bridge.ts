import { child_process, fs, os, path } from "../lib/cep/node";
import { csi } from "../lib/utils/bolt";

const getFFmpegPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") {
    const binary = arch === "arm64" ? "ffmpeg-mac-arm64" : "ffmpeg-mac-x64";
    return path.join(extRoot, "bin", binary);
  } else if (platform === "win32") {
    return path.join(extRoot, "bin", "ffmpeg-win-x64.exe");
  }

  throw new Error(`Unsupported platform: ${platform}`);
};

const getTempDir = (): string => {
  const tmpDir = path.join(os.tmpdir(), "autosplice");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
};

export const extractAudio = (
  mediaPath: string,
  outputName: string,
  mono: boolean = true
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();

    if (!fs.existsSync(ffmpegPath)) {
      reject(new Error(`FFmpeg not found at ${ffmpegPath}. Try reinstalling AutoSplice.`));
      return;
    }

    const tempDir = getTempDir();
    const outputPath = path.join(tempDir, `${outputName}.wav`);

    const args = [
      "-i", mediaPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "44100",
    ];

    if (mono) {
      args.push("-ac", "1");
    }

    args.push("-y", outputPath);

    const proc = child_process.spawn(ffmpegPath, args);
    let stderr = "";

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
};

export const extractTrackAudio = (
  mediaPath: string,
  trackIndex: number,
  outputName: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();
    const tempDir = getTempDir();
    const outputPath = path.join(tempDir, `${outputName}.wav`);

    const args = [
      "-i", mediaPath,
      "-vn",
      "-map", `0:a:${trackIndex}`,
      "-acodec", "pcm_s16le",
      "-ar", "44100",
      "-ac", "1",
      "-y", outputPath,
    ];

    const proc = child_process.spawn(ffmpegPath, args);
    let stderr = "";

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
};

export const cleanupTempFiles = (): void => {
  try {
    const tempDir = path.join(os.tmpdir(), "autosplice");
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  } catch {
    // Best effort cleanup
  }
};
