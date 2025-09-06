import { FfmpegCommand, FfmpegX, executeFfmpeg } from "ffmpegx-core";

async function main() {
  const version = await executeFfmpeg((cmd) => {
    cmd.operators.addGlobalOption("-version");
  });
  console.log(version.output?.toString("utf-8"));
}

main();
