import fs from "node:fs/promises";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import JSZip from "jszip";
import os from "node:os";
import { featureFlagEnabled } from "../feature-flags.ts";

const MANGAI_ROOT = path.join(os.homedir(), "Documents", "MANGAI");
const PROJECTS_ROOT = path.join(MANGAI_ROOT, "projects");
const DB_PATH = path.join(MANGAI_ROOT, "mangai_local.sqlite");

export function isLegacyLocalSalesEnabled() {
  return featureFlagEnabled("MANGAI_ENABLE_LEGACY_LOCAL_TOOLS");
}

const ADULT_NOTICE_LINES = [
  "18歳未満閲覧禁止",
  "登場人物はすべて成人であること",
  "実在人物ではないこと",
  "違法コンテンツを含まないこと"
];

export type SalesPackageRecord = {
  id: string;
  project_id: string;
  title: string;
  subtitle: string;
  sales_description: string;
  short_intro: string;
  catch_copy: string;
  genre: string;
  tags: string[];
  thumbnail_text: string;
  sns_post: string;
  notice: string;
  age_rating: string;
  price_note: string;
  sales_sites: string;
  cover_image_path: string;
  thumbnail_image_path: string;
  created_at: string;
  updated_at: string;
};

export type GeneratedImageOption = {
  label: string;
  path: string;
};

export function sanitizeProjectId(projectId: string) {
  const cleaned = projectId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return cleaned || "default";
}

export function getProjectDir(projectId: string) {
  return path.join(PROJECTS_ROOT, sanitizeProjectId(projectId));
}

export function getSalesPackageDir(projectId: string) {
  return path.join(getProjectDir(projectId), "sales_package");
}

function ensureInsideMangai(targetPath: string) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(MANGAI_ROOT);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Documents/MANGAI フォルダ内のファイルだけを読み込めます。");
  }
  return resolved;
}

async function ensureBaseDirs() {
  await fs.mkdir(PROJECTS_ROOT, { recursive: true });
}

async function openDb() {
  await ensureBaseDirs();
  const db = new DatabaseConstructor(DB_PATH);
  migrate(db);
  return db;
}

async function saveDb(db: SqliteDatabase) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  db.close();
}

function migrate(db: SqliteDatabase) {
  db.exec(`
    create table if not exists sales_packages (
      id text primary key,
      project_id text not null,
      title text not null,
      subtitle text not null default '',
      sales_description text not null default '',
      short_intro text not null default '',
      catch_copy text not null default '',
      genre text not null default '',
      tags_json text not null default '[]',
      thumbnail_text text not null default '',
      sns_post text not null default '',
      notice text not null default '',
      age_rating text not null default '全年齢',
      price_note text not null default '',
      sales_sites text not null default '',
      cover_image_path text not null default '',
      thumbnail_image_path text not null default '',
      created_at text not null,
      updated_at text not null
    );

    create table if not exists ai_sales_texts (
      id text primary key,
      package_id text not null,
      project_id text not null,
      sales_description text not null default '',
      short_intro text not null default '',
      catch_copy text not null default '',
      tags_json text not null default '[]',
      thumbnail_text text not null default '',
      sns_post text not null default '',
      notice text not null default '',
      created_at text not null
    );

    create table if not exists export_history (
      id text primary key,
      package_id text not null,
      project_id text not null,
      export_path text not null,
      created_at text not null
    );
  `);
}

function rowToRecord(row: Record<string, unknown>): SalesPackageRecord {
  return {
    id: String(row.id ?? ""),
    project_id: String(row.project_id ?? ""),
    title: String(row.title ?? ""),
    subtitle: String(row.subtitle ?? ""),
    sales_description: String(row.sales_description ?? ""),
    short_intro: String(row.short_intro ?? ""),
    catch_copy: String(row.catch_copy ?? ""),
    genre: String(row.genre ?? ""),
    tags: JSON.parse(String(row.tags_json ?? "[]")) as string[],
    thumbnail_text: String(row.thumbnail_text ?? ""),
    sns_post: String(row.sns_post ?? ""),
    notice: String(row.notice ?? ""),
    age_rating: String(row.age_rating ?? "全年齢"),
    price_note: String(row.price_note ?? ""),
    sales_sites: String(row.sales_sites ?? ""),
    cover_image_path: String(row.cover_image_path ?? ""),
    thumbnail_image_path: String(row.thumbnail_image_path ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? "")
  };
}

