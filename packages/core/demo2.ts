// extractFrames.ts (采用双-ss跳转法，稳定、快速且精确)

import { FfmpegX, executeFfmpeg } from "./src/main";
import * as fs from "fs";
import * as path from "path";

/**
 * 提取帧的选项接口
 */
export interface ExtractFramesOptions {
  totalFrames?: number; // 提取指定总数的帧
  fps?: number; // 或按指定的 fps 提取
}

/**
 * VideoFrameExtractor 类
 * 封装了从视频文件中提取帧的所有逻辑。
 */
export class VideoFrameExtractor {
  public readonly videoPath: string;

  private videoInfo: any = null;
  private videoStream: any = null;
  private totalFrames: number = 0;
  private fps: number = 0;
  private keyframeIntervalSeconds: number = 5; // 关键帧间隔的保守估计值 (秒)

  /**
   * 构造函数
   * @param videoPath 视频文件的路径
   */
  constructor(videoPath: string) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input video not found at: ${path.resolve(videoPath)}`);
    }
    this.videoPath = videoPath;
  }

  /**
   * 初始化提取器。
   */
  public async initialize(): Promise<void> {
    console.log(`Probing video file for info: "${this.videoPath}"...`);

    this.videoInfo = await FfmpegX.probe(this.videoPath);
    this.videoStream =
      this.videoInfo.streams.find((s) => s.codec_type === "video") ?? null;

    if (!this.videoStream) {
      throw new Error("No video stream found in the file.");
    }

    this.fps = VideoFrameExtractor.parseFrameRate(
      this.videoStream.avg_frame_rate
    );

    if (
      this.videoStream.nb_frames &&
      parseInt(this.videoStream.nb_frames, 10) > 0
    ) {
      this.totalFrames = parseInt(this.videoStream.nb_frames, 10);
    } else if (this.videoInfo.format.duration) {
      const duration = parseFloat(this.videoInfo.format.duration);
      this.totalFrames = Math.floor(duration * this.fps);
    } else {
      throw new Error(
        "Could not determine the total number of frames or duration of the video."
      );
    }

    if (isNaN(this.totalFrames) || this.totalFrames <= 0) {
      throw new Error(
        "Could not determine a valid total number of frames for the video."
      );
    }

    // 估算关键帧间隔，用于优化跳转。GOP size常见为FPS的1-10倍。我们保守取5秒。
    // 更精确的方法需要扫描整个视频，但这里估算值足够。
    if (this.videoStream.r_frame_rate) {
      const frameRate = VideoFrameExtractor.parseFrameRate(
        this.videoStream.r_frame_rate
      );
      this.keyframeIntervalSeconds = Math.max(2, 250 / frameRate); // 假设GOP最大250帧
    }

    console.log(
      `Video initialized: ~${this.totalFrames} frames at ~${this.fps.toFixed(
        2
      )} FPS.`
    );
  }

  /**
   * [最终方案 - 稳定、快速、精确] 使用 "双-ss" 方法提取帧。
   * 这是在性能和精度之间取得最佳平衡的最可靠方法。
   * @param options - 提取选项
   * @returns Promise<Buffer[]> - 一个包含图像 Buffer 的数组
   */
  public async extract(options: ExtractFramesOptions): Promise<Buffer[]> {
    this.validateInitialized();
    this.validateOptions(options);

    const frameIndices = this.calculateFrameIndices(options);
    console.log(
      `[Dual-SS Method] Preparing to extract ${frameIndices.length} unique frames in parallel...`
    );

    const extractionPromises = frameIndices.map((frameIndex, i) => {
      const targetTimestamp = frameIndex / this.fps;

      // **关键修复: "双-ss" 跳转法**
      // 1. 计算一个粗略的、提前的跳转时间点。
      //    这个时间点必须在目标时间点之前，并且差距要大于一个关键帧间隔，以确保FFmpeg能正确跳转。
      const coarseSeekTime = Math.max(
        0,
        targetTimestamp - this.keyframeIntervalSeconds
      );

      // 2. 计算从粗略跳转点到精确目标点的偏移量。
      const preciseSeekOffset = targetTimestamp - coarseSeekTime;

      return executeFfmpeg((cmd) => {
        const { addInputOption, input, addOutputOption, outputFormat } =
          cmd.operators;

        // **步骤 A: 快速输入跳转**
        // 使用 -ss 作为输入选项，快速跳到目标附近。
        addInputOption("-ss", coarseSeekTime.toFixed(6));

        input(this.videoPath);

        // **步骤 B: 精确输出跳转**
        // 使用 -ss 作为输出选项，从当前位置精确解码并丢弃掉 offset 时长的帧。
        addOutputOption("-ss", preciseSeekOffset.toFixed(6));

        // 我们不再需要 select 过滤器，因为双-ss已经完成了精确定位。
        addOutputOption("-vframes", 1);
        addOutputOption("-q:v", 2);
        outputFormat("image2pipe");
      })
        .then((result) => {
          if (result.output && result.output.length > 0) {
            console.log(
              `  > Successfully extracted frame #${
                i + 1
              } (index: ${frameIndex}, time: ~${targetTimestamp.toFixed(
                2
              )}s) (${result.output.length} bytes)`
            );
            return result.output;
          }
          console.warn(
            `  > Frame #${
              i + 1
            } (index: ${frameIndex}) produced no output. Stderr: ${
              result.stderr
            }`
          );
          return null;
        })
        .catch((error) => {
          console.error(
            `  > Error extracting frame #${i + 1} (index: ${frameIndex}):`,
            error
          );
          return null;
        });
    });

    const frameBuffers = await Promise.all(extractionPromises);
    return frameBuffers.filter((buffer): buffer is Buffer => buffer !== null);
  }

  // --- 以下是私有辅助方法和慢速方法，无需改动 ---

  public async extractSlow(options: ExtractFramesOptions): Promise<Buffer[]> {
    /* ... 省略未改动代码 ... */ return [];
  }
  private validateInitialized(): void {
    if (!this.videoInfo || !this.videoStream || this.totalFrames === 0) {
      throw new Error(
        "Extractor not initialized. Call the async initialize() method first."
      );
    }
  }
  private validateOptions(options: ExtractFramesOptions): void {
    /* ... 省略未改动代码 ... */
  }
  private calculateFrameIndices(options: ExtractFramesOptions): number[] {
    const { totalFrames, fps } = options;
    const frameIndices: number[] = [];

    if (totalFrames) {
      console.log(`Calculating indices for ${totalFrames} total frames...`);
      const framesToExtract = Math.min(totalFrames, this.totalFrames);
      const interval = this.totalFrames / framesToExtract;
      for (let i = 0; i < framesToExtract; i++) {
        const frameIndex = Math.floor(i * interval + interval / 2);
        frameIndices.push(frameIndex);
      }
    } else if (fps) {
      console.log(`Calculating frame indices for ${fps} FPS...`);
      const interval = this.fps / fps;
      for (let i = 0; i * interval < this.totalFrames; i++) {
        const frameIndex = Math.floor(i * interval);
        frameIndices.push(frameIndex);
      }
    }
    return [...new Set(frameIndices)];
  }
  private static parseFrameRate(frameRateStr: string): number {
    if (frameRateStr.includes("/")) {
      const parts = frameRateStr.split("/");
      return parseInt(parts[0], 10) / parseInt(parts[1], 10);
    }
    return parseFloat(frameRateStr);
  }
}

