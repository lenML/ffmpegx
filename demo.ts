import { FfmpegX, FfmpegCommand, executeFfmpeg } from "./src/main";
import * as fs from "fs";
import * as path from "path";

async function extractCover() {
  const inputVideo = "input1.mp4";
  const outputImage = "./demo_outputs/cover.jpg";

  if (!fs.existsSync(inputVideo)) {
    console.error(
      `Error: Input file not found at "${path.resolve(inputVideo)}"`
    );
    return;
  }
  console.log(`Attempting to extract a frame from "${inputVideo}"...`);

  const info = await FfmpegX.probe(inputVideo);
  fs.writeFileSync("./demo_outputs/info.json", JSON.stringify(info, null, 2));

  try {
    const result = await executeFfmpeg((cmd, ffmpeg) => {
      const { addInputOption, input, addOutputOption, outputFormat } =
        cmd.operators;

      // 使用 operators 配置命令
      addInputOption("-ss", "00:00:00");
      input(inputVideo);
      addOutputOption("-vframes", 1);
      addOutputOption("-q:v", 2);
      outputFormat("image2pipe");

      console.log("Generated command:", cmd.finalArgs.join(" "));
    });
    console.log("FFmpeg process finished successfully.");

    if (result.output) {
      console.log(
        `Received an image buffer of size: ${result.output.length} bytes.`
      );
      fs.writeFileSync(outputImage, result.output);
      console.log(`Cover image saved to "${outputImage}"!`);
    } else {
      console.warn(
        "FFmpeg ran successfully, but did not produce any output buffer."
      );
      console.error("Stderr:", result.stderr);
    }
  } catch (error) {
    console.error("An error occurred during FFmpeg execution:", error);
  }
}

extractCover();
