import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import {
  createImagesZip,
  createPagesPdf,
  createProjectManifest,
  createSalesTextDraft,
  type ExportImage,
} from "@mangai/export-core";
import type { ProjectBundle, Project } from "@mangai/project-core";
import type { ProjectInput } from "@mangai/shared";

type Paths = {
  root: string;
  database: string;
  projects: string;
  assets: string;
  exports: string;
  logs: string;
};
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const mime = (file: string) =>
  ({
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  })[path.extname(file).toLowerCase()] || "";

export class MangaiDatabase {
  private db: Database.Database;
  constructor(public paths: Paths) {
    Object.values(paths)
      .filter((x) => x !== paths.database)
      .forEach((x) => fs.mkdirSync(x, { recursive: true }));
    this.db = new Database(paths.database);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }
  close() {
    this.db.close();
  }
  private migrate() {
    this.db.exec(`
 create table if not exists projects(id text primary key,title text not null,subtitle text not null default '',description text not null default '',genre text not null default '',age_rating text not null,reading_direction text not null,width integer not null,height integer not null,dpi integer not null,storage_path text not null,cover_asset_id text,created_at text not null,updated_at text not null,last_opened_at text);
 create table if not exists episodes(id text primary key,project_id text not null references projects(id) on delete cascade,title text not null,order_index integer not null,created_at text not null,updated_at text not null);
 create table if not exists assets(id text primary key,project_id text not null references projects(id) on delete cascade,file_name text not null,relative_path text not null,mime_type text not null,width integer not null,height integer not null,byte_size integer not null,sha256 text not null,created_at text not null,unique(project_id,sha256));
 create table if not exists pages(id text primary key,episode_id text not null references episodes(id) on delete cascade,page_number integer not null,order_index integer not null,width integer not null,height integer not null,background_color text not null default '#ffffff',image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',notes text not null default '',created_at text not null,updated_at text not null);
 create table if not exists panels(id text primary key,page_id text not null references pages(id) on delete cascade,order_index integer not null,x real not null,y real not null,width real not null,height real not null,image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',generation_status text not null default 'idle',metadata text not null default '{}');
 create table if not exists export_history(id text primary key,project_id text not null references projects(id) on delete cascade,export_path text not null,files_json text not null,warnings_json text not null,created_at text not null);
 create index if not exists idx_episodes_project on episodes(project_id,order_index);create index if not exists idx_pages_episode on pages(episode_id,order_index);create index if not exists idx_assets_project on assets(project_id,created_at);`);
  }
  private project(row: any): Project {
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      genre: row.genre,
      ageRating: row.age_rating,
      readingDirection: row.reading_direction,
      width: row.width,
      height: row.height,
      dpi: row.dpi,
      storagePath: row.storage_path,
      coverAssetId: row.cover_asset_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastOpenedAt: row.last_opened_at,
    };
  }
  listProjects() {
    return this.db
      .prepare(
        "select * from projects order by coalesce(last_opened_at,updated_at) desc",
      )
      .all()
      .map((x) => this.project(x));
  }
  createProject(input: ProjectInput) {
    const id = uid(),
      stamp = now(),
      storage = input.storagePath
        ? path.resolve(input.storagePath)
        : path.join(this.paths.projects, id);
    fs.mkdirSync(path.join(storage, "assets"), { recursive: true });
    this.db.transaction(() => {
      this.db
        .prepare("insert into projects values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(
          id,
          input.title,
          input.subtitle,
          input.description,
          input.genre,
          input.ageRating,
          input.readingDirection,
          input.width,
          input.height,
          input.dpi,
          storage,
          null,
          stamp,
          stamp,
          stamp,
        );
      this.db
        .prepare("insert into episodes values(?,?,?,?,?,?)")
        .run(uid(), id, "第1話", 0, stamp, stamp);
    })();
    return this.openProject(id);
  }
  openProject(id: string) {
    this.db
      .prepare("update projects set last_opened_at=? where id=?")
      .run(now(), id);
    return this.bundle(id);
  }
  renameProject(id: string, title: string) {
    this.db
      .prepare("update projects set title=?,updated_at=? where id=?")
      .run(title, now(), id);
    return this.bundle(id);
  }
  duplicateProject(id: string) {
    const source = this.bundle(id);
    const copy = this.createProject({
      ...source.project,
      title: `${source.project.title} のコピー`,
      storagePath: undefined,
    });
    const episodeMap = new Map<string, string>();
    this.db.transaction(() => {
      this.db
        .prepare("delete from episodes where project_id=?")
        .run(copy.project.id);
      for (const e of source.episodes) {
        const eid = uid();
        episodeMap.set(e.id, eid);
        this.db
          .prepare("insert into episodes values(?,?,?,?,?,?)")
          .run(eid, copy.project.id, e.title, e.orderIndex, now(), now());
      }
      for (const p of source.pages)
        this.db
          .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .run(
            uid(),
            episodeMap.get(p.episodeId),
            p.pageNumber,
            p.orderIndex,
            p.width,
            p.height,
            p.backgroundColor,
            null,
            p.prompt,
            p.negativePrompt,
            p.notes,
            now(),
            now(),
          );
    })();
    return this.bundle(copy.project.id);
  }
  deleteProject(id: string) {
    const row = this.db
      .prepare("select storage_path from projects where id=?")
      .get(id) as any;
    if (row) {
      const trash = path.join(this.paths.root, ".trash");
      fs.mkdirSync(trash, { recursive: true });
      if (fs.existsSync(row.storage_path))
        fs.renameSync(
          row.storage_path,
          path.join(trash, `${id}-${Date.now()}`),
        );
      this.db.prepare("delete from projects where id=?").run(id);
    }
  }
  createEpisode(projectId: string, title: string) {
    const i = (
      this.db
        .prepare(
          "select coalesce(max(order_index),-1)+1 n from episodes where project_id=?",
        )
        .get(projectId) as any
    ).n;
    this.db
      .prepare("insert into episodes values(?,?,?,?,?,?)")
      .run(uid(), projectId, title, i, now(), now());
    return this.bundle(projectId);
  }
  private projectIdForEpisode(episodeId: string) {
    const r = this.db
      .prepare("select project_id from episodes where id=?")
      .get(episodeId) as any;
    if (!r) throw new Error("エピソードが見つかりません。");
    return r.project_id as string;
  }
  addPage(episodeId: string, imageAssetId?: string) {
    const projectId = this.projectIdForEpisode(episodeId),
      project = this.bundle(projectId).project;
    const i = (
      this.db
        .prepare(
          "select coalesce(max(order_index),-1)+1 n from pages where episode_id=?",
        )
        .get(episodeId) as any
    ).n;
    this.db
      .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        uid(),
        episodeId,
        i + 1,
        i,
        project.width,
        project.height,
        "#ffffff",
        imageAssetId || null,
        "",
        "",
        "",
        now(),
        now(),
      );
    return this.bundle(projectId);
  }
  duplicatePage(id: string) {
    const p = this.db.prepare("select * from pages where id=?").get(id) as any;
    if (!p) throw new Error("ページが見つかりません。");
    this.db
      .prepare(
        "update pages set order_index=order_index+1 where episode_id=? and order_index>?",
      )
      .run(p.episode_id, p.order_index);
    this.db
      .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        uid(),
        p.episode_id,
        p.page_number + 1,
        p.order_index + 1,
        p.width,
        p.height,
        p.background_color,
        p.image_asset_id,
        p.prompt,
        p.negative_prompt,
        p.notes,
        now(),
        now(),
      );
    this.normalizePages(p.episode_id);
    return this.bundle(this.projectIdForEpisode(p.episode_id));
  }
  deletePage(id: string) {
    const p = this.db
      .prepare("select episode_id from pages where id=?")
      .get(id) as any;
    if (!p) throw new Error("ページが見つかりません。");
    this.db.prepare("delete from pages where id=?").run(id);
    this.normalizePages(p.episode_id);
    return this.bundle(this.projectIdForEpisode(p.episode_id));
  }
  reorderPages(episodeId: string, ids: string[]) {
    this.db.transaction(() =>
      ids.forEach((id, i) =>
        this.db
          .prepare(
            "update pages set order_index=?,page_number=?,updated_at=? where id=? and episode_id=?",
          )
          .run(i, i + 1, now(), id, episodeId),
      ),
    )();
    return this.bundle(this.projectIdForEpisode(episodeId));
  }
  private normalizePages(eid: string) {
    const ids = (
      this.db
        .prepare("select id from pages where episode_id=? order by order_index")
        .all(eid) as any[]
    ).map((x) => x.id);
    this.db.transaction(() =>
      ids.forEach((id, i) =>
        this.db
          .prepare("update pages set order_index=?,page_number=? where id=?")
          .run(i, i + 1, id),
      ),
    )();
  }
  savePage(id: string, prompt: string, negativePrompt: string, notes: string) {
    const p = this.db
      .prepare("select episode_id from pages where id=?")
      .get(id) as any;
    this.db
      .prepare(
        "update pages set prompt=?,negative_prompt=?,notes=?,updated_at=? where id=?",
      )
      .run(prompt, negativePrompt, notes, now(), id);
    return this.bundle(this.projectIdForEpisode(p.episode_id));
  }
  importAssets(projectId: string, files: string[]) {
    const project = this.bundle(projectId).project;
    const dir = path.join(project.storagePath, "assets");
    fs.mkdirSync(dir, { recursive: true });
    for (const source of files) {
      const mt = mime(source);
      if (!mt) continue;
      const bytes = fs.readFileSync(source),
        hash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (
        this.db
          .prepare("select 1 from assets where project_id=? and sha256=?")
          .get(projectId, hash)
      )
        continue;
      const ext = path.extname(source).toLowerCase(),
        name = `${uid()}${ext}`,
        dest = path.join(dir, name),
        size = imageSize(bytes),
        assetId = uid();
      fs.copyFileSync(source, dest);
      this.db
        .prepare("insert into assets values(?,?,?,?,?,?,?,?,?,?)")
        .run(
          assetId,
          projectId,
          path.basename(source),
          path.relative(project.storagePath, dest),
          mt,
          size.width || 0,
          size.height || 0,
          bytes.length,
          hash,
          now(),
        );
      this.db
        .prepare(
          "update projects set cover_asset_id=coalesce(cover_asset_id,?),updated_at=? where id=?",
        )
        .run(assetId, now(), projectId);
    }
    return this.bundle(projectId);
  }
  deleteAsset(id: string) {
    const a = this.db
      .prepare(
        "select a.*,p.storage_path from assets a join projects p on p.id=a.project_id where a.id=?",
      )
      .get(id) as any;
    if (!a) throw new Error("素材が見つかりません。");
    const source = this.safeProjectPath(a.storage_path, a.relative_path),
      trash = path.join(a.storage_path, ".trash");
    fs.mkdirSync(trash, { recursive: true });
    if (fs.existsSync(source))
      fs.renameSync(
        source,
        path.join(trash, `${Date.now()}-${path.basename(source)}`),
      );
    this.db.prepare("delete from assets where id=?").run(id);
    return this.bundle(a.project_id);
  }
  assetData(relativePath: string) {
    const rows = this.db
      .prepare(
        "select a.relative_path,a.mime_type,p.storage_path from assets a join projects p on p.id=a.project_id where a.relative_path=?",
      )
      .all(relativePath) as any[];
    if (!rows[0]) throw new Error("素材が見つかりません。");
    const file = this.safeProjectPath(rows[0].storage_path, relativePath);
    return `data:${rows[0].mime_type};base64,${fs.readFileSync(file).toString("base64")}`;
  }
  projectCover(id: string) {
    const row = this.db
      .prepare(
        "select a.relative_path from projects p left join assets a on a.id=coalesce(p.cover_asset_id,(select id from assets where project_id=p.id order by created_at limit 1)) where p.id=?",
      )
      .get(id) as any;
    return row?.relative_path ? this.assetData(row.relative_path) : null;
  }
  async exportProject(id: string) {
    const bundle = this.bundle(id);
    const episodeOrder = new Map(
      bundle.episodes.map((episode) => [episode.id, episode.orderIndex]),
    );
    const assetById = new Map(bundle.assets.map((asset) => [asset.id, asset]));
    const orderedPages = [...bundle.pages].sort(
      (a, b) =>
        (episodeOrder.get(a.episodeId) ?? 0) -
          (episodeOrder.get(b.episodeId) ?? 0) || a.orderIndex - b.orderIndex,
    );
    const images: ExportImage[] = [];
    for (const page of orderedPages) {
      if (!page.imageAssetId) continue;
      const asset = assetById.get(page.imageAssetId);
      if (!asset) continue;
      const file = this.safeProjectPath(
        bundle.project.storagePath,
        asset.relativePath,
      );
      images.push({
        fileName: asset.fileName,
        bytes: fs.readFileSync(file),
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTitle =
      Array.from(bundle.project.title)
        .map((character) =>
          character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
            ? "-"
            : character,
        )
        .join("")
        .slice(0, 80) || "project";
    const outputDir = path.join(this.paths.exports, `${safeTitle}-${stamp}`);
    fs.mkdirSync(outputDir, { recursive: true });
    const text = createSalesTextDraft({
      title: bundle.project.title,
      subtitle: bundle.project.subtitle,
      genre: bundle.project.genre,
      ageRating: bundle.project.ageRating,
    });
    const files = [
      "本編PDF.pdf",
      "本編画像ZIP.zip",
      "作品情報.json",
      "販売用説明文.txt",
      "SNS告知文.txt",
    ];
    fs.writeFileSync(
      path.join(outputDir, files[0]),
      await createPagesPdf(images, {
        width: bundle.project.width,
        height: bundle.project.height,
      }),
    );
    fs.writeFileSync(path.join(outputDir, files[1]), await createImagesZip(images));
    fs.writeFileSync(
      path.join(outputDir, files[2]),
      createProjectManifest({ ...bundle, exportedAt: now() }),
    );
    fs.writeFileSync(path.join(outputDir, files[3]), text.description, "utf8");
    fs.writeFileSync(path.join(outputDir, files[4]), text.snsPost, "utf8");
    const warnings = [
      ...(images.length === 0 ? ["画像がないため空のPDFを作成しました。"] : []),
      ...(images.some((image) => image.mimeType === "image/webp")
        ? ["WebPはZIPに含まれますがPDFページには含まれません。"]
        : []),
    ];
    this.db
      .prepare(
        "insert into export_history values(?,?,?,?,?,?)",
      )
      .run(uid(), id, outputDir, JSON.stringify(files), JSON.stringify(warnings), now());
    return { outputDir, files, warnings };
  }
  private safeProjectPath(root: string, relative: string) {
    const full = path.resolve(root, relative),
      base = path.resolve(root) + path.sep;
    if (!full.startsWith(base))
      throw new Error("プロジェクト外のファイルにはアクセスできません。");
    return full;
  }
  bundle(projectId: string): ProjectBundle {
    const p = this.db
      .prepare("select * from projects where id=?")
      .get(projectId) as any;
    if (!p) throw new Error("プロジェクトが見つかりません。");
    const episodes = (
      this.db
        .prepare(
          "select * from episodes where project_id=? order by order_index",
        )
        .all(projectId) as any[]
    ).map((e) => ({
      id: e.id,
      projectId: e.project_id,
      title: e.title,
      orderIndex: e.order_index,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));
    const pages = (
      this.db
        .prepare(
          "select p.* from pages p join episodes e on e.id=p.episode_id where e.project_id=? order by p.order_index",
        )
        .all(projectId) as any[]
    ).map((p) => ({
      id: p.id,
      episodeId: p.episode_id,
      pageNumber: p.page_number,
      orderIndex: p.order_index,
      width: p.width,
      height: p.height,
      backgroundColor: p.background_color,
      imageAssetId: p.image_asset_id,
      prompt: p.prompt,
      negativePrompt: p.negative_prompt,
      notes: p.notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
    const panels = (
      this.db
        .prepare(
          "select pn.* from panels pn join pages p on p.id=pn.page_id join episodes e on e.id=p.episode_id where e.project_id=?",
        )
        .all(projectId) as any[]
    ).map((p) => ({
      id: p.id,
      pageId: p.page_id,
      orderIndex: p.order_index,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      imageAssetId: p.image_asset_id,
      prompt: p.prompt,
      negativePrompt: p.negative_prompt,
      generationStatus: p.generation_status,
      metadata: p.metadata,
    }));
    const assets = (
      this.db
        .prepare(
          "select * from assets where project_id=? order by created_at desc",
        )
        .all(projectId) as any[]
    ).map((a) => ({
      id: a.id,
      projectId: a.project_id,
      fileName: a.file_name,
      relativePath: a.relative_path,
      mimeType: a.mime_type,
      width: a.width,
      height: a.height,
      byteSize: a.byte_size,
      sha256: a.sha256,
      createdAt: a.created_at,
    }));
    return { project: this.project(p), episodes, pages, panels, assets };
  }
}
