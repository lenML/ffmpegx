// --- 类型定义 ---

export interface FfprobeStream {
  index: number;
  codec_name?: string;
  codec_long_name?: string;
  codec_type: "video" | "audio" | "subtitle" | "data";
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
  [key: string]: any;
}

export interface FfprobeFormat {
  filename: string;
  nb_streams: number;
  format_name: string;
  format_long_name: string;
  duration: string;
  size: string;
  bit_rate: string;
  [key: string]: any;
}

export interface FfprobeData {
  streams: FfprobeStream[];
  format: FfprobeFormat;
}
export interface FfmpegXOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
}
// --- 事件相关类型定义 ---

export interface ProgressData {
  frame?: number;
  fps?: number;
  q?: number;
  size?: string;
  time?: string;
  bitrate?: string;
  speed?: string;
  raw: string;
}

export interface FfmpegXResult {
  stderr: string;
  output?: Buffer;
}
