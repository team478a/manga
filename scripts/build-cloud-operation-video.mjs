import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const projectRoot = process.cwd();
const buildDirectory = path.join(projectRoot, ".tmp-cloud-operation-video");
const outputPath = path.join(
  projectRoot,
  "public",
  "manual",
  "cloud",
  "cloud-creator-operation-guide.mp4",
);
const posterPath = path.join(
  projectRoot,
  "public",
  "manual",
  "cloud",
  "cloud-creator-operation-guide-poster.webp",
);
const captionPath = path.join(
  projectRoot,
  "public",
  "manual",
  "cloud",
  "cloud-creator-operation-guide.vtt",
);

const scenes = [
  {
    duration: 5,
    title: "MANGAI Cloud",
    lines: ["原稿編集からPDF完成まで", "8つの操作を約1分で確認します"],
  },
  {
    duration: 7,
    step: 1,
    title: "作品画面で現在地を確認",
    lines: ["原稿チェックの残数を確認し、", "画像生成前の設定から始めます。"],
    image: "03-creator-project.svg",
    focus: { x: 25, y: 36 },
  },
  {
    duration: 8,
    step: 2,
    title: "人物・衣装と画風を固定",
    lines: ["ページをまたいで変えたくない外見・衣装・", "場所・小物を先に保存します。"],
    image: "03-creator-project.svg",
    focus: { x: 32, y: 72 },
  },
  {
    duration: 7,
    step: 3,
    title: "参照画像をコマへ割り当て",
    lines: ["人物・場所・小物の見本を登録し、", "必要なコマへ割り当てます。"],
    image: "03-creator-project.svg",
    focus: { x: 79, y: 72 },
  },
  {
    duration: 8,
    step: 4,
    title: "最初は連続2ページだけ選択",
    lines: ["少ない範囲で人物と画風を確認してから、", "次のページへ広げます。"],
    image: "04-generation-preflight.svg",
    focus: { x: 20, y: 28 },
  },
  {
    duration: 8,
    step: 5,
    title: "必要creditと停止理由を確認",
    lines: ["利用枠と最大予約費用を確認し、", "開始ボタンは1回だけ押します。"],
    image: "04-generation-preflight.svg",
    focus: { x: 57, y: 61 },
  },
  {
    duration: 8,
    step: 6,
    title: "生成候補を比較して採用",
    lines: ["顔・手・衣装・背景・疑似文字を確認し、", "使う候補だけをコマへ配置します。"],
    image: "06-candidate-review.svg",
    focus: { x: 84, y: 77 },
  },
  {
    duration: 8,
    step: 7,
    title: "吹き出しと文字を調整",
    lines: ["セリフ修正では画像を作り直さず、", "位置・大きさ・縦書きを整えます。"],
    image: "07-dialogue-edit.svg",
    focus: { x: 53, y: 50 },
  },
  {
    duration: 8,
    step: 8,
    title: "全ページを確定してPDF保存",
    lines: ["原稿チェック解消 → 全ページ確定 →", "完成版固定 → PDF書き出しの順です。"],
    image: "05-export.svg",
    focus: { x: 65, y: 54 },
  },
  {
    duration: 6,
    title: "迷ったときは「使い方」へ",
    lines: ["画面の紫色の次操作を1つずつ進めます。", "生成ボタンは連打しないでください。"],
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function timestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000`;
}

function overlaySvg(scene) {
  const isCard = !scene.image;
  const titleY = isCard ? 318 : 545;
  const lineY = isCard ? 382 : 602;
  const stepBadge = scene.step
    ? `<rect x="1106" y="42" width="126" height="48" rx="24" fill="#6d28d9"/><text x="1169" y="74" text-anchor="middle" class="step">操作 ${scene.step} / 8</text>`
    : "";
  const focus = scene.focus
    ? `<circle cx="${Math.round((scene.focus.x / 100) * WIDTH)}" cy="${Math.round((scene.focus.y / 100) * HEIGHT)}" r="28" fill="rgba(255,255,255,.72)" stroke="#6d28d9" stroke-width="6"/><circle cx="${Math.round((scene.focus.x / 100) * WIDTH)}" cy="${Math.round((scene.focus.y / 100) * HEIGHT)}" r="6" fill="#6d28d9"/>`
    : "";
  const footer = scene.image
    ? '<rect x="0" y="490" width="1280" height="230" fill="rgba(12,10,9,.92)"/>'
    : '<rect x="100" y="210" width="1080" height="300" rx="32" fill="#ffffff" stroke="#ddd6fe" stroke-width="3"/>';
  const titleColor = scene.image ? "#ffffff" : "#18181b";
  const lineColor = scene.image ? "#e7e5e4" : "#57534e";
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { font-family: "Yu Gothic", "Meiryo", sans-serif; }
        .step { fill: #fff; font-size: 20px; font-weight: 700; }
      </style>
      ${footer}
      ${stepBadge}
      ${focus}
      <text x="640" y="${titleY}" text-anchor="middle" fill="${titleColor}" font-size="${isCard ? 48 : 36}" font-weight="700">${escapeXml(scene.title)}</text>
      ${scene.lines
        .map(
          (line, index) =>
            `<text x="640" y="${lineY + index * 40}" text-anchor="middle" fill="${lineColor}" font-size="24">${escapeXml(line)}</text>`,
        )
        .join("")}
      <text x="1228" y="690" text-anchor="end" fill="${scene.image ? "#c4b5fd" : "#7c3aed"}" font-size="18" font-weight="700">MANGAI Creator</text>
    </svg>
  `);
}