// --- 示例用法 (无需改动) ---

async function main() {
  const inputVideo = "input3.mp4";
  const outputDir = "./demo_outputs";

  if (!fs.existsSync(inputVideo)) {
    console.error(
      `Error: Input file not found at "${path.resolve(inputVideo)}"`
    );
    return;
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const extractor = new VideoFrameExtractor(inputVideo);
    await extractor.initialize();

    console.log(
      "\n--- Running Demo: Extracting 10 total frames (Dual-SS, Stable Method) ---"
    );
    const startTimeFast = Date.now();
    const frames = await extractor.extract({
      totalFrames: 10,
    });
    const endTimeFast = Date.now();
    console.log(
      `\nSuccessfully extracted ${
        frames.length
      } frames using optimized method in ${
        (endTimeFast - startTimeFast) / 1000
      } seconds.`
    );

    // 清理旧文件
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      if (file.startsWith("frame-")) {
        fs.unlinkSync(path.join(outputDir, file));
      }
    }

    for (let i = 0; i < frames.length; i++) {
      fs.writeFileSync(
        path.join(outputDir, `frame-fast-${i + 1}.jpg`),
        frames[i]
      );
    }
    console.log(`Frames saved to ${outputDir}`);
  } catch (error) {
    console.error("\nAn error occurred during the main process:", error);
  }
}

// 运行示例
main();
