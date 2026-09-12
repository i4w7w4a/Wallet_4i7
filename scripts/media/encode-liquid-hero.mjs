import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export const EXPECTED_SOURCE_SHA256 =
  "9D0E6DB8BAC057C3F44EA500E5751EA33C4046E35FEDE80F5F04E62A062005A0";
export const MAX_VIDEO_BYTES = 3_500_000;
export const MAX_POSTER_BYTES = 250_000;
export const OUTPUT_WIDTH = 720;
export const OUTPUT_HEIGHT = 900;
export const OUTPUT_FPS = 24;
export const OUTPUT_DURATION_SECONDS = 8.15;

const DEFAULT_SOURCE = join(
  REPO_ROOT,
  "assets",
  "source",
  "liquid-hero-source.mp4",
);
const DEFAULT_OUTPUT_DIR = join(
  REPO_ROOT,
  "apps",
  "miniapp",
  "public",
  "media",
);

export function buildVideoFilter() {
  return [
    "[0:v]split=3[main_src][tail_src][head_src]",
    "[main_src]trim=start=0.60:end=8.15,setpts=PTS-STARTPTS[main]",
    "[tail_src]trim=start=8.15:end=8.75,setpts=PTS-STARTPTS[tail]",
    "[head_src]trim=start=0:end=0.60,setpts=PTS-STARTPTS[head]",
    "[tail][head]xfade=transition=fade:duration=0.60:offset=0[seam]",
    "[main][seam]concat=n=2:v=1:a=0,crop=1080:1350:0:45,scale=720:900:flags=lanczos,fps=24,format=yuv420p[outv]",
  ].join(";");
}

function commonVideoArgs(sourcePath) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-filter_complex",
    buildVideoFilter(),
    "-map",
    "[outv]",
    "-an",
    "-sn",
    "-dn",
  ];
}

export function buildMp4Args(sourcePath, outputPath, crf = 25) {
  return [
    ...commonVideoArgs(sourcePath),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

export function buildWebmArgs(sourcePath, outputPath, crf = 34) {
  return [
    ...commonVideoArgs(sourcePath),
    "-c:v",
    "libvpx-vp9",
    "-crf",
    String(crf),
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ];
}

export function buildPosterArgs(videoPath, outputPath, crf = 30) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "0.10",
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-an",
    "-sn",
    "-dn",
    "-c:v",
    "libaom-av1",
    "-still-picture",
    "1",
    "-crf",
    String(crf),
    "-b:v",
    "0",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ];
}

export function parseRate(value) {
  const [numerator, denominator = "1"] = String(value).split("/");
  return Number(numerator) / Number(denominator);
}

function durationFromProbe(probe) {
  return Number(probe.format?.duration ?? probe.streams?.[0]?.duration);
}

function getStreams(probe) {
  return {
    video: probe.streams.filter((stream) => stream.codec_type === "video"),
    audio: probe.streams.filter((stream) => stream.codec_type === "audio"),
  };
}

export function assertSourceMetadata(probe) {
  const { video, audio } = getStreams(probe);
  assert.equal(video.length, 1, "исходник должен содержать один видеопоток");
  assert.equal(audio.length, 0, "исходник не должен содержать аудиопоток");
  assert.equal(video[0].codec_name, "h264", "ожидается исходник H.264");
  assert.equal(video[0].profile, "Main", "ожидается профиль H.264 Main");
  assert.equal(video[0].width, 1080, "ширина исходника должна быть 1080");
  assert.equal(video[0].height, 1440, "высота исходника должна быть 1440");
  assert.ok(
    Math.abs(parseRate(video[0].r_frame_rate) - OUTPUT_FPS) < 0.001,
    "частота исходника должна быть 24 FPS",
  );
  assert.ok(
    Math.abs(durationFromProbe(probe) - 8.75) < 0.05,
    "длительность исходника должна быть 8,75 с",
  );
}