async function renderScene(scene, index) {
  const canvas = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: scene.image ? "#1c1917" : "#f5f3ff",
    },
  });
  const composites = [];
  if (scene.image) {
    const imagePath = path.join(
      projectRoot,
      "public",
      "manual",
      "cloud",
      scene.image,
    );
    composites.push({
      input: await sharp(imagePath)
        .resize(WIDTH, HEIGHT, { fit: "contain", background: "#1c1917" })
        .png()
        .toBuffer(),
      left: 0,
      top: 0,
    });
  }
  composites.push({ input: overlaySvg(scene), left: 0, top: 0 });
  const output = path.join(buildDirectory, `${String(index).padStart(2, "0")}.png`);
  await canvas.composite(composites).png().toFile(output);
  return output;
}

function runFfmpeg(executable, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function assertSafeBuildDirectory() {
  if (
    path.dirname(buildDirectory) !== projectRoot ||
    path.basename(buildDirectory) !== ".tmp-cloud-operation-video"
  ) {
    throw new Error("Unsafe manual video build directory.");
  }
}

async function main() {
  const ffmpeg = process.env.MANGAI_FFMPEG_PATH?.trim();
  if (!ffmpeg) throw new Error("MANGAI_FFMPEG_PATH is required.");
  assertSafeBuildDirectory();
  await rm(buildDirectory, { recursive: true, force: true });
  await mkdir(buildDirectory, { recursive: true });

  try {
    const files = [];
    for (let index = 0; index < scenes.length; index += 1) {
      files.push(await renderScene(scenes[index], index));
    }

    let cursor = 0;
    const captions = ["WEBVTT", ""];
    for (const scene of scenes) {
      captions.push(`${timestamp(cursor)} --> ${timestamp(cursor + scene.duration)}`);
      captions.push(`${scene.title}\n${scene.lines.join(" ")}`, "");
      cursor += scene.duration;
    }
    await writeFile(captionPath, `${captions.join("\n")}\n`, "utf8");

    await sharp(files[1]).webp({ quality: 88 }).toFile(posterPath);
    const inputArguments = files.flatMap((file, index) => [
      "-loop",
      "1",
      "-framerate",
      String(FPS),
      "-t",
      String(scenes[index].duration),
      "-i",
      file,
    ]);
    const inputLabels = files.map((_, index) => `[${index}:v]`).join("");
    await runFfmpeg(ffmpeg, [
      "-y",
      ...inputArguments,
      "-filter_complex",
      `${inputLabels}concat=n=${files.length}:v=1:a=0,format=yuv420p[video]`,
      "-map",
      "[video]",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "22",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  } finally {
    await rm(buildDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Video build failed.");
  process.exitCode = 1;
});
