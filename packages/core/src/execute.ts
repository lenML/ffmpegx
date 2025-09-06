import { FfmpegCommand } from "./FfmpegCommand";
import { FfmpegX } from "./FfmpegX";

export async function executeFfmpeg(
  fn: (cmd: FfmpegCommand, ffmpeg: FfmpegX) => Promise<void> | void
) {
  const ffmpeg = new FfmpegX();
  const cmd = new FfmpegCommand();
  try {
    await fn(cmd, ffmpeg);
    return await ffmpeg.execute(cmd.finalArgs);
  } catch (error) {
    throw error;
  } finally {
    ffmpeg.removeAllListeners();
  }
}
