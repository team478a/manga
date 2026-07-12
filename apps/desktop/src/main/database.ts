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
 create table if not exists ai_provider_settings(provider_id text primary key,enabled integer not null,config_json text not null,updated_at text not null);
 create table if not exists ai_models(id text primary key,provider_id text not null,model_id text not null,name text not null,metadata_json text not null default '{}',updated_at text not null,unique(provider_id,model_id));
 create table if not exists chat_sessions(id text primary key,project_id text references projects(id) on delete set null,title text not null,created_at text not null,updated_at text not null);
 create table if not exists chat_messages(id text primary key,session_id text not null references chat_sessions(id) on delete cascade,role text not null check(role in ('user','assistant','system')),content text not null,provider_id text,model_id text,created_at text not null);
 create table if not exists prompt_templates(id text primary key,name text not null,template text not null,system_prompt text not null default '',is_builtin integer not null default 0,created_at text not null,updated_at text not null);
 create table if not exists generation_jobs(id text primary key,project_id text references projects(id) on delete set null,episode_id text references episodes(id) on delete set null,page_id text references pages(id) on delete set null,provider_type text not null,provider_id text not null,model_id text,generation_type text not null,status text not null,prompt text not null,negative_prompt text not null default '',input_json text not null default '{}',output_json text not null default '{}',provider_job_id text,error_code text,error_message text,created_at text not null,started_at text,completed_at text);
 create table if not exists generation_outputs(id text primary key,job_id text not null references generation_jobs(id) on delete cascade,asset_id text references assets(id) on delete set null,relative_path text,metadata_json text not null default '{}',created_at text not null);
 create table if not exists comfy_workflows(id text primary key,name text not null,file_path text not null,mapping_json text not null,is_default integer not null default 0,created_at text not null,updated_at text not null);
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
      ...(images.some((image) => image.mimeType === "image/webp")
        ? ["WebPはZIPに含まれますがPDFページには含まれません。"]
        : []),
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