export function assertVideoMetadata(probe, expectedCodec) {
  const { video, audio } = getStreams(probe);
  assert.equal(video.length, 1, "результат должен содержать один видеопоток");
  assert.equal(audio.length, 0, "результат не должен содержать аудиопоток");
  assert.equal(video[0].codec_name, expectedCodec, `ожидается кодек ${expectedCodec}`);
  assert.equal(video[0].width, OUTPUT_WIDTH, "ширина результата должна быть 720");
  assert.equal(video[0].height, OUTPUT_HEIGHT, "высота результата должна быть 900");
  assert.ok(
    Math.abs(parseRate(video[0].r_frame_rate) - OUTPUT_FPS) < 0.001,
    "частота результата должна быть 24 FPS",
  );
  assert.ok(
    Math.abs(durationFromProbe(probe) - OUTPUT_DURATION_SECONDS) < 0.1,
    "длительность результата должна быть около 8,15 с",
  );
}

export function assertPosterMetadata(probe) {
  const { video, audio } = getStreams(probe);
  assert.equal(video.length, 1, "постер должен содержать один видеопоток");
  assert.equal(audio.length, 0, "постер не должен содержать аудиопоток");
  assert.equal(video[0].codec_name, "av1", "постер должен быть AVIF/AV1");
  assert.equal(video[0].width, OUTPUT_WIDTH, "ширина постера должна быть 720");
  assert.equal(video[0].height, OUTPUT_HEIGHT, "высота постера должна быть 900");
}

export async function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const input = createReadStream(filePath);
    input.on("error", rejectHash);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveHash(hash.digest("hex").toUpperCase()));
  });
}

function run(executable, args, capture = false) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Не удалось запустить ${executable}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = capture ? `\n${result.stderr || result.stdout}` : "";
    throw new Error(`${executable} завершился с кодом ${result.status}${details}`);
  }
  return result.stdout;
}

function assertTooling(ffmpegPath, ffprobePath) {
  run(ffprobePath, ["-version"], true);
  const encoders = run(ffmpegPath, ["-hide_banner", "-encoders"], true);
  for (const encoder of ["libx264", "libvpx-vp9", "libaom-av1"]) {
    assert.match(encoders, new RegExp(`\\b${encoder}\\b`), `ffmpeg не содержит ${encoder}`);
  }
}

async function probeMedia(filePath, ffprobePath) {
  const output = run(
    ffprobePath,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,duration",
      "-of",
      "json",
      filePath,
    ],
    true,
  );
  return JSON.parse(output);
}

async function replaceFile(fromPath, toPath) {
  if (existsSync(toPath)) {
    await unlink(toPath);
  }
  await rename(fromPath, toPath);
}

async function encodeWithinLimit({
  ffmpegPath,
  outputPath,
  maxBytes,
  initialCrf,
  maxCrf,
  step,
  buildArgs,
}) {
  const extension = outputPath.slice(outputPath.lastIndexOf("."));
  const temporaryPath = `${outputPath}.tmp${extension}`;

  for (let crf = initialCrf; crf <= maxCrf; crf += step) {
    if (existsSync(temporaryPath)) {
      await unlink(temporaryPath);
    }
    console.log(`Кодирование ${outputPath} (CRF ${crf})`);
    run(ffmpegPath, buildArgs(temporaryPath, crf));
    const { size } = await stat(temporaryPath);
    if (size <= maxBytes) {
      await replaceFile(temporaryPath, outputPath);
      return { crf, size };
    }
    console.log(`Размер ${size} байт превышает лимит ${maxBytes}; повышаю CRF.`);
  }

  if (existsSync(temporaryPath)) {
    await unlink(temporaryPath);
  }
  throw new Error(`${outputPath} не удалось уложить в лимит ${maxBytes} байт`);
}

