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
import {
  defaultPromptTemplates,
  type GenerationStatus,
  type ProviderSettings,
} from "@mangai/ai-core";
import type { Balloon, Panel, TextObject } from "@mangai/canvas-core";
import { renderPagePng, type RenderAsset } from "./page-renderer.js";

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
    const databaseExisted = fs.existsSync(paths.database);
    Object.values(paths)
      .filter((x) => x !== paths.database)
      .forEach((x) => fs.mkdirSync(x, { recursive: true }));
    this.db = new Database(paths.database);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    if (databaseExisted && !this.hasMigration("canvas-v1"))
      this.backupBeforeMigration("canvas-v1");
    this.migrate();
  }
  close() {
    this.db.close();
  }
  private hasMigration(version: string) {
    const exists = this.db
      .prepare(
        "select 1 from sqlite_master where type='table' and name='schema_migrations'",
      )
      .get();
    if (!exists) return false;
    return Boolean(
      this.db
        .prepare("select 1 from schema_migrations where version=?")
        .get(version),
    );
  }
  private backupBeforeMigration(name: string) {
    const directory = path.join(this.paths.root, "backups");
    fs.mkdirSync(directory, { recursive: true });
    this.db.pragma("wal_checkpoint(RESTART)");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(
      directory,
      `mangai_local-before-${name}-${stamp}.sqlite`,
    );
    fs.copyFileSync(
      this.paths.database,
      destination,
      fs.constants.COPYFILE_EXCL,
    );
  }
  private migrate() {
    this.db.exec(`
 create table if not exists projects(id text primary key,title text not null,subtitle text not null default '',description text not null default '',genre text not null default '',age_rating text not null,reading_direction text not null,width integer not null,height integer not null,dpi integer not null,storage_path text not null,cover_asset_id text,created_at text not null,updated_at text not null,last_opened_at text);
 create table if not exists episodes(id text primary key,project_id text not null references projects(id) on delete cascade,title text not null,order_index integer not null,created_at text not null,updated_at text not null);
 create table if not exists assets(id text primary key,project_id text not null references projects(id) on delete cascade,file_name text not null,relative_path text not null,mime_type text not null,width integer not null,height integer not null,byte_size integer not null,sha256 text not null,created_at text not null,unique(project_id,sha256));
 create table if not exists pages(id text primary key,episode_id text not null references episodes(id) on delete cascade,page_number integer not null,order_index integer not null,width integer not null,height integer not null,background_color text not null default '#ffffff',image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',notes text not null default '',created_at text not null,updated_at text not null);
 create table if not exists panels(id text primary key,page_id text not null references pages(id) on delete cascade,order_index integer not null,x real not null,y real not null,width real not null,height real not null,image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',generation_status text not null default 'idle',metadata text not null default '{}');
 create table if not exists export_history(id text primary key,project_id text not null references projects(id) on delete cascade,export_path text not null,files_json text not null,warnings_json text not null,created_at text not null);
 create table if not exists ai_provider_settings(provider_id text primary key,enabled integer not null,config_json text not null,updated_at text not null);
 create table if not exists ai_models(id text primary key,provider_id text not null,model_id text not null,name text not null,metadata_json text not null default '{}',updated_at text not null,unique(provider_id,model_id));
 create table if not exists chat_sessions(id text primary key,project_id text references projects(id) on delete set null,title text not null,created_at text not null,updated_at text not null);
 create table if not exists chat_messages(id text primary key,session_id text not null references chat_sessions(id) on delete cascade,role text not null check(role in ('user','assistant','system')),content text not null,provider_id text,model_id text,created_at text not null);
 create table if not exists prompt_templates(id text primary key,name text not null,template text not null,system_prompt text not null default '',is_builtin integer not null default 0,created_at text not null,updated_at text not null);
 create table if not exists generation_jobs(id text primary key,project_id text references projects(id) on delete set null,episode_id text references episodes(id) on delete set null,page_id text references pages(id) on delete set null,provider_type text not null,provider_id text not null,model_id text,generation_type text not null,status text not null,prompt text not null,negative_prompt text not null default '',input_json text not null default '{}',output_json text not null default '{}',provider_job_id text,error_code text,error_message text,created_at text not null,started_at text,completed_at text);
 create table if not exists generation_outputs(id text primary key,job_id text not null references generation_jobs(id) on delete cascade,asset_id text references assets(id) on delete set null,relative_path text,metadata_json text not null default '{}',created_at text not null);
 create table if not exists comfy_workflows(id text primary key,name text not null,file_path text not null,mapping_json text not null,is_default integer not null default 0,created_at text not null,updated_at text not null);
 create table if not exists operation_history(id integer primary key autoincrement,project_id text not null references projects(id) on delete cascade,label text not null,before_json text not null,after_json text not null,is_undone integer not null default 0,created_at text not null);
 create table if not exists schema_migrations(version text primary key,name text not null,applied_at text not null);
 create index if not exists idx_episodes_project on episodes(project_id,order_index);create index if not exists idx_pages_episode on pages(episode_id,order_index);create index if not exists idx_assets_project on assets(project_id,created_at);`);
    const assetColumns = this.db
      .prepare("pragma table_info(assets)")
      .all() as Array<{ name: string }>;
    if (!assetColumns.some((column) => column.name === "generation_job_id"))
      this.db.exec("alter table assets add column generation_job_id text");
    if (!assetColumns.some((column) => column.name === "metadata_json"))
      this.db.exec(
        "alter table assets add column metadata_json text not null default '{}'",
      );
    const jobColumns = this.db
      .prepare("pragma table_info(generation_jobs)")
      .all() as Array<{ name: string }>;
    if (!jobColumns.some((column) => column.name === "progress"))
      this.db.exec(
        "alter table generation_jobs add column progress real not null default 0",
      );
    this.migrateCanvasV1();
    const insertTemplate = this.db.prepare(
      "insert into prompt_templates values(?,?,?,?,?,?,?)",
    );
    const hasTemplate = this.db.prepare(
      "select 1 from prompt_templates where name=?",
    );
    for (const [name, template] of defaultPromptTemplates) {
      if (!hasTemplate.get(name))
        insertTemplate.run(uid(), name, template, "", 1, now(), now());
    }
    this.db
      .prepare(
        "update generation_jobs set status='failed',error_code='INTERRUPTED',error_message='アプリ終了により生成が中断されました。',completed_at=? where status='running'",
      )
      .run(now());
  }
  private migrateCanvasV1() {
    if (this.hasMigration("canvas-v1")) return;
    const columns = new Set(
      (
        this.db.prepare("pragma table_info(panels)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    const additions = [
      ["name", "text not null default 'コマ'"],
      ["rotation", "real not null default 0"],
      ["z_index", "integer not null default 0"],
      ["visible", "integer not null default 1"],
      ["locked", "integer not null default 0"],
      ["border_color", "text not null default '#000000'"],
      ["border_width", "real not null default 4"],
      ["fill_color", "text not null default '#ffffff'"],
      ["image_fit", "text not null default 'cover'"],
      ["image_offset_x", "real not null default 0"],
      ["image_offset_y", "real not null default 0"],
      ["image_scale", "real not null default 1"],
      ["image_rotation", "real not null default 0"],
      ["image_opacity", "real not null default 1"],
      ["created_at", "text not null default ''"],
      ["updated_at", "text not null default ''"],
    ] as const;
    const stamp = now();
    this.db.transaction(() => {
      for (const [column, definition] of additions)
        if (!columns.has(column))
          this.db.exec(`alter table panels add column ${column} ${definition}`);
      this.db.exec(`
        create table balloons(id text primary key,page_id text not null references pages(id) on delete cascade,name text not null,type text not null,x real not null,y real not null,width real not null,height real not null,rotation real not null default 0,z_index integer not null,visible integer not null default 1,locked integer not null default 0,fill_color text not null default '#ffffff',stroke_color text not null default '#000000',stroke_width real not null default 4,opacity real not null default 1,tail_direction text not null default 'none',tail_offset real not null default 0.5,created_at text not null,updated_at text not null);
        create table text_objects(id text primary key,page_id text not null references pages(id) on delete cascade,parent_balloon_id text references balloons(id) on delete cascade,name text not null,text text not null default '',writing_mode text not null default 'horizontal',x real not null,y real not null,width real not null,height real not null,rotation real not null default 0,z_index integer not null,visible integer not null default 1,locked integer not null default 0,font_family text not null default 'sans-serif',font_size real not null default 48,font_weight integer not null default 400,color text not null default '#000000',text_align text not null default 'center',vertical_align text not null default 'middle',line_height real not null default 1.2,letter_spacing real not null default 0,padding real not null default 16,opacity real not null default 1,created_at text not null,updated_at text not null);
        create index idx_panels_page_z on panels(page_id,z_index);
        create index idx_balloons_page_z on balloons(page_id,z_index);
        create index idx_text_objects_page_z on text_objects(page_id,z_index);
      `);
      this.db
        .prepare(
          "update panels set z_index=order_index,created_at=case when created_at='' then ? else created_at end,updated_at=case when updated_at='' then ? else updated_at end",
        )
        .run(stamp, stamp);
      this.db
        .prepare(
          "insert into schema_migrations(version,name,applied_at) values(?,?,?)",
        )
        .run("canvas-v1", "Manga canvas panels, balloons and text", stamp);
    })();
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
    if (
      this.db
        .prepare("select 1 from projects where lower(storage_path)=lower(?)")
        .get(storage)
    )
      throw new Error("この保存先は別のProjectで使用されています。");
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
  private editableSnapshot(projectId: string) {
    const bundle = this.bundle(projectId);
    return {
      project: {
        title: bundle.project.title,
        coverAssetId: bundle.project.coverAssetId,
      },
      episodes: bundle.episodes,
      pages: bundle.pages,
      panels: bundle.panels,
      balloons: bundle.balloons,
      textObjects: bundle.textObjects,
    };
  }
  captureHistory<T>(projectId: string, label: string, mutation: () => T) {
    const before = this.editableSnapshot(projectId);
    const result = mutation();
    const after = this.editableSnapshot(projectId);
    if (JSON.stringify(before) === JSON.stringify(after)) return result;
    this.db.transaction(() => {
      this.db
        .prepare(
          "delete from operation_history where project_id=? and is_undone=1",
        )
        .run(projectId);
      this.db
        .prepare(
          "insert into operation_history(project_id,label,before_json,after_json,created_at) values(?,?,?,?,?)",
        )
        .run(
          projectId,
          label,
          JSON.stringify(before),
          JSON.stringify(after),
          now(),
        );
    })();
    return result;
  }
  private restoreEditableSnapshot(projectId: string, snapshot: any) {
    this.db.transaction(() => {
      this.db
        .prepare(
          "update projects set title=?,cover_asset_id=?,updated_at=? where id=?",
        )
        .run(
          snapshot.project.title,
          snapshot.project.coverAssetId,
          now(),
          projectId,
        );
      const episodeIds = new Set(snapshot.episodes.map((item: any) => item.id));
      const pageIds = new Set(snapshot.pages.map((item: any) => item.id));
      const panelIds = new Set(snapshot.panels.map((item: any) => item.id));
      const balloonIds = new Set(
        (snapshot.balloons ?? []).map((item: any) => item.id),
      );
      const textObjectIds = new Set(
        (snapshot.textObjects ?? []).map((item: any) => item.id),
      );
      for (const item of snapshot.episodes)
        this.db
          .prepare(
            "insert into episodes values(?,?,?,?,?,?) on conflict(id) do update set title=excluded.title,order_index=excluded.order_index,updated_at=excluded.updated_at",
          )
          .run(
            item.id,
            projectId,
            item.title,
            item.orderIndex,
            item.createdAt,
            now(),
          );
      for (const item of snapshot.pages)
        this.db
          .prepare(
            "insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set episode_id=excluded.episode_id,page_number=excluded.page_number,order_index=excluded.order_index,width=excluded.width,height=excluded.height,background_color=excluded.background_color,image_asset_id=excluded.image_asset_id,prompt=excluded.prompt,negative_prompt=excluded.negative_prompt,notes=excluded.notes,updated_at=excluded.updated_at",
          )
          .run(
            item.id,
            item.episodeId,
            item.pageNumber,
            item.orderIndex,
            item.width,
            item.height,
            item.backgroundColor,
            item.imageAssetId,
            item.prompt,
            item.negativePrompt,
            item.notes,
            item.createdAt,
            now(),
          );
      for (const item of snapshot.panels)
        this.db
          .prepare(
            `insert into panels(id,page_id,order_index,x,y,width,height,image_asset_id,prompt,negative_prompt,generation_status,metadata,name,rotation,z_index,visible,locked,border_color,border_width,fill_color,image_fit,image_offset_x,image_offset_y,image_scale,image_rotation,image_opacity,created_at,updated_at)
             values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,order_index=excluded.order_index,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,image_asset_id=excluded.image_asset_id,prompt=excluded.prompt,negative_prompt=excluded.negative_prompt,generation_status=excluded.generation_status,metadata=excluded.metadata,name=excluded.name,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,border_color=excluded.border_color,border_width=excluded.border_width,fill_color=excluded.fill_color,image_fit=excluded.image_fit,image_offset_x=excluded.image_offset_x,image_offset_y=excluded.image_offset_y,image_scale=excluded.image_scale,image_rotation=excluded.image_rotation,image_opacity=excluded.image_opacity,updated_at=excluded.updated_at`,
          )
          .run(
            item.id,
            item.pageId,
            item.orderIndex,
            item.x,
            item.y,
            item.width,
            item.height,
            item.imageAssetId,
            item.prompt,
            item.negativePrompt,
            item.generationStatus,
            item.metadata,
            item.name ?? "コマ",
            item.rotation ?? 0,
            item.zIndex ?? item.orderIndex,
            item.visible === false ? 0 : 1,
            item.locked ? 1 : 0,
            item.borderColor ?? "#000000",
            item.borderWidth ?? 4,
            item.fillColor ?? "#ffffff",
            item.imageFit ?? "cover",
            item.imageOffsetX ?? 0,
            item.imageOffsetY ?? 0,
            item.imageScale ?? 1,
            item.imageRotation ?? 0,
            item.imageOpacity ?? 1,
            item.createdAt ?? now(),
            now(),
          );
      for (const item of snapshot.balloons ?? []) this.upsertBalloonRow(item);
      for (const item of snapshot.textObjects ?? [])
        this.upsertTextObjectRow(item);
      const existingTextObjects = this.db
        .prepare(
          "select t.id from text_objects t join pages p on p.id=t.page_id join episodes e on e.id=p.episode_id where e.project_id=?",
        )
        .all(projectId) as any[];
      for (const row of existingTextObjects)
        if (!textObjectIds.has(row.id))
          this.db.prepare("delete from text_objects where id=?").run(row.id);
      const existingBalloons = this.db
        .prepare(
          "select b.id from balloons b join pages p on p.id=b.page_id join episodes e on e.id=p.episode_id where e.project_id=?",
        )
        .all(projectId) as any[];
      for (const row of existingBalloons)
        if (!balloonIds.has(row.id))
          this.db.prepare("delete from balloons where id=?").run(row.id);
      const existingPanels = this.db
        .prepare(
          "select panels.id from panels join pages on pages.id=panels.page_id join episodes on episodes.id=pages.episode_id where episodes.project_id=?",
        )
        .all(projectId) as any[];
      for (const row of existingPanels)
        if (!panelIds.has(row.id))
          this.db.prepare("delete from panels where id=?").run(row.id);
      const existingPages = this.db
        .prepare(
          "select pages.id from pages join episodes on episodes.id=pages.episode_id where episodes.project_id=?",
        )
        .all(projectId) as any[];
      for (const row of existingPages)
        if (!pageIds.has(row.id))
          this.db.prepare("delete from pages where id=?").run(row.id);
      const existingEpisodes = this.db
        .prepare("select id from episodes where project_id=?")
        .all(projectId) as any[];
      for (const row of existingEpisodes)
        if (!episodeIds.has(row.id))
          this.db.prepare("delete from episodes where id=?").run(row.id);
    })();
  }
  listOperationHistory(projectId: string) {
    const items = this.db
      .prepare(
        "select id,label,is_undone as isUndone,created_at as createdAt from operation_history where project_id=? order by id desc limit 50",
      )
      .all(projectId);
    return {
      items,
      canUndo: Boolean(
        this.db
          .prepare(
            "select 1 from operation_history where project_id=? and is_undone=0 limit 1",
          )
          .get(projectId),
      ),
      canRedo: Boolean(
        this.db
          .prepare(
            "select 1 from operation_history where project_id=? and is_undone=1 limit 1",
          )
          .get(projectId),
      ),
    };
  }
  undo(projectId: string) {
    const row = this.db
      .prepare(
        "select id,before_json as snapshot from operation_history where project_id=? and is_undone=0 order by id desc limit 1",
      )
      .get(projectId) as any;
    if (!row) return this.bundle(projectId);
    this.restoreEditableSnapshot(projectId, JSON.parse(row.snapshot));
    this.db
      .prepare("update operation_history set is_undone=1 where id=?")
      .run(row.id);
    return this.bundle(projectId);
  }
  redo(projectId: string) {
    const row = this.db
      .prepare(
        "select id,after_json as snapshot from operation_history where project_id=? and is_undone=1 order by id asc limit 1",
      )
      .get(projectId) as any;
    if (!row) return this.bundle(projectId);
    this.restoreEditableSnapshot(projectId, JSON.parse(row.snapshot));
    this.db
      .prepare("update operation_history set is_undone=0 where id=?")
      .run(row.id);
    return this.bundle(projectId);
  }
  private upsertPanelRow(item: Panel) {
    const stamp = now();
    this.db
      .prepare(
        `insert into panels(id,page_id,order_index,x,y,width,height,image_asset_id,prompt,negative_prompt,generation_status,metadata,name,rotation,z_index,visible,locked,border_color,border_width,fill_color,image_fit,image_offset_x,image_offset_y,image_scale,image_rotation,image_opacity,created_at,updated_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,order_index=excluded.order_index,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,image_asset_id=excluded.image_asset_id,name=excluded.name,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,border_color=excluded.border_color,border_width=excluded.border_width,fill_color=excluded.fill_color,image_fit=excluded.image_fit,image_offset_x=excluded.image_offset_x,image_offset_y=excluded.image_offset_y,image_scale=excluded.image_scale,image_rotation=excluded.image_rotation,image_opacity=excluded.image_opacity,updated_at=excluded.updated_at`,
      )
      .run(
        item.id,
        item.pageId,
        item.zIndex,
        item.x,
        item.y,
        item.width,
        item.height,
        item.imageAssetId,
        "",
        "",
        "idle",
        "{}",
        item.name,
        item.rotation,
        item.zIndex,
        item.visible ? 1 : 0,
        item.locked ? 1 : 0,
        item.borderColor,
        item.borderWidth,
        item.fillColor,
        item.imageFit,
        item.imageOffsetX,
        item.imageOffsetY,
        item.imageScale,
        item.imageRotation,
        item.imageOpacity,
        item.createdAt || stamp,
        stamp,
      );
  }
  private upsertBalloonRow(item: Balloon) {
    const stamp = now();
    this.db
      .prepare(
        `insert into balloons(id,page_id,name,type,x,y,width,height,rotation,z_index,visible,locked,fill_color,stroke_color,stroke_width,opacity,tail_direction,tail_offset,created_at,updated_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,name=excluded.name,type=excluded.type,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,fill_color=excluded.fill_color,stroke_color=excluded.stroke_color,stroke_width=excluded.stroke_width,opacity=excluded.opacity,tail_direction=excluded.tail_direction,tail_offset=excluded.tail_offset,updated_at=excluded.updated_at`,
      )
      .run(
        item.id,
        item.pageId,
        item.name,
        item.type,
        item.x,
        item.y,
        item.width,
        item.height,
        item.rotation,
        item.zIndex,
        item.visible ? 1 : 0,
        item.locked ? 1 : 0,
        item.fillColor,
        item.strokeColor,
        item.strokeWidth,
        item.opacity,
        item.tailDirection,
        item.tailOffset,
        item.createdAt || stamp,
        stamp,
      );
  }
  private upsertTextObjectRow(item: TextObject) {
    if (item.parentBalloonId) {
      const parent = this.db
        .prepare("select page_id from balloons where id=?")
        .get(item.parentBalloonId) as { page_id: string } | undefined;
      if (!parent || parent.page_id !== item.pageId)
        throw new Error("親の吹き出しが同じページにありません。");
    }
    const stamp = now();
    this.db
      .prepare(
        `insert into text_objects(id,page_id,parent_balloon_id,name,text,writing_mode,x,y,width,height,rotation,z_index,visible,locked,font_family,font_size,font_weight,color,text_align,vertical_align,line_height,letter_spacing,padding,opacity,created_at,updated_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,parent_balloon_id=excluded.parent_balloon_id,name=excluded.name,text=excluded.text,writing_mode=excluded.writing_mode,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,font_family=excluded.font_family,font_size=excluded.font_size,font_weight=excluded.font_weight,color=excluded.color,text_align=excluded.text_align,vertical_align=excluded.vertical_align,line_height=excluded.line_height,letter_spacing=excluded.letter_spacing,padding=excluded.padding,opacity=excluded.opacity,updated_at=excluded.updated_at`,
      )
      .run(
        item.id,
        item.pageId,
        item.parentBalloonId,
        item.name,
        item.text,
        item.writingMode,
        item.x,
        item.y,
        item.width,
        item.height,
        item.rotation,
        item.zIndex,
        item.visible ? 1 : 0,
        item.locked ? 1 : 0,
        item.fontFamily,
        item.fontSize,
        item.fontWeight,
        item.color,
        item.textAlign,
        item.verticalAlign,
        item.lineHeight,
        item.letterSpacing,
        item.padding,
        item.opacity,
        item.createdAt || stamp,
        stamp,
      );
  }
  savePanel(item: Panel) {
    this.upsertPanelRow(item);
    return this.bundle(this.projectIdForPage(item.pageId));
  }
  saveBalloon(item: Balloon) {
    this.upsertBalloonRow(item);
    return this.bundle(this.projectIdForPage(item.pageId));
  }
  saveTextObject(item: TextObject) {
    this.upsertTextObjectRow(item);
    return this.bundle(this.projectIdForPage(item.pageId));
  }
  saveCanvasBatch(input: {
    pageId: string;
    panels: Array<Omit<Panel, "createdAt" | "updatedAt">>;
    balloons: Array<Omit<Balloon, "createdAt" | "updatedAt">>;
    textObjects: Array<Omit<TextObject, "createdAt" | "updatedAt">>;
    replacePanels: boolean;
    replaceBalloons: boolean;
    replaceTextObjects: boolean;
  }) {
    const projectId = this.projectIdForPage(input.pageId);
    this.db.transaction(() => {
      if (input.replaceTextObjects)
        this.db
          .prepare("delete from text_objects where page_id=?")
          .run(input.pageId);
      if (input.replaceBalloons)
        this.db
          .prepare("delete from balloons where page_id=?")
          .run(input.pageId);
      if (input.replacePanels)
        this.db.prepare("delete from panels where page_id=?").run(input.pageId);
      for (const item of input.panels)
        this.upsertPanelRow({ ...item, createdAt: "", updatedAt: "" });
      for (const item of input.balloons)
        this.upsertBalloonRow({ ...item, createdAt: "", updatedAt: "" });
      for (const item of input.textObjects)
        this.upsertTextObjectRow({ ...item, createdAt: "", updatedAt: "" });
    })();
    return this.bundle(projectId);
  }
  deleteCanvasObject(type: "panel" | "balloon" | "text", id: string) {
    const table =
      type === "panel"
        ? "panels"
        : type === "balloon"
          ? "balloons"
          : "text_objects";
    const row = this.db
      .prepare(`select page_id from ${table} where id=?`)
      .get(id) as { page_id: string } | undefined;
    if (!row) throw new Error("Canvasオブジェクトが見つかりません。");
    const projectId = this.projectIdForPage(row.page_id);
    this.db.prepare(`delete from ${table} where id=?`).run(id);
    return this.bundle(projectId);
  }
  renameEpisode(id: string, title: string) {
    const row = this.db
      .prepare("select project_id from episodes where id=?")
      .get(id) as any;
    if (!row) throw new Error("エピソードが見つかりません。");
    this.db
      .prepare("update episodes set title=?,updated_at=? where id=?")
      .run(title, now(), id);
    return this.bundle(row.project_id);
  }
  reorderEpisodes(projectId: string, ids: string[]) {
    this.db.transaction(() =>
      ids.forEach((id, index) =>
        this.db
          .prepare(
            "update episodes set order_index=?,updated_at=? where id=? and project_id=?",
          )
          .run(index, now(), id, projectId),
      ),
    )();
    return this.bundle(projectId);
  }
  deleteEpisode(id: string) {
    const row = this.db
      .prepare("select project_id from episodes where id=?")
      .get(id) as any;
    if (!row) throw new Error("エピソードが見つかりません。");
    const count = (
      this.db
        .prepare("select count(*) count from episodes where project_id=?")
        .get(row.project_id) as any
    ).count;
    if (count <= 1) throw new Error("最後のエピソードは削除できません。");
    this.db.prepare("delete from episodes where id=?").run(id);
    const ids = (
      this.db
        .prepare(
          "select id from episodes where project_id=? order by order_index",
        )
        .all(row.project_id) as any[]
    ).map((item) => item.id);
    return this.reorderEpisodes(row.project_id, ids);
  }
  setProjectCover(projectId: string, assetId: string) {
    const exists = this.db
      .prepare("select 1 from assets where id=? and project_id=?")
      .get(assetId, projectId);
    if (!exists) throw new Error("このプロジェクトの素材ではありません。");
    this.db
      .prepare("update projects set cover_asset_id=?,updated_at=? where id=?")
      .run(assetId, now(), projectId);
    return this.bundle(projectId);
  }
  projectIdForEpisode(episodeId: string) {
    const r = this.db
      .prepare("select project_id from episodes where id=?")
      .get(episodeId) as any;
    if (!r) throw new Error("エピソードが見つかりません。");
    return r.project_id as string;
  }
  projectIdForPage(pageId: string) {
    const row = this.db
      .prepare(
        "select episodes.project_id from pages join episodes on episodes.id=pages.episode_id where pages.id=?",
      )
      .get(pageId) as any;
    if (!row) throw new Error("ページが見つかりません。");
    return row.project_id as string;
  }
  projectIdForCanvasObject(type: "panel" | "balloon" | "text", id: string) {
    const table =
      type === "panel"
        ? "panels"
        : type === "balloon"
          ? "balloons"
          : "text_objects";
    const row = this.db
      .prepare(`select page_id from ${table} where id=?`)
      .get(id) as { page_id: string } | undefined;
    if (!row) throw new Error("Canvasオブジェクトが見つかりません。");
    return this.projectIdForPage(row.page_id);
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
        .prepare(
          "insert into assets(id,project_id,file_name,relative_path,mime_type,width,height,byte_size,sha256,created_at) values(?,?,?,?,?,?,?,?,?,?)",
        )
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
  async exportProject(
    id: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (value: {
        current: number;
        total: number;
        percent: number;
        pageNumber?: number;
        status: "rendering" | "packaging" | "complete";
      }) => void;
    } = {},
  ) {
    const bundle = this.bundle(id);
    const episodeOrder = new Map(
      bundle.episodes.map((episode) => [episode.id, episode.orderIndex]),
    );
    const renderAssets = new Map<string, RenderAsset>();
    for (const asset of bundle.assets) {
      const file = this.safeProjectPath(
        bundle.project.storagePath,
        asset.relativePath,
      );
      if (!fs.existsSync(file)) continue;
      renderAssets.set(asset.id, {
        id: asset.id,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        bytes: fs.readFileSync(file),
      });
    }
    const orderedPages = [...bundle.pages].sort(
      (a, b) =>
        (episodeOrder.get(a.episodeId) ?? 0) -
          (episodeOrder.get(b.episodeId) ?? 0) || a.orderIndex - b.orderIndex,
    );
    const images: ExportImage[] = [];
    const failedPages: string[] = [];
    const total = orderedPages.length;
    for (let index = 0; index < orderedPages.length; index++) {
      if (options.signal?.aborted)
        throw new Error("書き出しをキャンセルしました。");
      const page = orderedPages[index];
      options.onProgress?.({
        current: index,
        total,
        percent: total ? Math.round((index / total) * 85) : 85,
        pageNumber: page.pageNumber,
        status: "rendering",
      });
      try {
        images.push({
          fileName: `${String(index + 1).padStart(3, "0")}.png`,
          bytes: await renderPagePng({
            page,
            panels: bundle.panels.filter((item) => item.pageId === page.id),
            balloons: bundle.balloons.filter((item) => item.pageId === page.id),
            textObjects: bundle.textObjects.filter(
              (item) => item.pageId === page.id,
            ),
            assets: renderAssets,
          }),
          mimeType: "image/png",
          width: page.width,
          height: page.height,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedPages.push(`ページ${page.pageNumber}: ${message}`);
      }
    }
    if (options.signal?.aborted)
      throw new Error("書き出しをキャンセルしました。");
    if (failedPages.length)
      throw new Error(
        `書き出しに失敗したページがあります。\n${failedPages.join("\n")}`,
      );
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
    options.onProgress?.({
      current: total,
      total,
      percent: 90,
      status: "packaging",
    });
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
        dpi: bundle.project.dpi,
      }),
    );
    fs.writeFileSync(
      path.join(outputDir, files[1]),
      await createImagesZip(images),
    );
    fs.writeFileSync(
      path.join(outputDir, files[2]),
      createProjectManifest({ ...bundle, exportedAt: now() }),
    );
    fs.writeFileSync(path.join(outputDir, files[3]), text.description, "utf8");
    fs.writeFileSync(path.join(outputDir, files[4]), text.snsPost, "utf8");
    const warnings = [
      ...(images.length === 0 ? ["画像がないため空のPDFを作成しました。"] : []),
    ];
    this.db
      .prepare("insert into export_history values(?,?,?,?,?,?)")
      .run(
        uid(),
        id,
        outputDir,
        JSON.stringify(files),
        JSON.stringify(warnings),
        now(),
      );
    options.onProgress?.({
      current: total,
      total,
      percent: 100,
      status: "complete",
    });
    return { outputDir, files, warnings };
  }
  getProviderSettings(): ProviderSettings[] {
    const defaults: ProviderSettings[] = [
      {
        providerId: "ollama",
        enabled: false,
        baseUrl: "http://127.0.0.1:11434",
        modelId: "",
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 120000,
        stream: true,
        pollIntervalMs: 1000,
      },
      {
        providerId: "comfyui",
        enabled: false,
        baseUrl: "http://127.0.0.1:8188",
        modelId: "",
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 300000,
        stream: false,
        pollIntervalMs: 1000,
      },
      {
        providerId: "mock",
        enabled: true,
        baseUrl: "http://127.0.0.1",
        modelId: "mock-text",
        temperature: 0.7,
        maxTokens: 2048,
        timeoutMs: 30000,
        stream: true,
        pollIntervalMs: 250,
      },
    ];
    const rows = this.db
      .prepare("select * from ai_provider_settings")
      .all() as Array<{
      provider_id: string;
      enabled: number;
      config_json: string;
    }>;
    const byId = new Map(
      rows.map((row) => [
        row.provider_id,
        {
          ...JSON.parse(row.config_json),
          providerId: row.provider_id,
          enabled: Boolean(row.enabled),
        },
      ]),
    );
    return defaults.map((value) => ({
      ...value,
      ...(byId.get(value.providerId) ?? {}),
    }));
  }
  saveProviderSettings(settings: ProviderSettings) {
    this.db
      .prepare(
        "insert into ai_provider_settings values(?,?,?,?) on conflict(provider_id) do update set enabled=excluded.enabled,config_json=excluded.config_json,updated_at=excluded.updated_at",
      )
      .run(
        settings.providerId,
        settings.enabled ? 1 : 0,
        JSON.stringify(settings),
        now(),
      );
    return this.getProviderSettings();
  }
  saveAIModels(
    providerId: string,
    models: Array<{
      id: string;
      name: string;
      size?: number;
      modifiedAt?: string;
    }>,
  ) {
    const stamp = now();
    this.db.transaction(() => {
      this.db
        .prepare("delete from ai_models where provider_id=?")
        .run(providerId);
      const insert = this.db.prepare(
        "insert into ai_models values(?,?,?,?,?,?)",
      );
      for (const model of models)
        insert.run(
          uid(),
          providerId,
          model.id,
          model.name,
          JSON.stringify({ size: model.size, modifiedAt: model.modifiedAt }),
          stamp,
        );
    })();
    return this.listAIModels(providerId);
  }
  listAIModels(providerId: string) {
    return (
      this.db
        .prepare(
          "select model_id as id,name,metadata_json as metadataJson,updated_at as updatedAt from ai_models where provider_id=? order by name",
        )
        .all(providerId) as any[]
    ).map((row) => {
      const metadata = JSON.parse(row.metadataJson);
      return {
        id: row.id,
        name: row.name,
        size: metadata.size,
        modifiedAt: metadata.modifiedAt,
        updatedAt: row.updatedAt,
        cached: true,
      };
    });
  }
  listPromptTemplates() {
    return this.db
      .prepare(
        "select id,name,template,system_prompt as systemPrompt,is_builtin as isBuiltin from prompt_templates order by is_builtin desc,name",
      )
      .all();
  }
  savePromptTemplate(input: {
    id?: string;
    name: string;
    template: string;
    systemPrompt: string;
  }) {
    const stamp = now();
    if (input.id) {
      const row = this.db
        .prepare("select is_builtin from prompt_templates where id=?")
        .get(input.id) as any;
      if (row?.is_builtin)
        throw new Error("初期テンプレートは上書きできません。");
      this.db
        .prepare(
          "update prompt_templates set name=?,template=?,system_prompt=?,updated_at=? where id=?",
        )
        .run(input.name, input.template, input.systemPrompt, stamp, input.id);
    } else
      this.db
        .prepare("insert into prompt_templates values(?,?,?,?,?,?,?)")
        .run(
          uid(),
          input.name,
          input.template,
          input.systemPrompt,
          0,
          stamp,
          stamp,
        );
    return this.listPromptTemplates();
  }
  deletePromptTemplate(id: string) {
    this.db
      .prepare("delete from prompt_templates where id=? and is_builtin=0")
      .run(id);
    return this.listPromptTemplates();
  }
  listChatSessions(projectId?: string) {
    return projectId
      ? this.db
          .prepare(
            "select * from chat_sessions where project_id=? order by updated_at desc",
          )
          .all(projectId)
      : this.db
          .prepare("select * from chat_sessions order by updated_at desc")
          .all();
  }
  createChatSession(projectId: string | undefined, title: string) {
    const id = uid(),
      stamp = now();
    this.db
      .prepare("insert into chat_sessions values(?,?,?,?,?)")
      .run(id, projectId ?? null, title.slice(0, 200), stamp, stamp);
    return id;
  }
  renameChatSession(id: string, title: string) {
    this.db
      .prepare("update chat_sessions set title=?,updated_at=? where id=?")
      .run(title, now(), id);
  }
  deleteChatSession(id: string) {
    this.db.prepare("delete from chat_sessions where id=?").run(id);
  }
  listChatMessages(sessionId: string) {
    return this.db
      .prepare(
        "select id,session_id as sessionId,role,content,provider_id as providerId,model_id as modelId,created_at as createdAt from chat_messages where session_id=? order by created_at",
      )
      .all(sessionId);
  }
  addChatMessage(
    sessionId: string,
    role: "user" | "assistant" | "system",
    content: string,
    providerId?: string,
    modelId?: string,
  ) {
    const id = uid();
    this.db
      .prepare("insert into chat_messages values(?,?,?,?,?,?,?)")
      .run(
        id,
        sessionId,
        role,
        content,
        providerId ?? null,
        modelId ?? null,
        now(),
      );
    this.db
      .prepare("update chat_sessions set updated_at=? where id=?")
      .run(now(), sessionId);
    return id;
  }
  createGenerationJob(input: {
    projectId?: string;
    episodeId?: string;
    pageId?: string;
    providerType: string;
    providerId: string;
    modelId?: string;
    generationType: string;
    prompt: string;
    negativePrompt?: string;
    inputJson?: unknown;
  }) {
    const id = uid();
    this.db
      .prepare(
        "insert into generation_jobs(id,project_id,episode_id,page_id,provider_type,provider_id,model_id,generation_type,status,prompt,negative_prompt,input_json,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        input.projectId ?? null,
        input.episodeId ?? null,
        input.pageId ?? null,
        input.providerType,
        input.providerId,
        input.modelId ?? null,
        input.generationType,
        "queued",
        input.prompt,
        input.negativePrompt ?? "",
        JSON.stringify(input.inputJson ?? {}),
        now(),
      );
    return id;
  }
  updateGenerationJob(
    id: string,
    status: GenerationStatus,
    values: {
      providerJobId?: string;
      output?: unknown;
      errorCode?: string;
      errorMessage?: string;
      progress?: number;
    } = {},
  ) {
    const started = status === "running" ? now() : null,
      completed = ["completed", "failed", "canceled"].includes(status)
        ? now()
        : null;
    this.db
      .prepare(
        "update generation_jobs set status=?,provider_job_id=coalesce(?,provider_job_id),output_json=coalesce(?,output_json),error_code=?,error_message=?,progress=coalesce(?,progress),started_at=coalesce(started_at,?),completed_at=? where id=?",
      )
      .run(
        status,
        values.providerJobId ?? null,
        values.output === undefined ? null : JSON.stringify(values.output),
        values.errorCode ?? null,
        values.errorMessage ?? null,
        values.progress ?? (status === "completed" ? 1 : null),
        started,
        completed,
        id,
      );
  }
  listGenerationJobs(projectId?: string) {
    const sql =
      "select id,project_id as projectId,episode_id as episodeId,page_id as pageId,provider_type as providerType,provider_id as providerId,model_id as modelId,generation_type as generationType,status,progress,prompt,negative_prompt as negativePrompt,input_json as inputJson,output_json as outputJson,provider_job_id as providerJobId,error_code as errorCode,error_message as errorMessage,created_at as createdAt,started_at as startedAt,completed_at as completedAt from generation_jobs";
    return projectId
      ? this.db
          .prepare(`${sql} where project_id=? order by created_at desc`)
          .all(projectId)
      : this.db.prepare(`${sql} order by created_at desc`).all();
  }
  getGenerationJob(id: string) {
    return this.db
      .prepare("select * from generation_jobs where id=?")
      .get(id) as Record<string, unknown> | undefined;
  }
  registerGeneratedAsset(
    projectId: string,
    sourceRelativePath: string,
    jobId: string,
    metadata: unknown,
  ) {
    const project = this.bundle(projectId).project;
    const source = this.safeProjectPath(
      project.storagePath,
      sourceRelativePath,
    );
    const before = new Set(
      this.bundle(projectId).assets.map((asset) => asset.id),
    );
    const bundle = this.importAssets(projectId, [source]);
    const asset =
      bundle.assets.find((item) => !before.has(item.id)) ??
      bundle.assets.find(
        (item) =>
          item.sha256 ===
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(source))
            .digest("hex"),
      );
    if (!asset) throw new Error("生成画像を素材へ登録できませんでした。");
    this.db
      .prepare(
        "update assets set generation_job_id=?,metadata_json=? where id=?",
      )
      .run(jobId, JSON.stringify(metadata), asset.id);
    this.db
      .prepare("insert into generation_outputs values(?,?,?,?,?,?)")
      .run(
        uid(),
        jobId,
        asset.id,
        asset.relativePath,
        JSON.stringify(metadata),
        now(),
      );
    return this.bundle(projectId);
  }
  projectContext(projectId: string, episodeId?: string, pageId?: string) {
    const bundle = this.bundle(projectId),
      episode = bundle.episodes.find((item) => item.id === episodeId),
      page = bundle.pages.find((item) => item.id === pageId);
    const lines = [
      `Project: ${bundle.project.title}`,
      bundle.project.description && `説明: ${bundle.project.description}`,
      bundle.project.genre && `ジャンル: ${bundle.project.genre}`,
      `対象年齢: ${bundle.project.ageRating}`,
      `読み方向: ${bundle.project.readingDirection === "rtl" ? "右開き" : "左開き"}`,
      episode && `Episode: ${episode.title}`,
      page && `Page: ${page.pageNumber}`,
      page?.prompt && `Page Prompt: ${page.prompt}`,
      page?.negativePrompt && `Negative Prompt: ${page.negativePrompt}`,
      page?.notes && `メモ: ${page.notes}`,
    ].filter(Boolean);
    return { summary: lines.join("\n"), items: lines };
  }
  registerComfyWorkflow(name: string, sourcePath: string, mapping: unknown) {
    if (path.extname(sourcePath).toLowerCase() !== ".json")
      throw new Error("ComfyUIワークフローはJSONを選択してください。");
    const raw = fs.readFileSync(sourcePath, "utf8");
    JSON.parse(raw);
    const dir = path.join(this.paths.root, "ai", "workflows");
    fs.mkdirSync(dir, { recursive: true });
    const id = uid(),
      destination = path.join(dir, `${id}.json`);
    fs.copyFileSync(sourcePath, destination);
    const count = (
      this.db.prepare("select count(*) count from comfy_workflows").get() as any
    ).count;
    this.db
      .prepare("insert into comfy_workflows values(?,?,?,?,?,?,?)")
      .run(
        id,
        name,
        destination,
        JSON.stringify(mapping),
        count === 0 ? 1 : 0,
        now(),
        now(),
      );
    return this.listComfyWorkflows();
  }
  listComfyWorkflows() {
    return this.db
      .prepare(
        "select id,name,file_path as filePath,mapping_json as mappingJson,is_default as isDefault,created_at as createdAt,updated_at as updatedAt from comfy_workflows order by is_default desc,name",
      )
      .all();
  }
  getComfyWorkflow(id: string) {
    const row = this.db
      .prepare("select * from comfy_workflows where id=?")
      .get(id) as any;
    if (!row) throw new Error("ComfyUIワークフローが見つかりません。");
    const allowed = path.resolve(this.paths.root, "ai", "workflows") + path.sep,
      resolved = path.resolve(row.file_path);
    if (!resolved.startsWith(allowed))
      throw new Error("許可されていないワークフローパスです。");
    return {
      workflow: JSON.parse(fs.readFileSync(resolved, "utf8")),
      mapping: JSON.parse(row.mapping_json),
    };
  }
  updateComfyWorkflow(id: string, name: string, mapping: unknown) {
    const result = this.db
      .prepare(
        "update comfy_workflows set name=?,mapping_json=?,updated_at=? where id=?",
      )
      .run(name, JSON.stringify(mapping), now(), id);
    if (!result.changes) throw new Error("ワークフローが見つかりません。");
    return this.listComfyWorkflows();
  }
  setDefaultComfyWorkflow(id: string) {
    this.db.transaction(() => {
      this.db.prepare("update comfy_workflows set is_default=0").run();
      const result = this.db
        .prepare(
          "update comfy_workflows set is_default=1,updated_at=? where id=?",
        )
        .run(now(), id);
      if (!result.changes) throw new Error("ワークフローが見つかりません。");
    })();
    return this.listComfyWorkflows();
  }
  validateComfyWorkflow(id: string) {
    const definition = this.getComfyWorkflow(id),
      errors: string[] = [],
      fields: string[] = [];
    for (const [field, target] of Object.entries(definition.mapping) as Array<
      [string, any]
    >) {
      if (!target) continue;
      fields.push(field);
      const node = definition.workflow[target.nodeId];
      if (!node)
        errors.push(`${field}: ノード ${target.nodeId} がありません。`);
      else if (!node.inputs || !(target.input in node.inputs))
        errors.push(
          `${field}: ${target.nodeId}.${target.input} がありません。`,
        );
    }
    if (!definition.mapping.prompt) errors.push("Promptマッピングが必要です。");
    return {
      ok: errors.length === 0,
      message: errors.length
        ? errors.join("\n")
        : `${fields.length}項目のマッピングを確認しました。`,
      fields,
    };
  }
  deleteComfyWorkflow(id: string) {
    const row = this.db
      .prepare("select file_path,is_default from comfy_workflows where id=?")
      .get(id) as any;
    if (row?.file_path && fs.existsSync(row.file_path))
      fs.rmSync(row.file_path);
    this.db.prepare("delete from comfy_workflows where id=?").run(id);
    if (row?.is_default) {
      const next = this.db
        .prepare("select id from comfy_workflows order by created_at limit 1")
        .get() as any;
      if (next)
        this.db
          .prepare("update comfy_workflows set is_default=1 where id=?")
          .run(next.id);
    }
    return this.listComfyWorkflows();
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
      name: p.name,
      orderIndex: p.order_index,
      zIndex: p.z_index,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      rotation: p.rotation,
      visible: Boolean(p.visible),
      locked: Boolean(p.locked),
      borderColor: p.border_color,
      borderWidth: p.border_width,
      fillColor: p.fill_color,
      imageAssetId: p.image_asset_id,
      imageFit: p.image_fit,
      imageOffsetX: p.image_offset_x,
      imageOffsetY: p.image_offset_y,
      imageScale: p.image_scale,
      imageRotation: p.image_rotation,
      imageOpacity: p.image_opacity,
      prompt: p.prompt,
      negativePrompt: p.negative_prompt,
      generationStatus: p.generation_status,
      metadata: p.metadata,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
    const balloons = (
      this.db
        .prepare(
          "select b.* from balloons b join pages p on p.id=b.page_id join episodes e on e.id=p.episode_id where e.project_id=? order by b.z_index",
        )
        .all(projectId) as any[]
    ).map((b) => ({
      id: b.id,
      pageId: b.page_id,
      name: b.name,
      type: b.type,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      rotation: b.rotation,
      zIndex: b.z_index,
      visible: Boolean(b.visible),
      locked: Boolean(b.locked),
      fillColor: b.fill_color,
      strokeColor: b.stroke_color,
      strokeWidth: b.stroke_width,
      opacity: b.opacity,
      tailDirection: b.tail_direction,
      tailOffset: b.tail_offset,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));
    const textObjects = (
      this.db
        .prepare(
          "select t.* from text_objects t join pages p on p.id=t.page_id join episodes e on e.id=p.episode_id where e.project_id=? order by t.z_index",
        )
        .all(projectId) as any[]
    ).map((t) => ({
      id: t.id,
      pageId: t.page_id,
      parentBalloonId: t.parent_balloon_id,
      name: t.name,
      text: t.text,
      writingMode: t.writing_mode,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      zIndex: t.z_index,
      visible: Boolean(t.visible),
      locked: Boolean(t.locked),
      fontFamily: t.font_family,
      fontSize: t.font_size,
      fontWeight: t.font_weight,
      color: t.color,
      textAlign: t.text_align,
      verticalAlign: t.vertical_align,
      lineHeight: t.line_height,
      letterSpacing: t.letter_spacing,
      padding: t.padding,
      opacity: t.opacity,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
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
    return {
      project: this.project(p),
      episodes,
      pages,
      panels,
      balloons,
      textObjects,
      assets,
    };
  }
}
