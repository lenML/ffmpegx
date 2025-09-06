/**
 * FfmpegCommand class builds a reusable FFmpeg command configuration.
 * It separates the command's construction from its execution, improving
 * modularity and code readability.
 */
export class FfmpegCommand {
  private globalArgs: string[] = [];
  private inputArgs: string[] = [];
  private outputArgs: string[] = [];

  private inputFile: string | null = null;
  private outputFile: string | null = null;

  constructor() {}

  /**
   * A collection of operators to configure the FFmpeg command.
   * All methods return void and do not support chaining.
   */
  public operators = {
    // =================================================================
    // General I/O and Global Options
    // =================================================================

    /**
     * Sets the input file.
     * @param file Path to the input file.
     */
    input: (file: string): void => {
      this.inputFile = file;
    },
    /**
     * Sets the output file. If not called, output is assumed to be a buffer.
     * @param file Path to the output file.
     */
    output: (file: string): void => {
      this.outputFile = file;
    },
    /**
     * Overwrites output files without asking. Corresponds to the `-y` flag.
     */
    overwrite: (): void => {
      this.operators.addGlobalOption("-y");
    },
    /**
     * Sets the logging level. Corresponds to the `-v` flag.
     */
    logLevel: (
      level:
        | "quiet"
        | "panic"
        | "fatal"
        | "error"
        | "warning"
        | "info"
        | "verbose"
        | "debug"
    ): void => {
      this.operators.addGlobalOption("-v", level);
    },

    // =================================================================
    // Time Control
    // =================================================================

    /**
     * Seeks in the input file to a specific position. Fast seek.
     * Corresponds to the input `-ss` flag.
     * @param timestamp Time position (e.g., '00:01:23.456' or 83.456 in seconds).
     */
    seekInput: (timestamp: string | number): void => {
      this.operators.addInputOption("-ss", timestamp);
    },
    /**
     * Limits the duration of data read from the input file.
     * Corresponds to the input `-t` flag.
     * @param duration Duration (e.g., '00:00:10' or 10 in seconds).
     */
    durationInput: (duration: string | number): void => {
      this.operators.addInputOption("-t", duration);
    },
    /**
     * Sets the total duration of the output.
     * Corresponds to the output `-t` flag.
     * @param duration Duration (e.g., '00:00:10' or 10 in seconds).
     */
    duration: (duration: string | number): void => {
      this.operators.addOutputOption("-t", duration);
    },

    // =================================================================
    // Video Options
    // =================================================================

    /**
     * Sets the video codec. Corresponds to the `-c:v` flag.
     * Use 'copy' to stream copy without re-encoding.
     * @param codec The video codec name (e.g., 'libx264', 'hevc_nvenc', 'copy').
     */
    videoCodec: (codec: string): void => {
      this.operators.addOutputOption("-c:v", codec);
    },
    /**
     * Sets the video frame rate. Corresponds to the `-r` flag.
     * @param rate The frame rate (e.g., 24, 30, 60).
     */
    frameRate: (rate: number): void => {
      this.operators.addOutputOption("-r", rate);
    },
    /**
     * Sets the video dimensions. Corresponds to the `-s` flag.
     * @param size The size string (e.g., '1280x720', 'hd720').
     */
    size: (size: string): void => {
      this.operators.addOutputOption("-s", size);
    },
    /**
     * Sets the video bitrate. Corresponds to the `-b:v` flag.
     * @param bitrate Bitrate string (e.g., '1500k', '2M').
     */
    videoBitrate: (bitrate: string): void => {
      this.operators.addOutputOption("-b:v", bitrate);
    },
    /**
     * Sets the Constant Rate Factor (CRF) for quality-based encoding (e.g., for libx264).
     * Corresponds to the `-crf` flag.
     * @param value A number, typically 0-51. Lower is better quality. 23 is a good default.
     */
    crf: (value: number): void => {
      this.operators.addOutputOption("-crf", value);
    },
    /**
     * Sets an encoding preset for codecs like libx264.
     * Corresponds to the `-preset` flag.
     * @param preset Preset name (e.g., 'ultrafast', 'medium', 'slow').
     */
    preset: (
      preset:
        | "ultrafast"
        | "superfast"
        | "veryfast"
        | "faster"
        | "fast"
        | "medium"
        | "slow"
        | "slower"
        | "veryslow"
    ): void => {
      this.operators.addOutputOption("-preset", preset);
    },
    /**
     * Stops writing to the output after a specific number of video frames.
     * Corresponds to the `-vframes` flag.
     * @param count The number of frames to process.
     */
    frames: (count: number): void => {
      this.operators.addOutputOption("-vframes", count);
    },

    // =================================================================
    // Audio Options
    // =================================================================

    /**
     * Sets the audio codec. Corresponds to the `-c:a` flag.
     * Use 'copy' to stream copy without re-encoding.
     * @param codec The audio codec name (e.g., 'aac', 'libmp3lame', 'copy').
     */
    audioCodec: (codec: string): void => {
      this.operators.addOutputOption("-c:a", codec);
    },
    /**
     * Sets the audio bitrate. Corresponds to the `-b:a` flag.
     * @param bitrate Bitrate string (e.g., '128k', '192k').
     */
    audioBitrate: (bitrate: string): void => {
      this.operators.addOutputOption("-b:a", bitrate);
    },
    /**
     * Sets the number of audio channels. Corresponds to the `-ac` flag.
     * @param channels Number of channels (e.g., 1 for mono, 2 for stereo).
     */
    audioChannels: (channels: number): void => {
      this.operators.addOutputOption("-ac", channels);
    },
    /**
     * Sets the audio sampling frequency. Corresponds to the `-ar` flag.
     * @param rate Frequency in Hz (e.g., 44100, 48000).
     */
    audioSampleRate: (rate: number): void => {
      this.operators.addOutputOption("-ar", rate);
    },

    // =================================================================
    // Stream Control and Filters
    // =================================================================

    /**
     * Disables video recording. Corresponds to the `-vn` flag.
     */
    noVideo: (): void => {
      this.operators.addOutputOption("-vn");
    },
    /**
     * Disables audio recording. Corresponds to the `-an` flag.
     */
    noAudio: (): void => {
      this.operators.addOutputOption("-an");
    },
    /**
     * Applies a complex video filtergraph. Corresponds to the `-vf` flag.
     * @param filterStr The filtergraph string.
     */
    filter: (filterStr: string): void => {
      this.operators.addOutputOption("-vf", filterStr);
    },
    /**
     * Sets the output container format. Corresponds to the `-f` flag.
     * @param format The format name (e.g., 'mp4', 'mkv', 'image2pipe').
     */
    outputFormat: (format: string): void => {
      this.operators.addOutputOption("-f", format);
    },

    // =================================================================
    // Raw Options (for advanced use)
    // =================================================================

    addGlobalOption: (key: string, value?: string | number): void => {
      this.globalArgs.push(key);
      if (value !== undefined) this.globalArgs.push(String(value));
    },
    addInputOption: (key: string, value?: string | number): void => {
      this.inputArgs.push(key);
      if (value !== undefined) this.inputArgs.push(String(value));
    },
    addOutputOption: (key: string, value?: string | number): void => {
      this.outputArgs.push(key);
      if (value !== undefined) this.outputArgs.push(String(value));
    },
  };

  private buildArgs(): string[] {
    if (!this.inputFile) {
      throw new Error(
        "Input file not specified. Please call .setInput() or use a command builder to configure."
      );
    }
    const finalArgs: string[] = [
      ...this.globalArgs,
      ...this.inputArgs,
      "-i",
      this.inputFile,
      ...this.outputArgs,
    ];
    if (this.outputFile) {
      finalArgs.push(this.outputFile);
    } else {
      const hasFormat = this.outputArgs.some(
        (arg, i) => arg === "-f" && i < this.outputArgs.length - 1
      );
      if (!hasFormat) {
        throw new Error(
          "Output format is required when no output file is specified."
        );
      }
      finalArgs.push("pipe:1");
    }
    return finalArgs;
  }

  get finalArgs(): string[] {
    return this.buildArgs();
  }
}
