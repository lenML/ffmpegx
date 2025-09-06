import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import EventEmitter from "eventemitter3";
import * as fs from "fs";
import * as path from "path";
import which from "which";
import {
  ProgressData,
  FfmpegXResult,
  FfmpegXOptions,
  FfprobeData,
} from "./types";

type FfmpegXEvents = {
  start: (command: string) => void;
  progress: (data: ProgressData) => void;
  stderr: (line: string) => void;
  end: (result: FfmpegXResult) => void;
  error: (error: Error, stderr: string) => void;
};

function findExecutable(name: string): string | null {
  const exePath = which.sync(name, { nothrow: true });
  if (exePath) return exePath;
  const isWindows = process.platform === "win32";
  const exeName = isWindows ? `${name}.exe` : name;
  const searchDirs = [
    path.join(process.cwd(), "bin"),
    path.join(process.cwd(), "node_modules", ".bin"),
    process.cwd(),
  ];
  for (const dir of searchDirs) {
    const fullPath = path.join(dir, exeName);
    try {
      fs.accessSync(fullPath, fs.constants.X_OK);
      return fullPath;
    } catch (e) {}
  }
  return null;
}

function parseProgress(line: string): ProgressData | null {
  if (!line.startsWith("frame=")) return null;
  const progress: Partial<ProgressData> & { raw: string } = { raw: line };
  const items = line.split(" ").filter((item) => item.includes("="));
  for (const item of items) {
    const [key, value] = item.split("=", 2);
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    switch (trimmedKey) {
      case "frame":
        progress.frame = parseInt(trimmedValue, 10);
        break;
      case "fps":
        progress.fps = parseFloat(trimmedValue);
        break;
      case "q":
        progress.q = parseFloat(trimmedValue);
        break;
      case "size":
        progress.size = trimmedValue;
        break;
      case "time":
        progress.time = trimmedValue;
        break;
      case "bitrate":
        progress.bitrate = trimmedValue;
        break;
      case "speed":
        progress.speed = trimmedValue;
        break;
    }
  }
  return progress.time ? (progress as ProgressData) : null;
}

export class FfmpegX extends EventEmitter<FfmpegXEvents> {
  public readonly resolvedFfmpegPath: string;
  public readonly resolvedFfprobePath: string;

  private process: ChildProcessWithoutNullStreams | null = null;

  constructor(options: FfmpegXOptions = {}) {
    super();
    this.resolvedFfmpegPath =
      options.ffmpegPath || findExecutable("ffmpeg") || "ffmpeg";
    this.resolvedFfprobePath =
      options.ffprobePath || findExecutable("ffprobe") || "ffprobe";
  }

  // --- 静态和核心方法 ---
  static probe(file: string, ffprobePath?: string): Promise<FfprobeData> {
    const pathToProbe = ffprobePath || findExecutable("ffprobe") || "ffprobe";
    return new Promise((resolve, reject) => {
      const args = [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        file,
      ];
      const child = spawn(pathToProbe, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      child.on("close", (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch (e) {
            reject(
              new Error(`Failed to parse ffprobe JSON output: ${e}\n${stdout}`)
            );
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}\n${stderr}`));
        }
      });
      child.on("error", reject);
    });
  }

  public execute(finalArgs: string[]): Promise<FfmpegXResult> {
    return new Promise((resolve, reject) => {
      const command = `${this.resolvedFfmpegPath} ${finalArgs.join(" ")}`;
      this.emit("start", command);
      this.process = spawn(this.resolvedFfmpegPath, finalArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      }) as any;
      if (!this.process)
        return reject(new Error(`Failed to spawn ffmpeg process`));
      const stdoutChunks: Buffer[] = [];
      let stderr = "",
        stderrBuffer = "";
      this.process.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
      this.process.stderr.on("data", (chunk) => {
        const chunkStr = chunk.toString();
        stderr += chunkStr;
        stderrBuffer += chunkStr;
        const lines = stderrBuffer.split(/\r\n|\n|\r/);
        stderrBuffer = lines.pop() || "";
        for (const line of lines) {
          this.emit("stderr", line);
          const progress = parseProgress(line);
          if (progress) this.emit("progress", progress);
        }
      });
      this.process.on("close", (code) => {
        if (code === 0) {
          const outputBuffer = Buffer.concat(stdoutChunks);
          const result: FfmpegXResult = {
            stderr,
            output: outputBuffer.length > 0 ? outputBuffer : undefined,
          };
          this.emit("end", result);
          resolve(result);
        } else {
          const error = new Error(`ffmpeg exited with code ${code}`);
          this.emit("error", error, stderr);
          reject(error);
        }
      });
      this.process.on("error", (err) => {
        this.emit("error", err, stderr);
        reject(err);
      });
    });
  }

  public kill(signal: NodeJS.Signals = "SIGKILL") {
    if (this.process) this.process.kill(signal);
  }
}