export async function verifyArtifacts(outputDir, ffprobePath = "ffprobe") {
  const mp4Path = join(outputDir, "liquid-hero.mp4");
  const webmPath = join(outputDir, "liquid-hero.webm");
  const posterPath = join(outputDir, "liquid-hero-poster.avif");

  for (const artifactPath of [mp4Path, webmPath, posterPath]) {
    assert.ok(existsSync(artifactPath), `отсутствует ${artifactPath}`);
  }

  const [mp4Stat, webmStat, posterStat, mp4Probe, webmProbe, posterProbe] =
    await Promise.all([
      stat(mp4Path),
      stat(webmPath),
      stat(posterPath),
      probeMedia(mp4Path, ffprobePath),
      probeMedia(webmPath, ffprobePath),
      probeMedia(posterPath, ffprobePath),
    ]);

  assert.ok(mp4Stat.size <= MAX_VIDEO_BYTES, "MP4 превышает 3 500 000 байт");
  assert.ok(webmStat.size <= MAX_VIDEO_BYTES, "WebM превышает 3 500 000 байт");
  assert.ok(posterStat.size <= MAX_POSTER_BYTES, "AVIF превышает 250 000 байт");
  assertVideoMetadata(mp4Probe, "h264");
  assertVideoMetadata(webmProbe, "vp9");
  assertPosterMetadata(posterProbe);

  return {
    mp4: { path: mp4Path, size: mp4Stat.size, probe: mp4Probe },
    webm: { path: webmPath, size: webmStat.size, probe: webmProbe },
    poster: { path: posterPath, size: posterStat.size, probe: posterProbe },
  };
}

function parseArguments(argv) {
  const options = {
    ffmpegPath: "ffmpeg",
    ffprobePath: "ffprobe",
    sourcePath: DEFAULT_SOURCE,
    outputDir: DEFAULT_OUTPUT_DIR,
    verifyOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify-only") {
      options.verifyOnly = true;
      continue;
    }
    const key = {
      "--ffmpeg": "ffmpegPath",
      "--ffprobe": "ffprobePath",
      "--source": "sourcePath",
      "--output-dir": "outputDir",
    }[argument];
    if (!key || !argv[index + 1]) {
      throw new Error(`Неизвестный или неполный аргумент: ${argument}`);
    }
    options[key] = resolve(argv[index + 1]);
    index += 1;
  }

  return options;
}

function printReport(report) {
  console.log("Медиапайплайн проверен:");
  for (const [name, artifact] of Object.entries(report)) {
    const stream = artifact.probe.streams.find((item) => item.codec_type === "video");
    console.log(
      `- ${name}: ${artifact.size} байт, ${stream.codec_name}, ${stream.width}x${stream.height}`,
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assertTooling(options.ffmpegPath, options.ffprobePath);

  if (options.verifyOnly) {
    printReport(await verifyArtifacts(options.outputDir, options.ffprobePath));
    return;
  }

  assert.ok(existsSync(options.sourcePath), `исходник не найден: ${options.sourcePath}`);
  const actualHash = await sha256(options.sourcePath);
  assert.equal(
    actualHash,
    EXPECTED_SOURCE_SHA256,
    `SHA-256 исходника не совпадает: ${actualHash}`,
  );
  assertSourceMetadata(await probeMedia(options.sourcePath, options.ffprobePath));
  await mkdir(options.outputDir, { recursive: true });

  const mp4Path = join(options.outputDir, "liquid-hero.mp4");
  const webmPath = join(options.outputDir, "liquid-hero.webm");
  const posterPath = join(options.outputDir, "liquid-hero-poster.avif");

  const mp4 = await encodeWithinLimit({
    ffmpegPath: options.ffmpegPath,
    outputPath: mp4Path,
    maxBytes: MAX_VIDEO_BYTES,
    initialCrf: 25,
    maxCrf: 35,
    step: 2,
    buildArgs: (temporaryPath, crf) =>
      buildMp4Args(options.sourcePath, temporaryPath, crf),
  });
  const webm = await encodeWithinLimit({
    ffmpegPath: options.ffmpegPath,
    outputPath: webmPath,
    maxBytes: MAX_VIDEO_BYTES,
    initialCrf: 34,
    maxCrf: 44,
    step: 2,
    buildArgs: (temporaryPath, crf) =>
      buildWebmArgs(options.sourcePath, temporaryPath, crf),
  });
  const poster = await encodeWithinLimit({
    ffmpegPath: options.ffmpegPath,
    outputPath: posterPath,
    maxBytes: MAX_POSTER_BYTES,
    initialCrf: 30,
    maxCrf: 50,
    step: 4,
    buildArgs: (temporaryPath, crf) => buildPosterArgs(mp4Path, temporaryPath, crf),
  });

  console.log(
    `Выбраны CRF: MP4 ${mp4.crf}, WebM ${webm.crf}, AVIF ${poster.crf}.`,
  );
  printReport(await verifyArtifacts(options.outputDir, options.ffprobePath));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