function first(db: SqliteDatabase, sql: string, params: Record<string, string>) {
  return (db.prepare(sql).get(params) as Record<string, unknown> | undefined) ?? null;
}

export async function getSalesPackage(projectId: string, packageId?: string) {
  const db = await openDb();
  try {
    const row = packageId
      ? first(db, "select * from sales_packages where id = @id and project_id = @projectId", {
          id: packageId,
          projectId: sanitizeProjectId(projectId)
        })
      : first(db, "select * from sales_packages where project_id = @projectId order by updated_at desc limit 1", {
          projectId: sanitizeProjectId(projectId)
        });
    return row ? rowToRecord(row) : null;
  } finally {
    db.close();
  }
}

export async function listGeneratedImages(projectId: string): Promise<GeneratedImageOption[]> {
  const projectDir = getProjectDir(projectId);
  const dirs = ["generated_images", "images", "assets"].map((dir) => path.join(projectDir, dir));
  const results: GeneratedImageOption[] = [];

  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        if (!/\.(jpe?g|png|webp)$/i.test(file.name)) continue;
        const fullPath = path.join(dir, file.name);
        results.push({
          label: `${path.basename(dir)} / ${file.name}`,
          path: fullPath
        });
      }
    } catch {
      // Missing generated image folders are expected for a new local project.
    }
  }

  return results;
}

