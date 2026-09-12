import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_POSTER_BYTES,
  MAX_VIDEO_BYTES,
  assertPosterMetadata,
  assertSourceMetadata,
  assertVideoMetadata,
  buildMp4Args,
  buildPosterArgs,
  buildVideoFilter,
  buildWebmArgs,
  parseRate,
} from "./encode-liquid-hero.mjs";

function probeFixture({
  codec = "h264",
  profile = "Main",
  width = 1080,
  height = 1440,
  rate = "24/1",
  duration = "8.750000",
  audio = false,
} = {}) {
  const streams = [
    {
      codec_type: "video",
      codec_name: codec,
      profile,
      width,
      height,
      r_frame_rate: rate,
      duration,
    },
  ];
  if (audio) {
    streams.push({ codec_type: "audio", codec_name: "aac" });
  }
  return { streams, format: { duration } };
}

test("buildVideoFilter собирает seam crossfade и целевую геометрию", () => {
  const filter = buildVideoFilter();

  assert.match(filter, /trim=start=0\.60:end=8\.15/);
  assert.match(filter, /trim=start=8\.15:end=8\.75/);
  assert.match(filter, /trim=start=0:end=0\.60/);
  assert.match(filter, /xfade=transition=fade:duration=0\.60:offset=0/);
  assert.match(filter, /concat=n=2:v=1:a=0/);
  assert.match(filter, /crop=1080:1350:0:45/);
  assert.match(filter, /scale=720:900:flags=lanczos/);
  assert.match(filter, /fps=24/);
});

test("аргументы MP4 фиксируют H.264, CRF, preset и faststart", () => {
  const args = buildMp4Args("source.mp4", "result.mp4");

  assert.equal(args[args.indexOf("-c:v") + 1], "libx264");
  assert.equal(args[args.indexOf("-preset") + 1], "slow");
  assert.equal(args[args.indexOf("-crf") + 1], "25");
  assert.equal(args[args.indexOf("-pix_fmt") + 1], "yuv420p");
  assert.equal(args[args.indexOf("-movflags") + 1], "+faststart");
  assert.equal(args.at(-1), "result.mp4");
  assert.ok(args.includes("-an"));
});

test("аргументы WebM фиксируют VP9 в constant-quality режиме", () => {
  const args = buildWebmArgs("source.mp4", "result.webm");

  assert.ok(args.includes("libvpx-vp9"));
  assert.equal(args[args.indexOf("-crf") + 1], "34");
  assert.equal(args[args.indexOf("-b:v") + 1], "0");
  assert.equal(args[args.indexOf("-row-mt") + 1], "1");
  assert.ok(args.includes("-an"));
});

test("постер кодируется как AVIF из кадра после шва", () => {
  const args = buildPosterArgs("result.mp4", "poster.avif");

  assert.equal(args[args.indexOf("-ss") + 1], "0.10");
  assert.equal(args[args.indexOf("-c:v") + 1], "libaom-av1");
  assert.equal(args[args.indexOf("-still-picture") + 1], "1");
  assert.equal(args[args.indexOf("-frames:v") + 1], "1");
});

test("метаданные исходника соответствуют зафиксированному контракту", () => {
  assert.doesNotThrow(() => assertSourceMetadata(probeFixture()));
  assert.throws(
    () => assertSourceMetadata(probeFixture({ audio: true })),
    /аудиопоток/,
  );
  assert.throws(
    () => assertSourceMetadata(probeFixture({ width: 720 })),
    /1080/,
  );
});

test("метаданные runtime-видео и постера проверяют кодеки и размеры", () => {
  const video = probeFixture({
    codec: "vp9",
    profile: "Profile 0",
    width: 720,
    height: 900,
    duration: "8.150000",
  });
  const poster = probeFixture({
    codec: "av1",
    profile: "Main",
    width: 720,
    height: 900,
    duration: "0.040000",
  });

  assert.doesNotThrow(() => assertVideoMetadata(video, "vp9"));
  assert.doesNotThrow(() => assertPosterMetadata(poster));
  assert.throws(() => assertVideoMetadata(video, "h264"), /h264/);
});

test("лимиты и дробная частота кадров заданы без двусмысленности", () => {
  assert.equal(MAX_VIDEO_BYTES, 3_500_000);
  assert.equal(MAX_POSTER_BYTES, 250_000);
  assert.equal(parseRate("24000/1000"), 24);
});
