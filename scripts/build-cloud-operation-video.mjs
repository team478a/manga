import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const projectRoot = process.cwd();
const buildDirectory = path.join(projectRoot, ".tmp-cloud-operation-video");
const outputDirectory = path.join(projectRoot, "public", "manual", "cloud");

const workflowLabels = [
  "市場分析",
  "AI企画提案",
  "シナリオ作成",
  "ネーム作成",
  "原稿編集",
  "作品管理",
  "販売準備",
  "収益管理",
];

function intro(title, description) {
  return { duration: 4, title, lines: [description], kind: "intro" };
}

function imageScene(title, description, image, x, y) {
  return { duration: 7, title, lines: [description], image, focus: { x, y } };
}

function screenScene(activeStep, title, subtitle, items, action, x, y) {
  return {
    duration: 7,
    title,
    lines: [subtitle],
    screen: { activeStep, title, subtitle, items, action },
    focus: { x, y },
  };
}

const manuals = [
  {
    id: "01-market-analysis-guide",
    step: 1,
    title: "市場分析",
    scenes: [
      intro("市場分析", "作りたい方向を選び、売れやすい条件を確認します"),
      imageScene("ダッシュボードから開始", "左メニューの市場分析、または紫の開始ボタンを押します。", "01-dashboard.svg", 78, 25),
      screenScene(1, "AI市場分析", "作りたい作品を教えてください", ["ジャンル：AIにおまかせ", "テーマ・読後感：AIにおまかせ", "ページ数：4ページ または 8ページ"], "どんな作品が売れやすいか調べる", 63, 74),
      screenScene(1, "市場分析結果", "売れやすい方向を確認", ["想定読者と買われる理由", "価格・販売先の目安", "制作時の注意点"], "結果を保存してAI企画提案へ", 69, 75),
    ],
  },
  {
    id: "02-proposal-guide",
    step: 2,
    title: "AI企画提案",
    scenes: [
      intro("AI企画提案", "保存した市場分析から3つの企画を比較します"),
      screenScene(2, "AI企画提案への引継ぎ", "市場分析完了済み", ["市場分析の条件を確認", "ページ数と対象読者を確認", "作成済み企画の履歴を確認"], "AI企画を3案作成", 67, 76),
      screenScene(2, "企画候補を比較", "3案から制作する1案を選択", ["本命案：市場分析との適合", "差別化案：独自性を優先", "小さく試す案：制作しやすさを優先"], "企画の詳しい内容を見る", 67, 58),
      screenScene(2, "制作する企画を決定", "あらすじ・読者・作りやすさを確認", ["買われる理由", "制作上の注意点", "想定するページ数"], "この企画を採用", 67, 76),
    ],
  },
  {
    id: "03-scenario-guide",
    step: 3,
    title: "シナリオ作成",
    scenes: [
      intro("シナリオ作成", "採用企画を人物・三幕構成・シーンへ具体化します"),
      screenScene(3, "シナリオ生成", "採用済み企画を確認", ["企画タイトルと一文要約", "想定ページ数", "シナリオ版履歴"], "AIで初稿シナリオを作る", 67, 76),
      screenScene(3, "初稿シナリオを確認", "全体を上から順番に読む", ["登場人物", "三幕構成", "ページ単位のシーン"], "必要なら修正版を作成", 67, 76),
      screenScene(3, "制作する版を決定", "内容に問題がなければ採用", ["人物設定の一貫性", "起承転結とページ配分", "修正版との違い"], "このシナリオを採用", 67, 76),
    ],
  },
  {
    id: "04-storyboard-guide",
    step: 4,
    title: "ネーム作成",
    scenes: [
      intro("ネーム作成", "採用シナリオをページ・コマ・セリフへ変換します"),
      screenScene(4, "AIネーム・ページ構成", "採用シナリオを確認", ["ページ数と右綴じ", "ネーム版履歴", "画像生成はまだ行いません"], "AIで初稿ネームを作る", 67, 76),
      screenScene(4, "ページごとのネームを確認", "コマ割り・構図・セリフを確認", ["ページ番号とコマ数", "各コマの場面と構図", "吹き出しとセリフ"], "このネームを採用", 67, 76),
      screenScene(4, "Cloud Canvas下書きへ", "採用版を編集可能な原稿へ変換", ["全ページのコマ枠", "吹き出しとテキスト", "画像生成やcredit消費はなし"], "Canvas下書きを作成", 67, 76),
    ],
  },
  {
    id: "cloud-creator-operation-guide",
    step: 5,
    title: "原稿編集",
    scenes: [
      intro("原稿編集", "人物・画風の固定からPDF完成までを順番に確認します"),
      imageScene("作品画面で現在地を確認", "原稿チェックの残数を確認し、画像生成前の設定から始めます。", "03-creator-project.svg", 25, 36),
      imageScene("人物・衣装と画風を固定", "ページをまたいで変えたくない外見・衣装・場所・小物を保存します。", "03-creator-project.svg", 32, 72),
      imageScene("参照画像をコマへ割り当て", "人物・場所・小物の見本を登録し、必要なコマへ割り当てます。", "03-creator-project.svg", 79, 72),
      imageScene("最初は連続2ページだけ選択", "少ない範囲で人物と画風を確認してから次のページへ広げます。", "04-generation-preflight.svg", 20, 28),
      imageScene("必要creditと停止理由を確認", "利用枠と最大予約費用を確認し、開始ボタンは1回だけ押します。", "04-generation-preflight.svg", 57, 61),
      imageScene("生成候補を比較して採用", "顔・手・衣装・背景・疑似文字を確認し、使う候補を配置します。", "06-candidate-review.svg", 84, 77),
      imageScene("吹き出しと文字を調整", "画像を作り直さず、位置・大きさ・縦書きを整えます。", "07-dialogue-edit.svg", 53, 50),
      imageScene("全ページを確定してPDF保存", "原稿チェック解消、全ページ確定、完成版固定、PDFの順です。", "05-export.svg", 65, 54),
    ],
  },
  {
    id: "06-work-management-guide",
    step: 6,
    title: "作品管理",
    scenes: [
      intro("作品管理", "制作中・完成済みの作品を一覧から確認します"),
      screenScene(6, "作品管理", "自分が作成した作品の一覧", ["作品名と対象年齢", "制作中・完成などの状態", "更新日時とページ数"], "作品を開く", 67, 58),
      screenScene(6, "作品情報を確認", "現在の進捗と次の操作を確認", ["原稿チェックの残数", "完成版とPDFの状態", "公開・販売準備の状態"], "原稿編集を続ける", 67, 76),
      screenScene(6, "完成作品の次の操作", "PDFを確認して販売準備へ", ["PDFをダウンロード", "作品名・説明・対象年齢を確認", "固定した完成版を選択"], "販売準備へ進む", 67, 76),
    ],
  },
  {
    id: "07-sales-preparation-guide",
    step: 7,
    title: "販売準備",
    scenes: [
      intro("販売準備", "完成版を選び、商品を停止中の状態で準備します"),
      screenScene(7, "販売準備", "完成版と販売情報を確認", ["作品名・説明・対象年齢", "表紙と販売ファイル", "税込価格"], "販売下書きを作成", 67, 76),
      screenScene(7, "販売下書きを確認", "公開前・販売停止中の安全な状態", ["作品：非公開", "商品：停止中", "注文・決済：0件"], "作品を公開設定する", 67, 76),
      screenScene(7, "公開後に商品を確認", "商品名・価格・販売ファイルを再確認", ["公開作品ページ", "サンプル範囲", "購入者への表示内容"], "商品の販売を開始する", 67, 76),
    ],
  },
  {
    id: "08-sales-management-guide",
    step: 8,
    title: "収益管理",
    scenes: [
      intro("収益管理", "注文・金額・状態を作品ごとに確認します"),
      screenScene(8, "売上管理", "注文状況のサマリー", ["支払い済み注文", "テスト注文", "受取予定額"], "注文一覧を確認", 67, 58),
      screenScene(8, "注文の状態を確認", "作品・商品・購入区分を確認", ["注文日時と購入者", "本番・テストの区分", "支払い・返金の状態"], "注文の詳細を見る", 67, 66),
      screenScene(8, "作品ごとの売上を確認", "テスト注文は受取予定額に含めない", ["販売数と合計金額", "返金・取消の有無", "振込・精算は現在準備中"], "作品管理へ戻る", 67, 76),
    ],
  },
];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function timestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000`;
}

function actualScreenSvg(screen) {
  const sidebar = workflowLabels.map((label, index) => {
    const active = index + 1 === screen.activeStep;
    const y = 176 + index * 48;
    return `${active ? `<rect x="20" y="${y - 30}" width="236" height="40" rx="9" fill="#ede9fe"/>` : ""}<text x="38" y="${y}" fill="${active ? "#6d28d9" : "#57534e"}" font-size="16" font-weight="${active ? "700" : "500"}">${index + 1}　${escapeXml(label)}</text>`;
  }).join("");
  const items = screen.items.map((item, index) => {
    const y = 296 + index * 74;
    return `<rect x="352" y="${y - 38}" width="770" height="58" rx="12" fill="${index === 0 ? "#f5f3ff" : "#fafaf9"}" stroke="#e7e5e4"/><circle cx="382" cy="${y - 9}" r="12" fill="#ede9fe"/><path d="M376 ${y - 9}l5 5 9-11" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="408" y="${y - 3}" fill="#292524" font-size="17">${escapeXml(item)}</text>`;
  }).join("");
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>text { font-family: "Yu Gothic", "Meiryo", sans-serif; }</style>
      <rect width="1280" height="720" fill="#f7f5ff"/><rect width="1280" height="82" fill="#fff"/>
      <text x="42" y="52" fill="#6d28d9" font-size="29" font-weight="700">MANGAI</text><text x="161" y="51" fill="#78716c" font-size="14">インディーズ漫画のデジタル書店</text>
      <rect x="0" y="82" width="278" height="638" fill="#fff"/><rect x="20" y="101" width="236" height="54" rx="11" fill="#f5f3ff"/>
      <text x="38" y="124" fill="#7c3aed" font-size="12">現在の制作進行</text><text x="38" y="145" fill="#18181b" font-size="15" font-weight="700">一般向け制作ワークフロー</text>
      ${sidebar}
      <text x="326" y="128" fill="#6d28d9" font-size="15" font-weight="700">STEP ${screen.activeStep}</text><text x="326" y="171" fill="#18181b" font-size="34" font-weight="700">${escapeXml(screen.title)}</text><text x="326" y="207" fill="#57534e" font-size="18">${escapeXml(screen.subtitle)}</text>
      <rect x="326" y="232" width="824" height="306" rx="18" fill="#fff" stroke="#ddd6fe"/>${items}
      <rect x="748" y="557" width="374" height="58" rx="11" fill="#6d28d9"/><text x="935" y="593" fill="#fff" text-anchor="middle" font-size="18" font-weight="700">${escapeXml(screen.action)}</text>
      <rect x="326" y="636" width="824" height="54" rx="12" fill="#ecfdf5"/><text x="352" y="670" fill="#065f46" font-size="16">保存または採用が完了すると、次の工程へ進めます。</text>
    </svg>
  `);
}

function overlaySvg(manual, scene, sceneIndex) {
  const isIntro = scene.kind === "intro";
  const titleY = isIntro ? 322 : 553;
  const lineY = isIntro ? 385 : 610;
  const operationCount = manual.scenes.length - 1;
  const badge = isIntro ? `<rect x="1016" y="44" width="214" height="48" rx="24" fill="#6d28d9"/><text x="1123" y="76" text-anchor="middle" class="badge">STEP ${manual.step} / 8</text>` : `<rect x="1035" y="44" width="195" height="48" rx="24" fill="#6d28d9"/><text x="1132" y="76" text-anchor="middle" class="badge">操作 ${sceneIndex} / ${operationCount}</text>`;
  const focus = scene.focus ? `<circle cx="${Math.round((scene.focus.x / 100) * WIDTH)}" cy="${Math.round((scene.focus.y / 100) * HEIGHT)}" r="28" fill="rgba(255,255,255,.76)" stroke="#6d28d9" stroke-width="6"/><circle cx="${Math.round((scene.focus.x / 100) * WIDTH)}" cy="${Math.round((scene.focus.y / 100) * HEIGHT)}" r="6" fill="#6d28d9"/>` : "";
  const footer = isIntro ? '<rect x="100" y="210" width="1080" height="300" rx="32" fill="#fff" stroke="#ddd6fe" stroke-width="3"/>' : '<rect x="0" y="500" width="1280" height="220" fill="rgba(12,10,9,.93)"/>';
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>text { font-family: "Yu Gothic", "Meiryo", sans-serif; }.badge { fill:#fff;font-size:20px;font-weight:700; }</style>
      ${footer}${badge}${focus}
      <text x="640" y="${titleY}" text-anchor="middle" fill="${isIntro ? "#18181b" : "#fff"}" font-size="${isIntro ? 48 : 34}" font-weight="700">${escapeXml(scene.title)}</text>
      ${scene.lines.map((line, index) => `<text x="640" y="${lineY + index * 38}" text-anchor="middle" fill="${isIntro ? "#57534e" : "#e7e5e4"}" font-size="23">${escapeXml(line)}</text>`).join("")}
      <text x="1228" y="691" text-anchor="end" fill="${isIntro ? "#7c3aed" : "#c4b5fd"}" font-size="18" font-weight="700">MANGAI Creator</text>
    </svg>
  `);
}

async function renderScene(manual, scene, index, directory) {
  const canvas = sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: scene.kind === "intro" ? "#f5f3ff" : "#1c1917" } });
  const composites = [];
  if (scene.image) {
    composites.push({ input: await sharp(path.join(outputDirectory, scene.image)).resize(WIDTH, HEIGHT, { fit: "contain", background: "#1c1917" }).png().toBuffer(), left: 0, top: 0 });
  } else if (scene.screen) {
    composites.push({ input: actualScreenSvg(scene.screen), left: 0, top: 0 });
  }
  composites.push({ input: overlaySvg(manual, scene, index), left: 0, top: 0 });
  const output = path.join(directory, `${String(index).padStart(2, "0")}.png`);
  await canvas.composite(composites).png().toFile(output);
  return output;
}

function runFfmpeg(executable, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
  });
}

function assertSafeBuildDirectory() {
  if (path.dirname(buildDirectory) !== projectRoot || path.basename(buildDirectory) !== ".tmp-cloud-operation-video") throw new Error("Unsafe manual video build directory.");
}

async function buildManual(ffmpeg, manual) {
  const directory = path.join(buildDirectory, manual.id);
  await mkdir(directory, { recursive: true });
  const files = [];
  for (let index = 0; index < manual.scenes.length; index += 1) files.push(await renderScene(manual, manual.scenes[index], index, directory));
  let cursor = 0;
  const captions = ["WEBVTT", ""];
  for (const scene of manual.scenes) {
    captions.push(`${timestamp(cursor)} --> ${timestamp(cursor + scene.duration)}`);
    captions.push(`${scene.title}\n${scene.lines.join(" ")}`, "");
    cursor += scene.duration;
  }
  await writeFile(path.join(outputDirectory, `${manual.id}.vtt`), `${captions.join("\n")}\n`, "utf8");
  await sharp(files[1]).webp({ quality: 88 }).toFile(path.join(outputDirectory, `${manual.id}-poster.webp`));
  const inputArguments = files.flatMap((file, index) => ["-loop", "1", "-framerate", String(FPS), "-t", String(manual.scenes[index].duration), "-i", file]);
  const inputLabels = files.map((_, index) => `[${index}:v]`).join("");
  await runFfmpeg(ffmpeg, ["-y", ...inputArguments, "-filter_complex", `${inputLabels}concat=n=${files.length}:v=1:a=0,format=yuv420p[video]`, "-map", "[video]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-movflags", "+faststart", path.join(outputDirectory, `${manual.id}.mp4`)]);
}

async function main() {
  const ffmpeg = process.env.MANGAI_FFMPEG_PATH?.trim();
  if (!ffmpeg) throw new Error("MANGAI_FFMPEG_PATH is required.");
  assertSafeBuildDirectory();
  await rm(buildDirectory, { recursive: true, force: true });
  await mkdir(buildDirectory, { recursive: true });
  try {
    for (const manual of manuals) await buildManual(ffmpeg, manual);
  } finally {
    await rm(buildDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Video build failed.");
  process.exitCode = 1;
});