function tagsFromText(value: string) {
  return value
    .split(/[,、\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function withAdultNotice(notice: string, ageRating: string) {
  if (ageRating !== "成人向け") return notice.trim();
  const lines = new Set(notice.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  ADULT_NOTICE_LINES.forEach((line) => lines.add(line));
  return Array.from(lines).join("\n");
}

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readForm(formData: FormData, existing?: SalesPackageRecord | null) {
  const ageRating = formText(formData, "ageRating") || "全年齢";
  const tags = tagsFromText(formText(formData, "tags"));
  return {
    id: formText(formData, "packageId") || existing?.id || crypto.randomUUID(),
    project_id: sanitizeProjectId(formText(formData, "projectId") || existing?.project_id || "default"),
    title: formText(formData, "title") || existing?.title || "無題の作品",
    subtitle: formText(formData, "subtitle"),
    sales_description: formText(formData, "salesDescription"),
    short_intro: formText(formData, "shortIntro"),
    catch_copy: formText(formData, "catchCopy"),
    genre: formText(formData, "genre"),
    tags,
    thumbnail_text: formText(formData, "thumbnailText"),
    sns_post: formText(formData, "snsPost"),
    notice: withAdultNotice(formText(formData, "notice"), ageRating),
    age_rating: ageRating,
    price_note: formText(formData, "priceNote"),
    sales_sites: formText(formData, "salesSites"),
    cover_image_path: existing?.cover_image_path ?? "",
    thumbnail_image_path: existing?.thumbnail_image_path ?? ""
  };
}

export function generateSalesText(input: ReturnType<typeof readForm>) {
  const title = input.title || "この作品";
  const genre = input.genre || "漫画";
  const tags = input.tags.length ? input.tags : ["AI漫画", genre, "創作"];
  const shortIntro = `${title}は、${genre}が好きな方に向けた読みやすい漫画作品です。`;
  const catchCopy = input.subtitle ? `${input.subtitle} - ${title}` : `${title}、いま届けたい物語。`;
  const description = [
    `${title}は、作品世界の雰囲気とキャラクターの魅力を楽しめる${genre}作品です。`,
    input.subtitle ? `サブタイトルは「${input.subtitle}」。` : "",
    "スマートフォンでも読みやすい販売用パッケージとしてまとめられるよう、説明文・タグ・告知文を整えています。",
    input.price_note ? `価格メモ：${input.price_note}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const thumbnailText = `${title}\n${genre}作品`;
  const snsPost = `新作「${title}」の販売準備ができました。\n${input.short_intro || shortIntro}\n${tags.map((tag) => `#${tag.replace(/\s/g, "")}`).join(" ")}`;
  const notice = withAdultNotice(input.notice || "購入前に商品内容、対応形式、閲覧環境をご確認ください。", input.age_rating);

  return {
    sales_description: description,
    short_intro: input.short_intro || shortIntro,
    catch_copy: input.catch_copy || catchCopy,
    tags,
    thumbnail_text: input.thumbnail_text || thumbnailText,
    sns_post: input.sns_post || snsPost,
    notice
  };
}

async function saveUploadedFile(projectId: string, kind: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return "";
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const dir = path.join(getProjectDir(projectId), "sales_assets", kind);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${crypto.randomUUID()}-${safeName}`);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

async function copyExternalImage(projectId: string, kind: string, sourcePath: string) {
  if (!sourcePath) return "";
  const resolved = ensureInsideMangai(sourcePath);
  if (!/\.(jpe?g|png|webp)$/i.test(resolved)) {
    throw new Error("外部画像はJPG、PNG、WebPのいずれかを選んでください。");
  }
  const dir = path.join(getProjectDir(projectId), "sales_assets", kind);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${crypto.randomUUID()}-${path.basename(resolved)}`);
  await fs.copyFile(resolved, dest);
  return dest;
}

async function resolveImagePath(projectId: string, kind: "cover" | "thumbnail", formData: FormData, currentPath: string) {
  const upload = await saveUploadedFile(projectId, kind, formData.get(`${kind}Image`));
  if (upload) return upload;

  const selected = formText(formData, `${kind}GeneratedPath`);
  if (selected) return ensureInsideMangai(selected);

  const external = await copyExternalImage(projectId, kind, formText(formData, `${kind}ExternalPath`));
  if (external) return external;

  return currentPath;
}

export async function saveSalesPackageFromForm(formData: FormData, options: { generate?: boolean } = {}) {
  const existing = await getSalesPackage(formText(formData, "projectId"), formText(formData, "packageId"));
  const input = readForm(formData, existing);
  const generated = options.generate ? generateSalesText(input) : null;
  const now = new Date().toISOString();
  const record: SalesPackageRecord = {
    ...input,
    sales_description: generated?.sales_description ?? input.sales_description,
    short_intro: generated?.short_intro ?? input.short_intro,
    catch_copy: generated?.catch_copy ?? input.catch_copy,
    tags: generated?.tags ?? input.tags,
    thumbnail_text: generated?.thumbnail_text ?? input.thumbnail_text,
    sns_post: generated?.sns_post ?? input.sns_post,
    notice: generated?.notice ?? input.notice,
    cover_image_path: await resolveImagePath(input.project_id, "cover", formData, input.cover_image_path),
    thumbnail_image_path: await resolveImagePath(input.project_id, "thumbnail", formData, input.thumbnail_image_path),
    created_at: existing?.created_at ?? now,
    updated_at: now
  };

  const db = await openDb();
  try {
    db.prepare(
      `insert into sales_packages (
        id, project_id, title, subtitle, sales_description, short_intro, catch_copy, genre,
        tags_json, thumbnail_text, sns_post, notice, age_rating, price_note, sales_sites,
        cover_image_path, thumbnail_image_path, created_at, updated_at
      ) values (
        @id, @projectId, @title, @subtitle, @salesDescription, @shortIntro, @catchCopy, @genre,
        @tagsJson, @thumbnailText, @snsPost, @notice, @ageRating, @priceNote, @salesSites,
        @coverImagePath, @thumbnailImagePath, @createdAt, @updatedAt
      )
      on conflict(id) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        sales_description = excluded.sales_description,
        short_intro = excluded.short_intro,
        catch_copy = excluded.catch_copy,
        genre = excluded.genre,
        tags_json = excluded.tags_json,
        thumbnail_text = excluded.thumbnail_text,
        sns_post = excluded.sns_post,
        notice = excluded.notice,
        age_rating = excluded.age_rating,
        price_note = excluded.price_note,
        sales_sites = excluded.sales_sites,
        cover_image_path = excluded.cover_image_path,
        thumbnail_image_path = excluded.thumbnail_image_path,
        updated_at = excluded.updated_at`,
    ).run({
      id: record.id,
      projectId: record.project_id,
      title: record.title,
      subtitle: record.subtitle,
      salesDescription: record.sales_description,
      shortIntro: record.short_intro,
      catchCopy: record.catch_copy,
      genre: record.genre,
      tagsJson: JSON.stringify(record.tags),
      thumbnailText: record.thumbnail_text,
      snsPost: record.sns_post,
      notice: record.notice,
      ageRating: record.age_rating,
      priceNote: record.price_note,
      salesSites: record.sales_sites,
      coverImagePath: record.cover_image_path,
      thumbnailImagePath: record.thumbnail_image_path,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    });

    if (generated) {
      db.prepare(
        `insert into ai_sales_texts (
          id, package_id, project_id, sales_description, short_intro, catch_copy,
          tags_json, thumbnail_text, sns_post, notice, created_at
        ) values (@id, @packageId, @projectId, @salesDescription, @shortIntro, @catchCopy,
          @tagsJson, @thumbnailText, @snsPost, @notice, @createdAt)`
      ).run({
        id: crypto.randomUUID(),
        packageId: record.id,
        projectId: record.project_id,
        salesDescription: generated.sales_description,
        shortIntro: generated.short_intro,
        catchCopy: generated.catch_copy,
        tagsJson: JSON.stringify(generated.tags),
        thumbnailText: generated.thumbnail_text,
        snsPost: generated.sns_post,
        notice: generated.notice,
        createdAt: now
      });
    }
    await saveDb(db);
  } catch (error) {
    db.close();
    throw error;
  }

  return record;
}

async function writeText(filePath: string, text: string) {
  await fs.writeFile(filePath, text, "utf8");
}

async function copyIfExists(source: string, dest: string, fallbackText: string) {
  if (source) {
    try {
      await fs.copyFile(source, dest);
      return;
    } catch {
      // Fall through and write a readable placeholder.
    }
  }
  await writeText(`${dest}.未登録.txt`, fallbackText);
}

async function writeBodyPdf(projectId: string, file: FormDataEntryValue | null, outputDir: string) {
  if (file instanceof File && file.size > 0) {
    await fs.writeFile(path.join(outputDir, "本編PDF.pdf"), Buffer.from(await file.arrayBuffer()));
    return;
  }

  const candidate = path.join(getProjectDir(projectId), "main.pdf");
  try {
    await fs.copyFile(candidate, path.join(outputDir, "本編PDF.pdf"));
  } catch {
    await writeText(path.join(outputDir, "本編PDF_未登録.txt"), "本編PDFはまだ登録されていません。");
  }
}

async function writeImagesZip(fileList: FormDataEntryValue[], outputDir: string) {
  const zip = new JSZip();
  let count = 0;

  for (const item of fileList) {
    if (!(item instanceof File) || item.size === 0) continue;
    zip.file(item.name.replace(/[^a-zA-Z0-9._-]/g, "-"), Buffer.from(await item.arrayBuffer()));
    count += 1;
  }

  if (count === 0) {
    zip.file("README.txt", "本編画像はまだ登録されていません。");
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(path.join(outputDir, "本編画像ZIP.zip"), content);
}

export async function exportSalesPackage(formData: FormData) {
  const record = await saveSalesPackageFromForm(formData);
  const outputDir = getSalesPackageDir(record.project_id);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  await writeBodyPdf(record.project_id, formData.get("mainPdf"), outputDir);
  await writeImagesZip(formData.getAll("bodyImages"), outputDir);
  await copyIfExists(record.cover_image_path, path.join(outputDir, "表紙画像" + path.extname(record.cover_image_path || ".png")), "表紙画像はまだ登録されていません。");
  await copyIfExists(record.thumbnail_image_path, path.join(outputDir, "サムネイル画像" + path.extname(record.thumbnail_image_path || ".png")), "サムネイル画像はまだ登録されていません。");
  await writeText(path.join(outputDir, "販売用説明文.txt"), record.sales_description);
  await writeText(path.join(outputDir, "タグ一覧.txt"), record.tags.join("\n"));
  await writeText(path.join(outputDir, "SNS告知文.txt"), record.sns_post);
  await writeText(
    path.join(outputDir, "作品情報.json"),
    JSON.stringify(
      {
        projectId: record.project_id,
        title: record.title,
        subtitle: record.subtitle,
        genre: record.genre,
        tags: record.tags,
        shortIntro: record.short_intro,
        catchCopy: record.catch_copy,
        thumbnailText: record.thumbnail_text,
        notice: record.notice,
        ageRating: record.age_rating,
        priceNote: record.price_note,
        salesSites: record.sales_sites,
        coverImagePath: record.cover_image_path,
        thumbnailImagePath: record.thumbnail_image_path,
        exportedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  const db = await openDb();
  try {
    db.prepare(
      "insert into export_history (id, package_id, project_id, export_path, created_at) values (@id, @packageId, @projectId, @exportPath, @createdAt)"
    ).run({
      id: crypto.randomUUID(),
      packageId: record.id,
      projectId: record.project_id,
      exportPath: outputDir,
      createdAt: new Date().toISOString()
    });
    await saveDb(db);
  } catch (error) {
    db.close();
    throw error;
  }

  return { record, outputDir };
}
