import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  createImagesZip,
  createPagesPdf,
  createProjectManifest,
  createSalesPackageZip,
  createSalesTextDraft,
  SALES_PACKAGE_FORMAT,
  SALES_PACKAGE_VERSION,
  type ExportImage,
  type SalesPackageFileRole,
  type SalesPackageManifest,
} from "@mangai/export-core";
import {
  INTERNAL_PANEL_CACHE_TAG_PREFIX,
  isInternalPanelCacheAsset,
  type CharacterProfile,
  type CharacterReferenceRole,
  type ProjectBundle,
  type Project,
} from "@mangai/project-core";
import {
  CONTENT_POLICY_VERSION,
  assetLibraryMetadataInputSchema,
  characterProfileInputSchema,
  characterReferenceAssetInputSchema,
  cloudProjectImportSchema,
  projectInputSchema,
  resolveProjectContentClass,
  type AssetLibraryMetadataInput,
  type ProjectInput,
} from "@mangai/shared";
import {
  ADULT_GENERATION_CONSENT_VALIDITY_DAYS,
  ADULT_GENERATION_TERMS_VERSION,
  adultGenerationConsentInputSchema,
  adultReferenceImageAssessmentInputSchema,
  adultReferenceImageAssessmentSchema,
  adultGenerationSettingsSchema,
  adultModelApprovalInputSchema,
  adultModelApprovalSchema,
  adultProviderApprovalInputSchema,
  adultProviderApprovalSchema,
  evaluateAdultProviderCapability,
  analyzeComfyWorkflowOptimization,
  defaultPromptTemplates,
  generationJobDraftSchema,
  generationQueueSettingsSchema,
  generationRouteDecisionRecordSchema,
  projectGenerationPolicyInputSchema,
  projectGenerationPolicySchema,
  phase5HardwareEvidenceSchema,
  routeDecisionSchema,
  routingContextSchema,
  type GenerationJobDraftInput,
  type AdultGenerationSettings,
  type AdultReferenceImageAssessment,
  type AdultModelApproval,
  type AdultProviderApproval,
  type ImageGenerationModelMetadata,
  type GenerationRouteDecisionRecord,
  type GenerationStatus,
  type GenerationQueueSettings,
  type ProjectGenerationPolicy,
  type ProjectGenerationPolicyInput,
  type ProviderSettings,
  type RouteDecision,
  type RoutingContextInput,
  type RuntimeProfileState,
} from "@mangai/ai-core";
import {
  applyPageTemplate,
  getEpisodeTemplate,
  type Balloon,
  type EpisodeTemplateId,
  type Panel,
  type PanelLayer,
  type TextObject,
} from "@mangai/canvas-core";
import {
  renderPagePng,
  renderPanelLayerCachePng,
  type RenderAsset,
} from "./page-renderer.js";
import { DEZGO_QUEUE_POLICY } from "./ai/dezgo-queue-policy.js";
import {
  MigrationRunner,
  type Migration,
  type MigrationRunnerEvent,
} from "./infrastructure/sqlite/migration-runner.js";
import { StructuredLogger } from "./structured-logger.js";
import { AssetRepository } from "./modules/assets/asset-repository.js";
import { AssetFileService } from "./modules/assets/asset-file-service.js";
import { BackupReader } from "./modules/backup/backup-reader.js";
import { BackupWriter } from "./modules/backup/backup-writer.js";
import { RestoreService } from "./modules/backup/restore-service.js";
import {
  BACKUP_FORMAT,
  assetExtension,
  parseBackupManifest,
  type BackupChatMessage,
  type BackupChatSession,
  type BackupGenerationJob,
  type BackupGenerationOutput,
  type BackupOperation,
  type ProjectBackupHistory,
  type ProjectBackupManifest,
} from "./modules/backup/backup-manifest.js";
import {
  assertBulkOperationActive,
  type BulkOperationOptions,
} from "./modules/backup/backup-operation.js";

export type Paths = {
  root: string;
  database: string;
  projects: string;
  assets: string;
  exports: string;
  logs: string;
};
export class DatabaseIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseIntegrityError";
  }
}
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
export type AutoBackupRunResult = {
  checkedAt: string;
  created: Array<{ projectId: string; filePath: string; byteSize: number }>;
  skipped: Array<{ projectId: string; reason: "unchanged" | "interval" }>;
  errors: Array<{ projectId: string; message: string }>;
};
function uniqueTrashDestination(directory: string, name: string) {
  const stamp = Date.now();
  for (let attempt = 0; attempt < 1000; attempt++) {
    const suffix = attempt ? `-${attempt}` : "";
    const destination = path.join(directory, `${name}-${stamp}${suffix}`);
    if (!fs.existsSync(destination)) return destination;
  }
  throw new Error("ゴミ箱の保存先を確保できませんでした。");
}

function moveProjectDirectoryToTrash(
  source: string,
  preferredTrash: string,
  projectId: string,
) {
  const moveInto = (trash: string) => {
    fs.mkdirSync(trash, { recursive: true });
    const destination = uniqueTrashDestination(trash, projectId);
    fs.renameSync(source, destination);
    return destination;
  };
  try {
    return moveInto(preferredTrash);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "EXDEV") throw error;
    return moveInto(path.join(path.dirname(source), ".mangai-trash"));
  }
}

function isSqliteCorruptionError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    code === "SQLITE_CORRUPT" ||
    code === "SQLITE_NOTADB" ||
    message.includes("database disk image is malformed") ||
    message.includes("file is not a database")
  );
}

function openCheckedDatabase(databasePath: string, existed: boolean) {
  let database: Database.Database | undefined;
  try {
    if (existed && fs.statSync(databasePath).size === 0)
      throw new DatabaseIntegrityError(
        "SQLiteファイルが空です。書き込み中断または破損の可能性があります。",
      );
    database = new Database(databasePath);
    if (existed) {
      const rows = database.pragma("quick_check") as Array<
        Record<string, unknown>
      >;
      const messages = rows
        .flatMap((row) => Object.values(row))
        .map(String)
        .filter((value) => value.toLowerCase() !== "ok");
      if (messages.length)
        throw new DatabaseIntegrityError(
          `SQLite整合性検査に失敗しました: ${messages.slice(0, 3).join(" / ")}`,
        );
    }
    return database;
  } catch (error) {
    database?.close();
    if (error instanceof DatabaseIntegrityError) throw error;
    if (isSqliteCorruptionError(error))
      throw new DatabaseIntegrityError(
        error instanceof Error ? error.message : "SQLiteが破損しています。",
      );
    throw error;
  }
}

export class MangaiDatabase {
  private db: Database.Database;
  private assets: AssetRepository;
  private assetFiles: AssetFileService;
  private backupWriter: BackupWriter;
  private restoreService: RestoreService;
  constructor(public paths: Paths) {
    const databaseExisted = fs.existsSync(paths.database);
    Object.values(paths)
      .filter((x) => x !== paths.database)
      .forEach((x) => fs.mkdirSync(x, { recursive: true }));
    this.db = openCheckedDatabase(paths.database, databaseExisted);
    this.assets = new AssetRepository(this.db);
    this.assetFiles = new AssetFileService();
    this.backupWriter = new BackupWriter();
    this.restoreService = new RestoreService(new BackupReader());
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.migrate(databaseExisted);
  }
  close() {
    this.db.close();
  }
  private migrations(): Migration[] {
    return [
      {
        version: "canvas-v1",
        name: "Manga canvas panels, balloons and text",
        backupRequired: true,
        run: () => this.migrateCanvasV1(),
      },
      {
        version: "canvas-relative-text-v1",
        name: "Balloon-relative text geometry",
        backupRequired: true,
        run: () => this.migrateRelativeTextV1(),
      },
      {
        version: "canvas-panel-shape-v1",
        name: "Panel shape and slant ratio",
        backupRequired: true,
        run: () => this.migratePanelShapeV1(),
      },
      {
        version: "hybrid-generation-policy-v1",
        name: "Project hybrid generation policy",
        backupRequired: true,
        run: () => this.migrateGenerationPolicyV1(),
      },
      {
        version: "hybrid-generation-routing-v1",
        name: "Hybrid generation route decisions",
        backupRequired: true,
        run: () => this.migrateGenerationRoutingV1(),
      },
      {
        version: "asset-library-v1",
        name: "Project asset library metadata",
        backupRequired: true,
        run: () => this.migrateAssetLibraryV1(),
      },
      {
        version: "panel-layers-v1",
        name: "Layered panel image foundation",
        backupRequired: true,
        run: () => this.migratePanelLayersV1(),
      },
      {
        version: "adult-generation-consent-v1",
        name: "Adult generation administrator switch and age attestation",
        backupRequired: true,
        run: () => this.migrateAdultGenerationConsentV1(),
      },
      {
        version: "adult-provider-policy-v1",
        name: "Adult provider approval evidence and model allowlist",
        backupRequired: true,
        run: () => this.migrateAdultProviderPolicyV1(),
      },
      {
        version: "adult-provider-policy-import-v1",
        name: "Signed adult provider policy import audit",
        backupRequired: true,
        run: () => this.migrateAdultProviderPolicyImportV1(),
      },
      {
        version: "content-class-v1",
        name: "General and adult product boundary",
        backupRequired: true,
        run: () => this.migrateContentClassV1(),
      },
      {
        version: "character-profiles-v1",
        name: "Local character profiles and reference assets",
        backupRequired: true,
        run: () => this.migrateCharacterProfilesV1(),
      },
    ];
  }
  private migrate(databaseExisted: boolean) {
    const logger = new StructuredLogger(this.paths.logs);
    const runner = new MigrationRunner(this.db, {
      databasePath: this.paths.database,
      backupDirectory: path.join(this.paths.root, "backups"),
      databaseExisted,
      onEvent: (event: MigrationRunnerEvent) => {
        logger.log(
          event.event === "migration_failed" ? "error" : "info",
          event.event,
          event.event === "migration_failed"
            ? {
                version: event.version,
                name: event.name,
                error: event.error,
              }
            : { version: event.version, name: event.name },
        );
      },
    });
    runner.run(this.migrations(), () => {
      this.db.exec(`
 create table if not exists projects(id text primary key,title text not null,subtitle text not null default '',description text not null default '',genre text not null default '',age_rating text not null,content_class text not null default 'adult' check(content_class in ('general','adult')),reading_direction text not null,width integer not null,height integer not null,dpi integer not null,storage_path text not null,cover_asset_id text,created_at text not null,updated_at text not null,last_opened_at text);
 create table if not exists episodes(id text primary key,project_id text not null references projects(id) on delete cascade,title text not null,order_index integer not null,created_at text not null,updated_at text not null);
 create table if not exists assets(id text primary key,project_id text not null references projects(id) on delete cascade,file_name text not null,relative_path text not null,mime_type text not null,width integer not null,height integer not null,byte_size integer not null,sha256 text not null,created_at text not null,unique(project_id,sha256));
 create table if not exists pages(id text primary key,episode_id text not null references episodes(id) on delete cascade,page_number integer not null,order_index integer not null,width integer not null,height integer not null,background_color text not null default '#ffffff',image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',notes text not null default '',created_at text not null,updated_at text not null);
 create table if not exists panels(id text primary key,page_id text not null references pages(id) on delete cascade,order_index integer not null,x real not null,y real not null,width real not null,height real not null,image_asset_id text references assets(id) on delete set null,prompt text not null default '',negative_prompt text not null default '',generation_status text not null default 'idle',metadata text not null default '{}');
 create table if not exists export_history(id text primary key,project_id text not null references projects(id) on delete cascade,export_path text not null,files_json text not null,warnings_json text not null,created_at text not null);
 create table if not exists ai_provider_settings(provider_id text primary key,enabled integer not null,config_json text not null,updated_at text not null);
 create table if not exists ai_settings_history(id text primary key,provider_id text not null,changed_fields_json text not null,summary_json text not null,created_at text not null);
 create table if not exists ai_models(id text primary key,provider_id text not null,model_id text not null,name text not null,metadata_json text not null default '{}',updated_at text not null,unique(provider_id,model_id));
 create table if not exists chat_sessions(id text primary key,project_id text references projects(id) on delete set null,title text not null,created_at text not null,updated_at text not null);
 create table if not exists chat_messages(id text primary key,session_id text not null references chat_sessions(id) on delete cascade,role text not null check(role in ('user','assistant','system')),content text not null,provider_id text,model_id text,created_at text not null);
 create table if not exists prompt_templates(id text primary key,name text not null,template text not null,system_prompt text not null default '',is_builtin integer not null default 0,created_at text not null,updated_at text not null);
 create table if not exists generation_jobs(id text primary key,project_id text references projects(id) on delete set null,episode_id text references episodes(id) on delete set null,page_id text references pages(id) on delete set null,provider_type text not null,provider_id text not null,model_id text,generation_type text not null,status text not null,prompt text not null,negative_prompt text not null default '',input_json text not null default '{}',output_json text not null default '{}',provider_job_id text,error_code text,error_message text,created_at text not null,started_at text,completed_at text);
 create table if not exists generation_outputs(id text primary key,job_id text not null references generation_jobs(id) on delete cascade,asset_id text references assets(id) on delete set null,relative_path text,metadata_json text not null default '{}',created_at text not null);
 create table if not exists generation_queue_settings(id integer primary key check(id=1),night_mode_enabled integer not null default 0,start_time text not null default '22:00',end_time text not null default '07:00',updated_at text not null);
 create table if not exists adult_generation_settings(id integer primary key check(id=1),administrator_enabled integer not null default 0,user_confirmed_18_plus integer not null default 0,terms_version text,confirmed_at text,expires_at text,revoked_at text,updated_at text not null);
 create table if not exists adult_provider_approvals(provider_id text primary key check(provider_id='dezgo'),status text not null check(status in ('unverified','approved','revoked')),evidence_sha256 text,confirmed_at text,expires_at text,revoked_at text,updated_at text not null);
 create table if not exists adult_model_approvals(provider_id text not null check(provider_id='dezgo'),model_id text not null,status text not null check(status in ('approved','revoked')),license_evidence_sha256 text not null,verified_at text not null,expires_at text,updated_at text not null,primary key(provider_id,model_id));
 create table if not exists adult_provider_policy_imports(id text primary key,key_id text not null,payload_sha256 text not null,issued_at text not null,expires_at text not null,imported_at text not null);
 create table if not exists external_cost_reservations(id text primary key,project_id text not null references projects(id) on delete cascade,provider_id text not null,approval_token_sha256 text not null unique,job_id text references generation_jobs(id) on delete set null,billing_month text not null,reserved_amount_usd real not null check(reserved_amount_usd>=0),actual_amount_usd real,status text not null check(status in ('reserved','settled','released')),created_at text not null,updated_at text not null);
 create table if not exists comfy_workflows(id text primary key,name text not null,file_path text not null,mapping_json text not null,is_default integer not null default 0,created_at text not null,updated_at text not null);
 create table if not exists character_profiles(id text primary key,project_id text not null references projects(id) on delete cascade,name text not null,description text not null default '',prompt text not null default '',negative_prompt text not null default '',created_at text not null,updated_at text not null);
 create table if not exists character_profile_assets(character_profile_id text not null references character_profiles(id) on delete cascade,asset_id text not null references assets(id) on delete cascade,role text not null check(role in ('reference','face','pose')),order_index integer not null default 0,created_at text not null,primary key(character_profile_id,asset_id));
 create table if not exists operation_history(id integer primary key autoincrement,project_id text not null references projects(id) on delete cascade,label text not null,before_json text not null,after_json text not null,is_undone integer not null default 0,created_at text not null);
 create table if not exists schema_migrations(version text primary key,name text not null,applied_at text not null);
 create index if not exists idx_episodes_project on episodes(project_id,order_index);create index if not exists idx_pages_episode on pages(episode_id,order_index);create index if not exists idx_assets_project on assets(project_id,created_at);create index if not exists idx_external_cost_project_month on external_cost_reservations(project_id,provider_id,billing_month,status);`);
      this.db
        .prepare(
          `update external_cost_reservations set status='released',updated_at=?
         where status='reserved' and job_id is null`,
        )
        .run(now());
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
      if (!jobColumns.some((column) => column.name === "priority"))
        this.db.exec(
          "alter table generation_jobs add column priority integer not null default 0",
        );
      if (!jobColumns.some((column) => column.name === "attempt_count"))
        this.db.exec(
          "alter table generation_jobs add column attempt_count integer not null default 0",
        );
      if (!jobColumns.some((column) => column.name === "max_attempts"))
        this.db.exec(
          "alter table generation_jobs add column max_attempts integer not null default 3",
        );
      if (!jobColumns.some((column) => column.name === "next_attempt_at"))
        this.db.exec(
          "alter table generation_jobs add column next_attempt_at text",
        );
      if (!jobColumns.some((column) => column.name === "queue_order"))
        this.db.exec(
          "alter table generation_jobs add column queue_order integer not null default 0",
        );
      this.db.exec(
        "create index if not exists idx_generation_jobs_queue_v2 on generation_jobs(status,provider_type,priority desc,queue_order,created_at)",
      );
    });
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
        "update generation_jobs set status='queued',progress=0,provider_job_id=null,error_code='RECOVERED_AFTER_RESTART',error_message='アプリ再起動後の待機列へ戻しました。',started_at=null,completed_at=null where status='running' and generation_type='image'",
      )
      .run();
    this.db
      .prepare(
        "update generation_jobs set status='failed',error_code='INTERRUPTED',error_message='アプリ終了により生成が中断されました。',completed_at=? where status='running'",
      )
      .run(now());
  }
  private migrateCanvasV1() {
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
    })();
  }
  private migrateRelativeTextV1() {
    const columns = new Set(
      (
        this.db.prepare("pragma table_info(text_objects)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    const additions = [
      ["relative_x", "real"],
      ["relative_y", "real"],
      ["relative_width", "real"],
      ["relative_height", "real"],
    ] as const;
    this.db.transaction(() => {
      for (const [column, definition] of additions)
        if (!columns.has(column))
          this.db.exec(
            `alter table text_objects add column ${column} ${definition}`,
          );
      const children = this.db
        .prepare(
          `select t.id,t.x,t.y,t.width,t.height,b.x as parent_x,b.y as parent_y,b.width as parent_width,b.height as parent_height
           from text_objects t join balloons b on b.id=t.parent_balloon_id`,
        )
        .all() as Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        parent_x: number;
        parent_y: number;
        parent_width: number;
        parent_height: number;
      }>;
      const update = this.db.prepare(
        "update text_objects set relative_x=?,relative_y=?,relative_width=?,relative_height=? where id=?",
      );
      for (const item of children) {
        if (item.parent_width <= 0 || item.parent_height <= 0) continue;
        update.run(
          (item.x - item.parent_x) / item.parent_width,
          (item.y - item.parent_y) / item.parent_height,
          item.width / item.parent_width,
          item.height / item.parent_height,
          item.id,
        );
      }
    })();
  }
  private migratePanelShapeV1() {
    const columns = new Set(
      (
        this.db.prepare("pragma table_info(panels)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    this.db.transaction(() => {
      if (!columns.has("shape"))
        this.db.exec(
          "alter table panels add column shape text not null default 'rectangle'",
        );
      if (!columns.has("slant"))
        this.db.exec(
          "alter table panels add column slant real not null default 0.12",
        );
    })();
  }
  private migrateGenerationPolicyV1() {
    const stamp = now();
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists project_generation_policies(
          project_id text primary key references projects(id) on delete cascade,
          external_processing_policy text not null,
          prefer_local integer not null default 1,
          external_confirmation_required integer not null default 1,
          monthly_cost_limit real,
          custom_cloud_job_types_json text not null default '[]',
          created_at text not null,
          updated_at text not null
        );
      `);
      this.db
        .prepare(
          `insert into project_generation_policies(
             project_id,external_processing_policy,prefer_local,
             external_confirmation_required,monthly_cost_limit,
             custom_cloud_job_types_json,created_at,updated_at
           )
           select id,'safe_assets_only',1,1,null,'[]',?,? from projects
           where id not in (select project_id from project_generation_policies)`,
        )
        .run(stamp, stamp);
    })();
  }
  private migrateGenerationRoutingV1() {
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists generation_route_decisions(
          id text primary key,
          job_id text not null references generation_jobs(id) on delete cascade,
          project_id text not null references projects(id) on delete cascade,
          draft_json text not null,
          context_json text not null,
          decision_json text not null,
          prompt_sha256 text not null,
          created_at text not null
        );
        create index if not exists idx_generation_route_project
          on generation_route_decisions(project_id,created_at);
        create index if not exists idx_generation_route_job
          on generation_route_decisions(job_id,created_at);
      `);
    })();
  }
  private migrateAssetLibraryV1() {
    const columns = new Set(
      (
        this.db.prepare("pragma table_info(assets)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    const additions = [
      ["library_category", "text not null default 'unclassified'"],
      ["library_tags_json", "text not null default '[]'"],
      ["library_favorite", "integer not null default 0"],
      ["library_updated_at", "text"],
    ] as const;
    this.db.transaction(() => {
      for (const [column, definition] of additions)
        if (!columns.has(column))
          this.db.exec(`alter table assets add column ${column} ${definition}`);
      this.db.exec(
        "create index if not exists idx_assets_library on assets(project_id,library_category,library_favorite,created_at)",
      );
    })();
  }
  private migratePanelLayersV1() {
    const stamp = now();
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists panel_layers(
          id text primary key,
          panel_id text not null references panels(id) on delete cascade,
          name text not null,
          layer_type text not null check(layer_type in ('background','character','prop','effect','tone','mask','correction','flattened_legacy')),
          order_index integer not null,
          visible integer not null default 1,
          locked integer not null default 0,
          opacity real not null default 1,
          blend_mode text not null default 'normal' check(blend_mode in ('normal','multiply','screen','overlay')),
          asset_id text references assets(id) on delete set null,
          source_job_id text references generation_jobs(id) on delete set null,
          image_fit text not null default 'cover' check(image_fit in ('cover','contain','manual')),
          image_offset_x real not null default 0,
          image_offset_y real not null default 0,
          image_scale real not null default 1,
          image_rotation real not null default 0,
          created_at text not null,
          updated_at text not null,
          unique(panel_id,order_index)
        );
        create index if not exists idx_panel_layers_panel on panel_layers(panel_id,order_index);
        create index if not exists idx_panel_layers_asset on panel_layers(asset_id);
        create index if not exists idx_panel_layers_source_job on panel_layers(source_job_id);
      `);
      const legacyPanels = this.db
        .prepare(
          `select p.id,p.image_asset_id,p.image_fit,p.image_offset_x,
                  p.image_offset_y,p.image_scale,p.image_rotation
           from panels p
           where p.image_asset_id is not null
             and not exists(select 1 from panel_layers l where l.panel_id=p.id)`,
        )
        .all() as Array<{
        id: string;
        image_asset_id: string;
        image_fit: "cover" | "contain" | "manual";
        image_offset_x: number;
        image_offset_y: number;
        image_scale: number;
        image_rotation: number;
      }>;
      const insert = this.db.prepare(
        `insert into panel_layers(
           id,panel_id,name,layer_type,order_index,visible,locked,opacity,
           blend_mode,asset_id,source_job_id,image_fit,image_offset_x,
           image_offset_y,image_scale,image_rotation,created_at,updated_at
         ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const panel of legacyPanels)
        insert.run(
          uid(),
          panel.id,
          "従来の統合画像",
          "flattened_legacy",
          0,
          1,
          0,
          1,
          "normal",
          panel.image_asset_id,
          null,
          panel.image_fit,
          panel.image_offset_x,
          panel.image_offset_y,
          panel.image_scale,
          panel.image_rotation,
          stamp,
          stamp,
        );
    })();
  }
  private migrateAdultGenerationConsentV1() {
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists adult_generation_settings(
          id integer primary key check(id=1),
          administrator_enabled integer not null default 0,
          user_confirmed_18_plus integer not null default 0,
          terms_version text,
          confirmed_at text,
          expires_at text,
          revoked_at text,
          updated_at text not null
        );
      `);
    })();
  }
  private migrateAdultProviderPolicyV1() {
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists adult_provider_approvals(
          provider_id text primary key check(provider_id='dezgo'),
          status text not null check(status in ('unverified','approved','revoked')),
          evidence_sha256 text,
          confirmed_at text,
          expires_at text,
          revoked_at text,
          updated_at text not null
        );
        create table if not exists adult_model_approvals(
          provider_id text not null check(provider_id='dezgo'),
          model_id text not null,
          status text not null check(status in ('approved','revoked')),
          license_evidence_sha256 text not null,
          verified_at text not null,
          expires_at text,
          updated_at text not null,
          primary key(provider_id,model_id)
        );
      `);
    })();
  }
  private migrateAdultProviderPolicyImportV1() {
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists adult_provider_policy_imports(
          id text primary key,
          key_id text not null,
          payload_sha256 text not null,
          issued_at text not null,
          expires_at text not null,
          imported_at text not null
        );
      `);
    })();
  }
  private migrateContentClassV1() {
    const columns = new Set(
      (
        this.db.prepare("pragma table_info(projects)").all() as Array<{
          name: string;
        }>
      ).map((column) => column.name),
    );
    const stamp = now();
    this.db.transaction(() => {
      if (!columns.has("content_class"))
        this.db.exec(
          "alter table projects add column content_class text not null default 'adult' check(content_class in ('general','adult'))",
        );
      this.db.exec(`
        update projects
        set content_class=case
          when age_rating in ('全年齢','12歳以上','15歳以上') then 'general'
          else 'adult'
        end;
        update project_generation_policies
        set external_processing_policy='local_only',prefer_local=1,
            external_confirmation_required=1,custom_cloud_job_types_json='[]',
            updated_at='${stamp.replaceAll("'", "''")}'
        where project_id in (
          select id from projects where content_class='adult'
        );
      `);
    })();
  }
  private migrateCharacterProfilesV1() {
    this.db.transaction(() => {
      this.db.exec(`
        create table if not exists character_profiles(
          id text primary key,
          project_id text not null references projects(id) on delete cascade,
          name text not null,
          description text not null default '',
          prompt text not null default '',
          negative_prompt text not null default '',
          created_at text not null,
          updated_at text not null
        );
        create table if not exists character_profile_assets(
          character_profile_id text not null references character_profiles(id) on delete cascade,
          asset_id text not null references assets(id) on delete cascade,
          role text not null check(role in ('reference','face','pose')),
          order_index integer not null default 0,
          created_at text not null,
          primary key(character_profile_id,asset_id)
        );
        create index if not exists idx_character_profiles_project
          on character_profiles(project_id,updated_at desc);
        create index if not exists idx_character_profile_assets_order
          on character_profile_assets(character_profile_id,order_index);
      `);
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
      contentClass: resolveProjectContentClass({
        ageRating: row.age_rating,
        contentClass: row.content_class,
      }),
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
  getProjectGenerationPolicy(projectId: string): ProjectGenerationPolicy {
    const row = this.db
      .prepare(
        `select project_id as projectId,
                external_processing_policy as externalProcessingPolicy,
                prefer_local as preferLocal,
                external_confirmation_required as externalConfirmationRequired,
                monthly_cost_limit as monthlyCostLimit,
                custom_cloud_job_types_json as customCloudJobTypesJson,
                updated_at as updatedAt
         from project_generation_policies where project_id=?`,
      )
      .get(projectId) as
      | {
          projectId: string;
          externalProcessingPolicy: string;
          preferLocal: number;
          externalConfirmationRequired: number;
          monthlyCostLimit: number | null;
          customCloudJobTypesJson: string;
          updatedAt: string;
        }
      | undefined;
    if (!row) throw new Error("Projectの生成ポリシーが見つかりません。");
    return projectGenerationPolicySchema.parse({
      ...row,
      preferLocal: Boolean(row.preferLocal),
      externalConfirmationRequired: Boolean(row.externalConfirmationRequired),
      customCloudJobTypes: JSON.parse(row.customCloudJobTypesJson),
    });
  }
  saveProjectGenerationPolicy(
    input: ProjectGenerationPolicyInput,
  ): ProjectGenerationPolicy {
    const policy = projectGenerationPolicyInputSchema.parse(input);
    const project = this.db
      .prepare("select content_class as contentClass from projects where id=?")
      .get(policy.projectId) as
      { contentClass: "general" | "adult" } | undefined;
    if (!project) throw new Error("Projectが見つかりません。");
    if (
      project.contentClass === "adult" &&
      policy.externalProcessingPolicy !== "local_only"
    )
      throw new Error(
        "成人向けProjectは通常の外部処理ポリシーを利用できません。ローカル処理を使用してください。",
      );
    const stamp = now();
    const result = this.db
      .prepare(
        `update project_generation_policies
         set external_processing_policy=?,prefer_local=?,
             external_confirmation_required=?,monthly_cost_limit=?,
             custom_cloud_job_types_json=?,updated_at=?
         where project_id=?`,
      )
      .run(
        policy.externalProcessingPolicy,
        policy.preferLocal ? 1 : 0,
        policy.externalConfirmationRequired ? 1 : 0,
        policy.monthlyCostLimit,
        JSON.stringify(policy.customCloudJobTypes),
        stamp,
        policy.projectId,
      );
    if (!result.changes)
      throw new Error("Projectの生成ポリシーが見つかりません。");
    return this.getProjectGenerationPolicy(policy.projectId);
  }
  createProject(input: ProjectInput) {
    const id = uid(),
      stamp = now(),
      contentClass = resolveProjectContentClass(input),
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
        .prepare(
          `insert into projects(
             id,title,subtitle,description,genre,age_rating,content_class,
             reading_direction,width,height,dpi,storage_path,cover_asset_id,
             created_at,updated_at,last_opened_at
           ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.title,
          input.subtitle,
          input.description,
          input.genre,
          input.ageRating,
          contentClass,
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
      this.db
        .prepare(
          `insert into project_generation_policies(
             project_id,external_processing_policy,prefer_local,
             external_confirmation_required,monthly_cost_limit,
             custom_cloud_job_types_json,created_at,updated_at
           ) values(?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          contentClass === "adult" ? "local_only" : "safe_assets_only",
          1,
          1,
          null,
          "[]",
          stamp,
          stamp,
        );
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
  changeProjectContentClass(id: string, contentClass: "general" | "adult") {
    const project = this.bundle(id).project;
    if (project.contentClass === contentClass) return this.bundle(id);
    if (project.contentClass === "adult" || contentClass !== "adult")
      throw new Error(
        "成人向けProjectを一般向けへ戻すことはできません。一般向けProjectを新規作成してください。",
      );
    const runningCloudJob = this.db
      .prepare(
        `select 1 from generation_jobs
         where project_id=? and (provider_type='cloud' or provider_id='dezgo')
           and status='running' limit 1`,
      )
      .get(id);
    if (runningCloudJob)
      throw new Error(
        "実行中の外部生成をキャンセルしてから成人向けへ変更してください。",
      );
    const stamp = now();
    this.db.transaction(() => {
      this.db
        .prepare(
          `update projects
           set content_class='adult',age_rating='成人向け',updated_at=? where id=?`,
        )
        .run(stamp, id);
      this.db
        .prepare(
          `update project_generation_policies
           set external_processing_policy='local_only',prefer_local=1,
               external_confirmation_required=1,custom_cloud_job_types_json='[]',
               updated_at=? where project_id=?`,
        )
        .run(stamp, id);
      this.db
        .prepare(
          `update generation_jobs
           set status='canceled',error_code='content_class_changed',
               error_message='Projectが成人向けへ変更されたため外部送信を停止しました。',
               completed_at=?
           where project_id=? and (provider_type='cloud' or provider_id='dezgo')
             and status in ('queued','paused')`,
        )
        .run(stamp, id);
      this.db
        .prepare(
          `update external_cost_reservations set status='released',updated_at=?
           where project_id=? and status='reserved'`,
        )
        .run(stamp, id);
    })();
    return this.bundle(id);
  }
  duplicateProject(id: string) {
    const source = this.bundle(id);
    const sourceCharacterProfiles = this.listCharacterProfiles(id);
    const sourceAdultReferenceAssessments =
      this.listAdultReferenceImageAssessments(id);
    const sourcePolicy = this.getProjectGenerationPolicy(id);
    const copy = this.createProject({
      ...source.project,
      title: `${source.project.title} のコピー`,
      storagePath: undefined,
      adultProjectAcknowledged: source.project.contentClass === "adult",
    });
    const projectId = copy.project.id;
    const storagePath = copy.project.storagePath;
    try {
      const assetMap = new Map(source.assets.map((asset) => [asset.id, uid()]));
      const characterProfileMap = new Map(
        sourceCharacterProfiles.map((profile) => [profile.id, uid()]),
      );
      const episodeMap = new Map(
        source.episodes.map((episode) => [episode.id, uid()]),
      );
      const pageMap = new Map(source.pages.map((page) => [page.id, uid()]));
      const panelMap = new Map(source.panels.map((panel) => [panel.id, uid()]));
      const balloonMap = new Map(
        source.balloons.map((balloon) => [balloon.id, uid()]),
      );
      const mappedReference = (
        map: Map<string, string>,
        sourceId: string | null,
        label: string,
      ) => {
        if (!sourceId) return null;
        const mapped = map.get(sourceId);
        if (!mapped) throw new Error(`${label}の参照が不正です。`);
        return mapped;
      };
      const stamp = now();
      const preparedAssets = source.assets.map((asset) => {
        const assetId = mappedReference(assetMap, asset.id, "素材");
        if (!assetId) throw new Error("素材のIDが不正です。");
        const sourcePath = this.safeProjectPath(
          source.project.storagePath,
          asset.relativePath,
        );
        if (!fs.existsSync(sourcePath))
          throw new Error(`素材「${asset.fileName}」が見つかりません。`);
        const bytes = fs.readFileSync(sourcePath);
        const hash = crypto.createHash("sha256").update(bytes).digest("hex");
        if (bytes.length !== asset.byteSize || hash !== asset.sha256)
          throw new Error(
            `素材「${asset.fileName}」の整合性を確認できません。`,
          );
        const relativePath = path.join(
          "assets",
          `${assetId}${assetExtension(asset.mimeType)}`,
        );
        fs.writeFileSync(
          this.safeProjectPath(storagePath, relativePath),
          bytes,
          { flag: "wx" },
        );
        return { asset, assetId, relativePath };
      });

      this.db.transaction(() => {
        this.db
          .prepare("delete from episodes where project_id=?")
          .run(projectId);
        this.db
          .prepare(
            `update project_generation_policies
             set external_processing_policy=?,prefer_local=?,
                 external_confirmation_required=?,monthly_cost_limit=?,
                 custom_cloud_job_types_json=?,updated_at=?
             where project_id=?`,
          )
          .run(
            sourcePolicy.externalProcessingPolicy,
            sourcePolicy.preferLocal ? 1 : 0,
            sourcePolicy.externalConfirmationRequired ? 1 : 0,
            sourcePolicy.monthlyCostLimit,
            JSON.stringify(sourcePolicy.customCloudJobTypes),
            stamp,
            projectId,
          );
        for (const { asset, assetId, relativePath } of preparedAssets)
          this.db
            .prepare(
              `insert into assets(
                 id,project_id,file_name,relative_path,mime_type,width,height,
                 byte_size,sha256,created_at,library_category,
                 library_tags_json,library_favorite,library_updated_at
               ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              assetId,
              projectId,
              asset.fileName,
              relativePath,
              asset.mimeType,
              asset.width,
              asset.height,
              asset.byteSize,
              asset.sha256,
              stamp,
              asset.libraryCategory,
              JSON.stringify(asset.libraryTags),
              asset.libraryFavorite ? 1 : 0,
              asset.libraryUpdatedAt,
            );
        for (const item of sourceAdultReferenceAssessments)
          this.db.prepare("update assets set metadata_json=? where id=?").run(
            JSON.stringify({
              adultReferenceImageAssessment: item.assessment,
            }),
            mappedReference(assetMap, item.assetId, "参照画像の安全確認"),
          );
        for (const profile of sourceCharacterProfiles) {
          const profileId = mappedReference(
            characterProfileMap,
            profile.id,
            "キャラクターProfile",
          )!;
          this.db
            .prepare(
              `insert into character_profiles(
                 id,project_id,name,description,prompt,negative_prompt,
                 created_at,updated_at
               ) values(?,?,?,?,?,?,?,?)`,
            )
            .run(
              profileId,
              projectId,
              profile.name,
              profile.description,
              profile.prompt,
              profile.negativePrompt,
              stamp,
              stamp,
            );
          for (const reference of profile.referenceAssets)
            this.db
              .prepare(
                `insert into character_profile_assets(
                   character_profile_id,asset_id,role,order_index,created_at
                 ) values(?,?,?,?,?)`,
              )
              .run(
                profileId,
                mappedReference(
                  assetMap,
                  reference.assetId,
                  "キャラクター参照素材",
                ),
                reference.role,
                reference.orderIndex,
                stamp,
              );
        }
        for (const episode of source.episodes)
          this.db
            .prepare("insert into episodes values(?,?,?,?,?,?)")
            .run(
              mappedReference(episodeMap, episode.id, "Episode"),
              projectId,
              episode.title,
              episode.orderIndex,
              stamp,
              stamp,
            );
        for (const page of source.pages)
          this.db
            .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .run(
              mappedReference(pageMap, page.id, "Page"),
              mappedReference(episodeMap, page.episodeId, "PageのEpisode"),
              page.pageNumber,
              page.orderIndex,
              page.width,
              page.height,
              page.backgroundColor,
              mappedReference(assetMap, page.imageAssetId, "Page素材"),
              page.prompt,
              page.negativePrompt,
              page.notes,
              stamp,
              stamp,
            );
        for (const panel of source.panels)
          this.upsertPanelRow({
            ...panel,
            id: mappedReference(panelMap, panel.id, "コマ")!,
            pageId: mappedReference(pageMap, panel.pageId, "コマのPage")!,
            imageAssetId: mappedReference(
              assetMap,
              panel.imageAssetId,
              "コマ素材",
            ),
            createdAt: "",
            updatedAt: "",
          });
        for (const layer of source.panelLayers)
          this.upsertPanelLayerRow({
            ...layer,
            id: uid(),
            panelId: mappedReference(
              panelMap,
              layer.panelId,
              "コマレイヤーのコマ",
            )!,
            assetId: mappedReference(
              assetMap,
              layer.assetId,
              "コマレイヤー素材",
            ),
            sourceJobId: null,
            createdAt: "",
            updatedAt: "",
          });
        for (const balloon of source.balloons)
          this.upsertBalloonRow({
            ...balloon,
            id: mappedReference(balloonMap, balloon.id, "吹き出し")!,
            pageId: mappedReference(pageMap, balloon.pageId, "吹き出しのPage")!,
            createdAt: "",
            updatedAt: "",
          });
        for (const textObject of source.textObjects)
          this.upsertTextObjectRow({
            ...textObject,
            id: uid(),
            pageId: mappedReference(
              pageMap,
              textObject.pageId,
              "テキストのPage",
            )!,
            parentBalloonId: mappedReference(
              balloonMap,
              textObject.parentBalloonId,
              "テキストの親吹き出し",
            ),
            createdAt: "",
            updatedAt: "",
          });
        this.db
          .prepare(
            "update projects set cover_asset_id=?,updated_at=?,last_opened_at=? where id=?",
          )
          .run(
            mappedReference(assetMap, source.project.coverAssetId, "表紙素材"),
            stamp,
            stamp,
            projectId,
          );
      })();
      return this.bundle(projectId);
    } catch (error) {
      this.db.prepare("delete from projects where id=?").run(projectId);
      fs.rmSync(storagePath, { recursive: true, force: true });
      throw error;
    }
  }
  deleteProject(id: string) {
    const row = this.db
      .prepare("select storage_path from projects where id=?")
      .get(id) as any;
    if (!row) return;
    const storagePath = path.resolve(row.storage_path);
    const fileSystemRoot = path.parse(storagePath).root;
    const relativeAppRoot = path.relative(
      storagePath,
      path.resolve(this.paths.root),
    );
    if (
      storagePath === fileSystemRoot ||
      relativeAppRoot === "" ||
      (!relativeAppRoot.startsWith("..") && !path.isAbsolute(relativeAppRoot))
    )
      throw new Error("この保存先はProjectとして安全に削除できません。");

    let movedTo: string | undefined;
    try {
      if (fs.existsSync(storagePath))
        movedTo = moveProjectDirectoryToTrash(
          storagePath,
          path.join(this.paths.root, ".trash"),
          id,
        );
      this.db.prepare("delete from projects where id=?").run(id);
    } catch (error) {
      if (movedTo && fs.existsSync(movedTo) && !fs.existsSync(storagePath)) {
        try {
          fs.renameSync(movedTo, storagePath);
        } catch {
          throw new Error(
            "Project情報の削除に失敗し、退避フォルダーも元へ戻せませんでした。",
            { cause: error },
          );
        }
      }
      throw error;
    }
  }
  private projectBackupHistory(projectId: string): ProjectBackupHistory {
    const operations = (
      this.db
        .prepare(
          "select label,before_json as beforeJson,after_json as afterJson,is_undone as isUndone,created_at as createdAt from operation_history where project_id=? order by id",
        )
        .all(projectId) as BackupOperation[]
    ).filter((operation) => {
      try {
        const before = JSON.parse(operation.beforeJson);
        const after = JSON.parse(operation.afterJson);
        return !(
          before.trackedAssetIds?.length || after.trackedAssetIds?.length
        );
      } catch {
        throw new Error("Undo/Redo履歴をバックアップできませんでした。");
      }
    });
    const chatSessions = this.db
      .prepare(
        "select id,title,created_at as createdAt,updated_at as updatedAt from chat_sessions where project_id=? order by created_at",
      )
      .all(projectId) as BackupChatSession[];
    const sessionIds = new Set(chatSessions.map((session) => session.id));
    const chatMessages = (
      this.db
        .prepare(
          `select m.id,m.session_id as sessionId,m.role,m.content,m.provider_id as providerId,m.model_id as modelId,m.created_at as createdAt
           from chat_messages m join chat_sessions s on s.id=m.session_id where s.project_id=? order by m.created_at`,
        )
        .all(projectId) as BackupChatMessage[]
    ).filter((message) => sessionIds.has(message.sessionId));
    const generationJobs = this.db
      .prepare(
        `select id,episode_id as episodeId,page_id as pageId,provider_type as providerType,provider_id as providerId,model_id as modelId,generation_type as generationType,status,progress,prompt,negative_prompt as negativePrompt,input_json as inputJson,output_json as outputJson,provider_job_id as providerJobId,error_code as errorCode,error_message as errorMessage,created_at as createdAt,started_at as startedAt,completed_at as completedAt
         from generation_jobs where project_id=? order by created_at`,
      )
      .all(projectId) as BackupGenerationJob[];
    const generationOutputs = this.db
      .prepare(
        `select o.id,o.job_id as jobId,o.asset_id as assetId,o.relative_path as relativePath,o.metadata_json as metadataJson,o.created_at as createdAt
         from generation_outputs o join generation_jobs j on j.id=o.job_id where j.project_id=? order by o.created_at`,
      )
      .all(projectId) as BackupGenerationOutput[];
    const routeDecisions = this.listGenerationRouteDecisions(projectId);
    return {
      operations,
      chatSessions,
      chatMessages,
      generationJobs,
      generationOutputs,
      routeDecisions,
    };
  }
  async backupProject(
    id: string,
    destination: string,
    options?: BulkOperationOptions,
  ) {
    const bundle = this.bundle(id);
    const manifest: ProjectBackupManifest = {
      format: BACKUP_FORMAT,
      version: 2,
      createdAt: now(),
      bundle: {
        ...bundle,
        project: { ...bundle.project, storagePath: "" },
      },
      history: this.projectBackupHistory(id),
      generationPolicy: this.getProjectGenerationPolicy(id),
      characterProfiles: this.listCharacterProfiles(id),
      adultReferenceImageAssessments:
        this.listAdultReferenceImageAssessments(id),
    };
    return this.backupWriter.write({
      manifest,
      assets: bundle.assets,
      storagePath: bundle.project.storagePath,
      destination,
      resolveProjectPath: (storagePath, relativePath) =>
        this.safeProjectPath(storagePath, relativePath),
      options,
    });
  }
  async autoBackupProjects(options?: {
    nowMs?: number;
    minimumIntervalMs?: number;
    retention?: number;
  }): Promise<AutoBackupRunResult> {
    const nowMs = options?.nowMs ?? Date.now();
    const minimumIntervalMs = Math.max(
      60_000,
      options?.minimumIntervalMs ?? 30 * 60_000,
    );
    const retention = Math.min(50, Math.max(1, options?.retention ?? 5));
    const result: AutoBackupRunResult = {
      checkedAt: new Date(nowMs).toISOString(),
      created: [],
      skipped: [],
      errors: [],
    };
    const root = path.join(this.paths.root, "backups", "automatic");
    fs.mkdirSync(root, { recursive: true });
    for (const project of this.listProjects()) {
      try {
        const directory = path.join(root, project.id);
        fs.mkdirSync(directory, { recursive: true });
        for (const name of fs.readdirSync(directory))
          if (name.endsWith(".partial"))
            fs.rmSync(path.join(directory, name), { force: true });
        const files = fs
          .readdirSync(directory)
          .filter((name) => /^auto-.+-[0-9a-f]{12}\.mangai-backup$/.test(name))
          .map((name) => {
            const filePath = path.join(directory, name);
            return {
              name,
              filePath,
              modifiedAt: fs.statSync(filePath).mtimeMs,
            };
          })
          .sort((a, b) => b.modifiedAt - a.modifiedAt);
        const bundle = this.bundle(project.id);
        const history = this.projectBackupHistory(project.id);
        const generationPolicy = this.getProjectGenerationPolicy(project.id);
        const characterProfiles = this.listCharacterProfiles(project.id);
        const fingerprint = crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              ...bundle,
              project: {
                ...bundle.project,
                storagePath: "",
                lastOpenedAt: null,
              },
              history,
              generationPolicy,
              characterProfiles,
            }),
          )
          .digest("hex")
          .slice(0, 12);
        const latest = files[0];
        if (latest?.name.endsWith(`-${fingerprint}.mangai-backup`)) {
          result.skipped.push({ projectId: project.id, reason: "unchanged" });
          continue;
        }
        if (latest && nowMs - latest.modifiedAt < minimumIntervalMs) {
          result.skipped.push({ projectId: project.id, reason: "interval" });
          continue;
        }
        const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, "-");
        const destination = path.join(
          directory,
          `auto-${stamp}-${fingerprint}.mangai-backup`,
        );
        const created = await this.backupProject(project.id, destination);
        result.created.push({ projectId: project.id, ...created });
        const retained = [
          { name: path.basename(destination), filePath: destination },
          ...files,
        ];
        for (const expired of retained.slice(retention))
          fs.rmSync(expired.filePath, { force: true });
      } catch (cause) {
        result.errors.push({
          projectId: project.id,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
    return result;
  }
  async restoreProject(
    source: string,
    options?: { titleSuffix?: string } & BulkOperationOptions,
  ) {
    return this.restoreService.restore({
      source,
      projectsRoot: this.paths.projects,
      parseManifest: parseBackupManifest,
      options,
      commit: async ({ manifest, stagingDirectory, stagedAssetsDirectory }) => {
        const sourceBundle = manifest.bundle;
        const restored = this.createProject(
          projectInputSchema.parse({
            title: `${sourceBundle.project.title}${options?.titleSuffix ?? " (復元)"}`,
            subtitle: sourceBundle.project.subtitle,
            description: sourceBundle.project.description,
            genre: sourceBundle.project.genre,
            ageRating: sourceBundle.project.ageRating,
            contentClass: sourceBundle.project.contentClass,
            readingDirection: sourceBundle.project.readingDirection,
            width: sourceBundle.project.width,
            height: sourceBundle.project.height,
            dpi: sourceBundle.project.dpi,
          }),
        );
        const projectId = restored.project.id;
        const storagePath = restored.project.storagePath;
        try {
          const assetMap = new Map<string, string>();
          const episodeMap = new Map<string, string>();
          const pageMap = new Map<string, string>();
          const panelMap = new Map<string, string>();
          const panelLayerMap = new Map<string, string>();
          const balloonMap = new Map<string, string>();
          const textObjectMap = new Map<string, string>();
          const sessionMap = new Map<string, string>();
          const generationJobMap = new Map<string, string>();
          const characterProfileMap = new Map<string, string>();
          const ensureMappedId = (
            map: Map<string, string>,
            sourceId: string,
          ) => {
            if (!sourceId || typeof sourceId !== "string")
              throw new Error("バックアップ履歴のIDが不正です。");
            const existing = map.get(sourceId);
            if (existing) return existing;
            const id = uid();
            map.set(sourceId, id);
            return id;
          };
          const backupHistory = manifest.history;
          const operations = (backupHistory?.operations ?? []).map(
            (operation) => {
              try {
                return {
                  operation,
                  before: JSON.parse(operation.beforeJson),
                  after: JSON.parse(operation.afterJson),
                };
              } catch {
                throw new Error("Undo/Redo履歴を読み取れません。");
              }
            },
          );
          const collectSnapshotIds = (snapshot: any) => {
            if (
              !snapshot ||
              !Array.isArray(snapshot.episodes) ||
              !Array.isArray(snapshot.pages) ||
              !Array.isArray(snapshot.panels) ||
              !Array.isArray(snapshot.balloons ?? []) ||
              !Array.isArray(snapshot.textObjects ?? [])
            )
              throw new Error("Undo/Redo履歴の構造が不正です。");
            for (const item of snapshot.episodes)
              ensureMappedId(episodeMap, item.id);
            for (const item of snapshot.pages) ensureMappedId(pageMap, item.id);
            for (const item of snapshot.panels)
              ensureMappedId(panelMap, item.id);
            for (const item of snapshot.panelLayers ?? [])
              ensureMappedId(panelLayerMap, item.id);
            for (const item of snapshot.balloons ?? [])
              ensureMappedId(balloonMap, item.id);
            for (const item of snapshot.textObjects ?? [])
              ensureMappedId(textObjectMap, item.id);
          };
          for (const item of operations) {
            collectSnapshotIds(item.before);
            collectSnapshotIds(item.after);
          }
          for (const session of backupHistory?.chatSessions ?? [])
            ensureMappedId(sessionMap, session.id);
          for (const job of backupHistory?.generationJobs ?? [])
            ensureMappedId(generationJobMap, job.id);
          for (const profile of manifest.characterProfiles ?? [])
            ensureMappedId(characterProfileMap, profile.id);
          const mappedReference = (
            map: Map<string, string>,
            sourceId: string | null,
            label: string,
          ) => {
            if (!sourceId) return null;
            const mapped = map.get(sourceId);
            if (!mapped) throw new Error(`${label}の参照が不正です。`);
            return mapped;
          };
          const stamp = now();
          const preparedAssets = sourceBundle.assets.map((asset) => {
            const id = ensureMappedId(assetMap, asset.id);
            const relativePath = path.join(
              "assets",
              `${id}${assetExtension(asset.mimeType)}`,
            );
            fs.renameSync(
              path.join(stagedAssetsDirectory, asset.id),
              path.join(stagedAssetsDirectory, path.basename(relativePath)),
            );
            return { asset, id, relativePath };
          });
          assertBulkOperationActive(options?.signal);
          fs.rmSync(storagePath, { recursive: true, force: true });
          fs.renameSync(stagingDirectory, storagePath);
          options?.onProgress?.({
            phase: "committing",
            completed: preparedAssets.length,
            total: preparedAssets.length,
          });
          const remapSnapshot = (snapshot: any) => ({
            project: {
              ...snapshot.project,
              coverAssetId: mappedReference(
                assetMap,
                snapshot.project?.coverAssetId ?? null,
                "履歴の表紙素材",
              ),
            },
            episodes: snapshot.episodes.map((item: any) => ({
              ...item,
              id: mappedReference(episodeMap, item.id, "履歴のEpisode"),
              projectId,
            })),
            pages: snapshot.pages.map((item: any) => ({
              ...item,
              id: mappedReference(pageMap, item.id, "履歴のPage"),
              episodeId: mappedReference(
                episodeMap,
                item.episodeId,
                "履歴PageのEpisode",
              ),
              imageAssetId: mappedReference(
                assetMap,
                item.imageAssetId,
                "履歴Pageの素材",
              ),
            })),
            panels: snapshot.panels.map((item: any) => ({
              ...item,
              id: mappedReference(panelMap, item.id, "履歴のコマ"),
              pageId: mappedReference(pageMap, item.pageId, "履歴コマのPage"),
              imageAssetId: mappedReference(
                assetMap,
                item.imageAssetId,
                "履歴コマの素材",
              ),
            })),
            ...(Array.isArray(snapshot.panelLayers)
              ? {
                  panelLayers: snapshot.panelLayers.map((item: any) => ({
                    ...item,
                    id: mappedReference(
                      panelLayerMap,
                      item.id,
                      "履歴のコマレイヤー",
                    ),
                    panelId: mappedReference(
                      panelMap,
                      item.panelId,
                      "履歴コマレイヤーのコマ",
                    ),
                    assetId: mappedReference(
                      assetMap,
                      item.assetId,
                      "履歴コマレイヤーの素材",
                    ),
                    sourceJobId: mappedReference(
                      generationJobMap,
                      item.sourceJobId,
                      "履歴コマレイヤーの生成ジョブ",
                    ),
                  })),
                }
              : {}),
            balloons: (snapshot.balloons ?? []).map((item: any) => ({
              ...item,
              id: mappedReference(balloonMap, item.id, "履歴の吹き出し"),
              pageId: mappedReference(
                pageMap,
                item.pageId,
                "履歴吹き出しのPage",
              ),
            })),
            textObjects: (snapshot.textObjects ?? []).map((item: any) => ({
              ...item,
              id: mappedReference(textObjectMap, item.id, "履歴のテキスト"),
              pageId: mappedReference(
                pageMap,
                item.pageId,
                "履歴テキストのPage",
              ),
              parentBalloonId: mappedReference(
                balloonMap,
                item.parentBalloonId,
                "履歴テキストの親吹き出し",
              ),
            })),
          });
          const remappedOperations = operations.map(
            ({ operation, before, after }) => ({
              operation,
              before: remapSnapshot(before),
              after: remapSnapshot(after),
            }),
          );
          this.db.transaction(() => {
            this.db
              .prepare("delete from episodes where project_id=?")
              .run(projectId);
            if (manifest.generationPolicy) {
              const policy = projectGenerationPolicyInputSchema.parse({
                ...manifest.generationPolicy,
                projectId,
              });
              this.db
                .prepare(
                  `update project_generation_policies
               set external_processing_policy=?,prefer_local=?,
                   external_confirmation_required=?,monthly_cost_limit=?,
                   custom_cloud_job_types_json=?,updated_at=?
               where project_id=?`,
                )
                .run(
                  policy.externalProcessingPolicy,
                  policy.preferLocal ? 1 : 0,
                  policy.externalConfirmationRequired ? 1 : 0,
                  policy.monthlyCostLimit,
                  JSON.stringify(policy.customCloudJobTypes),
                  stamp,
                  projectId,
                );
            }
            for (const { asset, id, relativePath } of preparedAssets)
              this.db
                .prepare(
                  `insert into assets(
                 id,project_id,file_name,relative_path,mime_type,width,height,
                 byte_size,sha256,created_at,library_category,
                 library_tags_json,library_favorite,library_updated_at
               ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                )
                .run(
                  id,
                  projectId,
                  asset.fileName,
                  relativePath,
                  asset.mimeType,
                  asset.width,
                  asset.height,
                  asset.byteSize,
                  asset.sha256,
                  stamp,
                  asset.libraryCategory ?? "unclassified",
                  JSON.stringify(asset.libraryTags ?? []),
                  asset.libraryFavorite ? 1 : 0,
                  asset.libraryUpdatedAt ?? null,
                );
            for (const item of manifest.adultReferenceImageAssessments ?? [])
              this.db
                .prepare("update assets set metadata_json=? where id=?")
                .run(
                  JSON.stringify({
                    adultReferenceImageAssessment: item.assessment,
                  }),
                  mappedReference(assetMap, item.assetId, "参照画像の安全確認"),
                );
            for (const profile of manifest.characterProfiles ?? []) {
              const profileId = mappedReference(
                characterProfileMap,
                profile.id,
                "キャラクターProfile",
              )!;
              this.db
                .prepare(
                  `insert into character_profiles(
                 id,project_id,name,description,prompt,negative_prompt,
                 created_at,updated_at
               ) values(?,?,?,?,?,?,?,?)`,
                )
                .run(
                  profileId,
                  projectId,
                  profile.name,
                  profile.description,
                  profile.prompt,
                  profile.negativePrompt,
                  stamp,
                  stamp,
                );
              for (const reference of profile.referenceAssets)
                this.db
                  .prepare(
                    `insert into character_profile_assets(
                   character_profile_id,asset_id,role,order_index,created_at
                 ) values(?,?,?,?,?)`,
                  )
                  .run(
                    profileId,
                    mappedReference(
                      assetMap,
                      reference.assetId,
                      "キャラクター参照素材",
                    ),
                    reference.role,
                    reference.orderIndex,
                    stamp,
                  );
            }
            for (const episode of sourceBundle.episodes) {
              const id = ensureMappedId(episodeMap, episode.id);
              this.db
                .prepare("insert into episodes values(?,?,?,?,?,?)")
                .run(
                  id,
                  projectId,
                  episode.title,
                  episode.orderIndex,
                  stamp,
                  stamp,
                );
            }
            for (const page of sourceBundle.pages) {
              const episodeId = episodeMap.get(page.episodeId);
              if (!episodeId)
                throw new Error("ページのエピソード参照が不正です。");
              const id = ensureMappedId(pageMap, page.id);
              this.db
                .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
                .run(
                  id,
                  episodeId,
                  page.pageNumber,
                  page.orderIndex,
                  page.width,
                  page.height,
                  page.backgroundColor,
                  mappedReference(assetMap, page.imageAssetId, "ページ素材"),
                  page.prompt,
                  page.negativePrompt,
                  page.notes,
                  stamp,
                  stamp,
                );
            }
            for (const panel of sourceBundle.panels) {
              const pageId = pageMap.get(panel.pageId);
              if (!pageId) throw new Error("コマのページ参照が不正です。");
              this.upsertPanelRow({
                ...panel,
                id: ensureMappedId(panelMap, panel.id),
                pageId,
                imageAssetId: mappedReference(
                  assetMap,
                  panel.imageAssetId,
                  "コマ素材",
                ),
                createdAt: "",
                updatedAt: "",
              });
            }
            for (const balloon of sourceBundle.balloons) {
              const pageId = pageMap.get(balloon.pageId);
              if (!pageId) throw new Error("吹き出しのページ参照が不正です。");
              const id = ensureMappedId(balloonMap, balloon.id);
              this.upsertBalloonRow({
                ...balloon,
                id,
                pageId,
                createdAt: "",
                updatedAt: "",
              });
            }
            for (const textObject of sourceBundle.textObjects) {
              const pageId = pageMap.get(textObject.pageId);
              if (!pageId) throw new Error("テキストのページ参照が不正です。");
              this.upsertTextObjectRow({
                ...textObject,
                id: ensureMappedId(textObjectMap, textObject.id),
                pageId,
                parentBalloonId: mappedReference(
                  balloonMap,
                  textObject.parentBalloonId,
                  "親吹き出し",
                ),
                createdAt: "",
                updatedAt: "",
              });
            }
            for (const { operation, before, after } of remappedOperations)
              this.db
                .prepare(
                  "insert into operation_history(project_id,label,before_json,after_json,is_undone,created_at) values(?,?,?,?,?,?)",
                )
                .run(
                  projectId,
                  operation.label,
                  JSON.stringify(before),
                  JSON.stringify(after),
                  operation.isUndone ? 1 : 0,
                  operation.createdAt,
                );
            for (const session of backupHistory?.chatSessions ?? [])
              this.db
                .prepare("insert into chat_sessions values(?,?,?,?,?)")
                .run(
                  mappedReference(sessionMap, session.id, "チャットセッション"),
                  projectId,
                  session.title,
                  session.createdAt,
                  session.updatedAt,
                );
            for (const message of backupHistory?.chatMessages ?? []) {
              if (
                !(["user", "assistant", "system"] as string[]).includes(
                  message.role,
                )
              )
                throw new Error("チャット履歴のロールが不正です。");
              this.db
                .prepare("insert into chat_messages values(?,?,?,?,?,?,?)")
                .run(
                  uid(),
                  mappedReference(
                    sessionMap,
                    message.sessionId,
                    "チャットメッセージのセッション",
                  ),
                  message.role,
                  message.content,
                  message.providerId,
                  message.modelId,
                  message.createdAt,
                );
            }
            const validGenerationStatuses = [
              "queued",
              "paused",
              "running",
              "completed",
              "failed",
              "canceled",
            ];
            for (const job of backupHistory?.generationJobs ?? []) {
              if (!validGenerationStatuses.includes(job.status))
                throw new Error("AI生成ジョブの状態が不正です。");
              JSON.parse(job.inputJson);
              JSON.parse(job.outputJson);
              const interrupted =
                job.status === "queued" || job.status === "running";
              this.db
                .prepare(
                  `insert into generation_jobs(id,project_id,episode_id,page_id,provider_type,provider_id,model_id,generation_type,status,progress,prompt,negative_prompt,input_json,output_json,provider_job_id,error_code,error_message,created_at,started_at,completed_at)
               values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                )
                .run(
                  mappedReference(generationJobMap, job.id, "AI生成ジョブ"),
                  projectId,
                  mappedReference(episodeMap, job.episodeId, "AI生成Episode"),
                  mappedReference(pageMap, job.pageId, "AI生成Page"),
                  job.providerType,
                  job.providerId,
                  job.modelId,
                  job.generationType,
                  interrupted ? "failed" : job.status,
                  Number.isFinite(job.progress) ? job.progress : 0,
                  job.prompt,
                  job.negativePrompt,
                  job.inputJson,
                  job.outputJson,
                  job.providerJobId,
                  interrupted ? "RESTORED_INTERRUPTED" : job.errorCode,
                  interrupted
                    ? "バックアップ時に実行中だったため失敗として復元しました。"
                    : job.errorMessage,
                  job.createdAt,
                  job.startedAt,
                  interrupted ? stamp : job.completedAt,
                );
            }
            for (const layer of sourceBundle.panelLayers ?? [])
              this.upsertPanelLayerRow({
                ...layer,
                id: ensureMappedId(panelLayerMap, layer.id),
                panelId: mappedReference(
                  panelMap,
                  layer.panelId,
                  "コマレイヤーのコマ",
                )!,
                assetId: mappedReference(
                  assetMap,
                  layer.assetId,
                  "コマレイヤー素材",
                ),
                sourceJobId: mappedReference(
                  generationJobMap,
                  layer.sourceJobId,
                  "コマレイヤーの生成ジョブ",
                ),
                createdAt: "",
                updatedAt: "",
              });
            const panelsWithLayers = new Set(
              (sourceBundle.panelLayers ?? []).map((layer) => layer.panelId),
            );
            for (const panel of sourceBundle.panels)
              if (panel.imageAssetId && !panelsWithLayers.has(panel.id))
                this.syncLegacyPanelLayer({
                  ...panel,
                  id: mappedReference(panelMap, panel.id, "コマ")!,
                  pageId: mappedReference(pageMap, panel.pageId, "コマのPage")!,
                  imageAssetId: mappedReference(
                    assetMap,
                    panel.imageAssetId,
                    "コマ素材",
                  ),
                  createdAt: "",
                  updatedAt: "",
                });
            const relativePathByAssetId = new Map(
              preparedAssets.map((item) => [item.id, item.relativePath]),
            );
            for (const output of backupHistory?.generationOutputs ?? []) {
              JSON.parse(output.metadataJson);
              const jobId = mappedReference(
                generationJobMap,
                output.jobId,
                "AI生成出力のジョブ",
              );
              const assetId = mappedReference(
                assetMap,
                output.assetId,
                "AI生成出力の素材",
              );
              this.db
                .prepare("insert into generation_outputs values(?,?,?,?,?,?)")
                .run(
                  uid(),
                  jobId,
                  assetId,
                  assetId
                    ? (relativePathByAssetId.get(assetId) ??
                        output.relativePath)
                    : null,
                  output.metadataJson,
                  output.createdAt,
                );
              if (assetId)
                this.db
                  .prepare(
                    "update assets set generation_job_id=?,metadata_json=? where id=?",
                  )
                  .run(jobId, output.metadataJson, assetId);
            }
            for (const route of backupHistory?.routeDecisions ?? []) {
              const draft = generationJobDraftSchema.parse({
                ...route.draft,
                projectId,
                pageId: route.draft.pageId
                  ? pageMap.get(route.draft.pageId)
                  : undefined,
                panelId: route.draft.panelId
                  ? panelMap.get(route.draft.panelId)
                  : undefined,
                inputAssetIds: route.draft.inputAssetIds
                  .map((id) => assetMap.get(id))
                  .filter((id): id is string => Boolean(id)),
              });
              const restoredRoute = generationRouteDecisionRecordSchema.parse({
                ...route,
                id: uid(),
                jobId: mappedReference(
                  generationJobMap,
                  route.jobId,
                  "Route判定の生成ジョブ",
                ),
                projectId,
                draft,
              });
              this.db
                .prepare(
                  `insert into generation_route_decisions(
                 id,job_id,project_id,draft_json,context_json,decision_json,
                 prompt_sha256,created_at
               ) values(?,?,?,?,?,?,?,?)`,
                )
                .run(
                  restoredRoute.id,
                  restoredRoute.jobId,
                  restoredRoute.projectId,
                  JSON.stringify(restoredRoute.draft),
                  JSON.stringify(restoredRoute.context),
                  JSON.stringify(restoredRoute.decision),
                  restoredRoute.promptSha256,
                  restoredRoute.createdAt,
                );
            }
            this.db
              .prepare(
                "update projects set cover_asset_id=?,updated_at=?,last_opened_at=? where id=?",
              )
              .run(
                mappedReference(
                  assetMap,
                  sourceBundle.project.coverAssetId,
                  "表紙素材",
                ),
                stamp,
                stamp,
                projectId,
              );
          })();
          return this.openProject(projectId);
        } catch (error) {
          this.db.prepare("delete from projects where id=?").run(projectId);
          fs.rmSync(storagePath, { recursive: true, force: true });
          throw error;
        }
      },
    });
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
  private editableSnapshot(
    projectId: string,
    trackedAssetIds: string[] = [],
    trackedGenerationOutputIds: string[] = [],
  ) {
    const bundle = this.bundle(projectId);
    const assets = (
      this.db
        .prepare("select * from assets where project_id=? order by created_at")
        .all(projectId) as any[]
    )
      .filter((asset) => trackedAssetIds.includes(asset.id))
      .map((asset) => ({
        id: asset.id,
        projectId: asset.project_id,
        fileName: asset.file_name,
        relativePath: asset.relative_path,
        mimeType: asset.mime_type,
        width: asset.width,
        height: asset.height,
        byteSize: asset.byte_size,
        sha256: asset.sha256,
        generationJobId: asset.generation_job_id,
        metadataJson: asset.metadata_json,
        libraryCategory: asset.library_category ?? "unclassified",
        libraryTagsJson: asset.library_tags_json ?? "[]",
        libraryFavorite: Boolean(asset.library_favorite),
        libraryUpdatedAt: asset.library_updated_at ?? null,
        createdAt: asset.created_at,
      }));
    const generationOutputs = (
      this.db
        .prepare(
          `select o.id,o.asset_id as assetId
           from generation_outputs o
           join generation_jobs j on j.id=o.job_id
           where j.project_id=?`,
        )
        .all(projectId) as Array<{ id: string; assetId: string | null }>
    ).filter(
      (output) =>
        (output.assetId && trackedAssetIds.includes(output.assetId)) ||
        trackedGenerationOutputIds.includes(output.id),
    );
    return {
      project: {
        title: bundle.project.title,
        coverAssetId: bundle.project.coverAssetId,
      },
      episodes: bundle.episodes,
      pages: bundle.pages,
      panels: bundle.panels,
      panelLayers: bundle.panelLayers,
      balloons: bundle.balloons,
      textObjects: bundle.textObjects,
      ...(trackedAssetIds.length
        ? { trackedAssetIds, assets, generationOutputs }
        : {}),
    };
  }
  captureHistory<T>(
    projectId: string,
    label: string,
    mutation: () => T,
    options: { assetIds?: string[] } = {},
  ) {
    const trackedAssetIds = [...new Set(options.assetIds ?? [])];
    const before = this.editableSnapshot(projectId, trackedAssetIds);
    const result = mutation();
    const trackedOutputIds = (before.generationOutputs ?? []).map(
      (output: { id: string }) => output.id,
    );
    const after = this.editableSnapshot(
      projectId,
      trackedAssetIds,
      trackedOutputIds,
    );
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
  recordCreatedAssetsHistory(
    projectId: string,
    label: string,
    assetIds: string[],
  ) {
    const trackedAssetIds = [...new Set(assetIds)];
    if (!trackedAssetIds.length) return this.bundle(projectId);
    const after = this.editableSnapshot(projectId, trackedAssetIds);
    if ((after.assets?.length ?? 0) !== trackedAssetIds.length)
      throw new Error("AI生成素材の履歴を作成できませんでした。");
    const before = JSON.parse(JSON.stringify(after));
    before.assets = [];
    before.generationOutputs = before.generationOutputs.map(
      (output: { id: string; assetId: string | null }) => ({
        ...output,
        assetId: null,
      }),
    );
    if (trackedAssetIds.includes(before.project.coverAssetId))
      before.project.coverAssetId = null;
    before.pages = before.pages.map((page: any) => ({
      ...page,
      imageAssetId: trackedAssetIds.includes(page.imageAssetId)
        ? null
        : page.imageAssetId,
    }));
    before.panels = before.panels.map((panel: any) => ({
      ...panel,
      imageAssetId: trackedAssetIds.includes(panel.imageAssetId)
        ? null
        : panel.imageAssetId,
    }));
    before.panelLayers = before.panelLayers.map((layer: any) => ({
      ...layer,
      assetId: trackedAssetIds.includes(layer.assetId) ? null : layer.assetId,
    }));
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
    return this.bundle(projectId);
  }
  private restoreEditableSnapshot(projectId: string, snapshot: any) {
    const fileRollbacks: Array<() => void> = [];
    try {
      this.db.transaction(() => {
        if (
          Array.isArray(snapshot.trackedAssetIds) &&
          Array.isArray(snapshot.assets)
        )
          this.restoreSnapshotAssets(
            projectId,
            snapshot.trackedAssetIds,
            snapshot.assets,
            fileRollbacks,
          );
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
        const episodeIds = new Set(
          snapshot.episodes.map((item: any) => item.id),
        );
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
        if (Array.isArray(snapshot.panelLayers)) {
          this.db
            .prepare(
              `delete from panel_layers where panel_id in (
                 select pn.id from panels pn
                 join pages p on p.id=pn.page_id
                 join episodes e on e.id=p.episode_id
                 where e.project_id=?
               )`,
            )
            .run(projectId);
          for (const item of snapshot.panelLayers)
            this.upsertPanelLayerRow(item);
        }
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
        if (Array.isArray(snapshot.generationOutputs)) {
          const updateOutput = this.db.prepare(
            "update generation_outputs set asset_id=? where id=?",
          );
          for (const output of snapshot.generationOutputs)
            updateOutput.run(output.assetId ?? null, output.id);
        }
      })();
    } catch (error) {
      for (const rollback of fileRollbacks.reverse()) {
        try {
          rollback();
        } catch {
          // 元の例外を優先する。復旧不能時も履歴行は未更新のまま残る。
        }
      }
      throw error;
    }
  }

  private assetHistoryTrashPath(
    storagePath: string,
    asset: { id: string; relativePath: string },
  ) {
    return path.join(
      storagePath,
      ".trash",
      `asset-${asset.id}-${path.basename(asset.relativePath)}`,
    );
  }

  private verifyAssetFile(
    filePath: string,
    asset: { byteSize: number; sha256: string },
  ) {
    const bytes = fs.readFileSync(filePath);
    if (
      bytes.length !== asset.byteSize ||
      crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256
    )
      throw new Error("素材ファイルの整合性を確認できませんでした。");
  }

  private restoreSnapshotAssets(
    projectId: string,
    trackedAssetIds: string[],
    targetAssets: any[],
    fileRollbacks: Array<() => void>,
  ) {
    const project = this.bundle(projectId).project;
    const currentAssets = this.db
      .prepare("select * from assets where project_id=?")
      .all(projectId) as any[];
    const currentById = new Map(
      currentAssets.map((asset) => [asset.id, asset]),
    );
    const targetById = new Map(targetAssets.map((asset) => [asset.id, asset]));

    for (const row of currentAssets) {
      if (!trackedAssetIds.includes(row.id)) continue;
      if (targetById.has(row.id)) continue;
      const asset = {
        id: row.id,
        relativePath: row.relative_path,
        byteSize: row.byte_size,
        sha256: row.sha256,
      };
      const source = this.safeProjectPath(
        project.storagePath,
        asset.relativePath,
      );
      const trash = this.assetHistoryTrashPath(project.storagePath, asset);
      if (fs.existsSync(source)) {
        this.verifyAssetFile(source, asset);
        if (fs.existsSync(trash))
          throw new Error("素材の履歴用ゴミ箱に同名ファイルがあります。");
        fs.mkdirSync(path.dirname(trash), { recursive: true });
        fs.renameSync(source, trash);
        fileRollbacks.push(() => fs.renameSync(trash, source));
      } else if (!fs.existsSync(trash))
        throw new Error("削除する素材ファイルが見つかりません。");
      else this.verifyAssetFile(trash, asset);
      this.db.prepare("delete from assets where id=?").run(row.id);
    }

    const insert = this.db.prepare(
      `insert into assets(
         id,project_id,file_name,relative_path,mime_type,width,height,byte_size,
         sha256,created_at,generation_job_id,metadata_json,library_category,
         library_tags_json,library_favorite,library_updated_at
       ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const asset of targetAssets) {
      if (currentById.has(asset.id)) continue;
      const destination = this.safeProjectPath(
        project.storagePath,
        asset.relativePath,
      );
      const trash = this.assetHistoryTrashPath(project.storagePath, asset);
      if (!fs.existsSync(destination)) {
        if (!fs.existsSync(trash))
          throw new Error("復元する素材ファイルがゴミ箱にありません。");
        this.verifyAssetFile(trash, asset);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.renameSync(trash, destination);
        fileRollbacks.push(() => fs.renameSync(destination, trash));
      } else this.verifyAssetFile(destination, asset);
      insert.run(
        asset.id,
        projectId,
        asset.fileName,
        asset.relativePath,
        asset.mimeType,
        asset.width,
        asset.height,
        asset.byteSize,
        asset.sha256,
        asset.createdAt,
        asset.generationJobId ?? null,
        asset.metadataJson ?? "{}",
        asset.libraryCategory ?? "unclassified",
        asset.libraryTagsJson ?? "[]",
        asset.libraryFavorite ? 1 : 0,
        asset.libraryUpdatedAt ?? null,
      );
    }
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
        `insert into panels(id,page_id,order_index,x,y,width,height,image_asset_id,prompt,negative_prompt,generation_status,metadata,name,rotation,z_index,visible,locked,border_color,border_width,fill_color,shape,slant,image_fit,image_offset_x,image_offset_y,image_scale,image_rotation,image_opacity,created_at,updated_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,order_index=excluded.order_index,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,image_asset_id=excluded.image_asset_id,name=excluded.name,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,border_color=excluded.border_color,border_width=excluded.border_width,fill_color=excluded.fill_color,shape=excluded.shape,slant=excluded.slant,image_fit=excluded.image_fit,image_offset_x=excluded.image_offset_x,image_offset_y=excluded.image_offset_y,image_scale=excluded.image_scale,image_rotation=excluded.image_rotation,image_opacity=excluded.image_opacity,updated_at=excluded.updated_at`,
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
        item.shape ?? "rectangle",
        item.slant ?? 0.12,
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
  private upsertPanelLayerRow(item: PanelLayer) {
    const stamp = now();
    this.db
      .prepare(
        `insert into panel_layers(
           id,panel_id,name,layer_type,order_index,visible,locked,opacity,
           blend_mode,asset_id,source_job_id,image_fit,image_offset_x,
           image_offset_y,image_scale,image_rotation,created_at,updated_at
         ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         on conflict(id) do update set
           panel_id=excluded.panel_id,name=excluded.name,
           layer_type=excluded.layer_type,order_index=excluded.order_index,
           visible=excluded.visible,locked=excluded.locked,
           opacity=excluded.opacity,blend_mode=excluded.blend_mode,
           asset_id=excluded.asset_id,source_job_id=excluded.source_job_id,
           image_fit=excluded.image_fit,image_offset_x=excluded.image_offset_x,
           image_offset_y=excluded.image_offset_y,
           image_scale=excluded.image_scale,image_rotation=excluded.image_rotation,
           updated_at=excluded.updated_at`,
      )
      .run(
        item.id,
        item.panelId,
        item.name,
        item.type,
        item.orderIndex,
        item.visible ? 1 : 0,
        item.locked ? 1 : 0,
        item.opacity,
        item.blendMode,
        item.assetId,
        item.sourceJobId,
        item.imageFit,
        item.imageOffsetX,
        item.imageOffsetY,
        item.imageScale,
        item.imageRotation,
        item.createdAt || stamp,
        stamp,
      );
  }
  private syncLegacyPanelLayer(item: Panel) {
    if (
      this.db
        .prepare(
          "select 1 from panel_layers where panel_id=? and layer_type<>'flattened_legacy' limit 1",
        )
        .get(item.id)
    )
      return;
    const existing = this.db
      .prepare(
        "select id,created_at as createdAt from panel_layers where panel_id=? and layer_type='flattened_legacy' order by order_index limit 1",
      )
      .get(item.id) as { id: string; createdAt: string } | undefined;
    if (!item.imageAssetId) {
      this.db
        .prepare(
          "delete from panel_layers where panel_id=? and layer_type='flattened_legacy'",
        )
        .run(item.id);
      return;
    }
    if (
      !existing &&
      this.db
        .prepare("select 1 from panel_layers where panel_id=? limit 1")
        .get(item.id)
    )
      return;
    const orderIndex = existing
      ? (
          this.db
            .prepare("select order_index as value from panel_layers where id=?")
            .get(existing.id) as { value: number }
        ).value
      : (
          this.db
            .prepare(
              "select coalesce(max(order_index),-1)+1 as value from panel_layers where panel_id=?",
            )
            .get(item.id) as { value: number }
        ).value;
    this.upsertPanelLayerRow({
      id: existing?.id ?? uid(),
      panelId: item.id,
      name: "従来の統合画像",
      type: "flattened_legacy",
      orderIndex,
      visible: true,
      locked: false,
      opacity: item.imageOpacity,
      blendMode: "normal",
      assetId: item.imageAssetId,
      sourceJobId: null,
      imageFit: item.imageFit,
      imageOffsetX: item.imageOffsetX,
      imageOffsetY: item.imageOffsetY,
      imageScale: item.imageScale,
      imageRotation: item.imageRotation,
      createdAt: existing?.createdAt ?? "",
      updatedAt: "",
    });
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
    let relative:
      { x: number; y: number; width: number; height: number } | undefined;
    if (item.parentBalloonId) {
      const parent = this.db
        .prepare("select page_id,x,y,width,height from balloons where id=?")
        .get(item.parentBalloonId) as
        | {
            page_id: string;
            x: number;
            y: number;
            width: number;
            height: number;
          }
        | undefined;
      if (!parent || parent.page_id !== item.pageId)
        throw new Error("親の吹き出しが同じページにありません。");
      if (parent.width <= 0 || parent.height <= 0)
        throw new Error("親の吹き出し寸法が不正です。");
      relative = {
        x: (item.x - parent.x) / parent.width,
        y: (item.y - parent.y) / parent.height,
        width: item.width / parent.width,
        height: item.height / parent.height,
      };
    }
    const stamp = now();
    this.db
      .prepare(
        `insert into text_objects(id,page_id,parent_balloon_id,name,text,writing_mode,x,y,width,height,relative_x,relative_y,relative_width,relative_height,rotation,z_index,visible,locked,font_family,font_size,font_weight,color,text_align,vertical_align,line_height,letter_spacing,padding,opacity,created_at,updated_at)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict(id) do update set page_id=excluded.page_id,parent_balloon_id=excluded.parent_balloon_id,name=excluded.name,text=excluded.text,writing_mode=excluded.writing_mode,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,relative_x=excluded.relative_x,relative_y=excluded.relative_y,relative_width=excluded.relative_width,relative_height=excluded.relative_height,rotation=excluded.rotation,z_index=excluded.z_index,visible=excluded.visible,locked=excluded.locked,font_family=excluded.font_family,font_size=excluded.font_size,font_weight=excluded.font_weight,color=excluded.color,text_align=excluded.text_align,vertical_align=excluded.vertical_align,line_height=excluded.line_height,letter_spacing=excluded.letter_spacing,padding=excluded.padding,opacity=excluded.opacity,updated_at=excluded.updated_at`,
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
        relative?.x ?? null,
        relative?.y ?? null,
        relative?.width ?? null,
        relative?.height ?? null,
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
    this.db.transaction(() => {
      this.upsertPanelRow(item);
      this.syncLegacyPanelLayer(item);
    })();
    return this.bundle(this.projectIdForPage(item.pageId));
  }
  savePanelLayers(
    panelId: string,
    layers: Array<Omit<PanelLayer, "createdAt" | "updatedAt">>,
  ) {
    const row = this.db
      .prepare(
        `select e.project_id as projectId from panels pn
         join pages p on p.id=pn.page_id
         join episodes e on e.id=p.episode_id where pn.id=?`,
      )
      .get(panelId) as { projectId: string } | undefined;
    if (!row) throw new Error("コマが見つかりません。");
    for (const layer of layers) {
      if (layer.panelId !== panelId)
        throw new Error("保存するレイヤーのコマが一致していません。");
      if (
        layer.assetId &&
        !this.db
          .prepare("select 1 from assets where id=? and project_id=?")
          .get(layer.assetId, row.projectId)
      )
        throw new Error("このProjectの素材ではありません。");
      if (
        layer.sourceJobId &&
        !this.db
          .prepare("select 1 from generation_jobs where id=? and project_id=?")
          .get(layer.sourceJobId, row.projectId)
      )
        throw new Error("このProjectの生成ジョブではありません。");
    }
    this.db.transaction(() => {
      this.db.prepare("delete from panel_layers where panel_id=?").run(panelId);
      for (const layer of layers)
        this.upsertPanelLayerRow({
          ...layer,
          createdAt: "",
          updatedAt: "",
        });
    })();
    return this.bundle(row.projectId);
  }
  async refreshPanelLayerCaches(projectId: string, panelIds?: string[]) {
    const bundle = this.bundle(projectId);
    const requested = panelIds ? new Set(panelIds) : null;
    const panels = bundle.panels.filter(
      (panel) => !requested || requested.has(panel.id),
    );
    const targetPanelIds = new Set(panels.map((panel) => panel.id));
    const requiredAssetIds = new Set(
      bundle.panelLayers
        .filter(
          (layer) =>
            targetPanelIds.has(layer.panelId) &&
            layer.type !== "flattened_legacy" &&
            layer.visible &&
            layer.assetId,
        )
        .map((layer) => layer.assetId as string),
    );
    const renderAssets = new Map<string, RenderAsset>();
    for (const asset of bundle.assets) {
      if (!requiredAssetIds.has(asset.id)) continue;
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
    for (const panel of panels) {
      const layers = bundle.panelLayers
        .filter((layer) => layer.panelId === panel.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const separated = layers.filter(
        (layer) => layer.type !== "flattened_legacy",
      );
      const legacy = layers.find((layer) => layer.type === "flattened_legacy");
      if (!separated.length) {
        const currentAsset = bundle.assets.find(
          (asset) => asset.id === panel.imageAssetId,
        );
        if (
          !layers.length &&
          panel.imageAssetId &&
          (!currentAsset || !isInternalPanelCacheAsset(currentAsset))
        )
          continue;
        if (
          panel.imageAssetId === (legacy?.assetId ?? null) &&
          panel.imageFit === (legacy?.imageFit ?? "cover") &&
          panel.imageOffsetX === (legacy?.imageOffsetX ?? 0) &&
          panel.imageOffsetY === (legacy?.imageOffsetY ?? 0) &&
          panel.imageScale === (legacy?.imageScale ?? 1) &&
          panel.imageRotation === (legacy?.imageRotation ?? 0) &&
          panel.imageOpacity === (legacy?.opacity ?? 1)
        )
          continue;
        this.db
          .prepare(
            `update panels set image_asset_id=?,image_fit=?,image_offset_x=?,
               image_offset_y=?,image_scale=?,image_rotation=?,image_opacity=?,
               updated_at=? where id=?`,
          )
          .run(
            legacy?.assetId ?? null,
            legacy?.imageFit ?? "cover",
            legacy?.imageOffsetX ?? 0,
            legacy?.imageOffsetY ?? 0,
            legacy?.imageScale ?? 1,
            legacy?.imageRotation ?? 0,
            legacy?.opacity ?? 1,
            now(),
            panel.id,
          );
        continue;
      }
      for (const layer of separated)
        if (layer.visible && layer.assetId && !renderAssets.has(layer.assetId))
          throw new Error(`レイヤー素材「${layer.name}」が見つかりません。`);
      const cacheTag = `${INTERNAL_PANEL_CACHE_TAG_PREFIX}${panel.id}`;
      const currentAsset = bundle.assets.find(
        (asset) => asset.id === panel.imageAssetId,
      );
      const cacheAsset =
        (currentAsset && isInternalPanelCacheAsset(currentAsset)
          ? currentAsset
          : undefined) ??
        bundle.assets.find((asset) => asset.libraryTags.includes(cacheTag));
      const cacheSignature = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            width: panel.width,
            height: panel.height,
            shape: panel.shape,
            slant: panel.slant,
            layers: separated.map((layer) => ({
              ...layer,
              createdAt: undefined,
              updatedAt: undefined,
              assetSha256: layer.assetId
                ? bundle.assets.find((asset) => asset.id === layer.assetId)
                    ?.sha256
                : null,
            })),
          }),
        )
        .digest("hex");
      if (cacheAsset) {
        const cacheRow = this.db
          .prepare(
            "select metadata_json as metadataJson from assets where id=? and project_id=?",
          )
          .get(cacheAsset.id, projectId) as
          { metadataJson: string } | undefined;
        let metadata: { cacheSignature?: string } = {};
        try {
          metadata = JSON.parse(cacheRow?.metadataJson ?? "{}");
        } catch {
          metadata = {};
        }
        const cacheFile = this.safeProjectPath(
          bundle.project.storagePath,
          cacheAsset.relativePath,
        );
        if (
          metadata.cacheSignature === cacheSignature &&
          fs.existsSync(cacheFile)
        ) {
          if (
            cacheAsset.libraryTags.length === 1 &&
            cacheAsset.libraryTags[0] === cacheTag &&
            panel.imageAssetId === cacheAsset.id &&
            panel.imageFit === "cover" &&
            panel.imageOffsetX === 0 &&
            panel.imageOffsetY === 0 &&
            panel.imageScale === 1 &&
            panel.imageRotation === 0 &&
            panel.imageOpacity === 1
          )
            continue;
          const stamp = now();
          this.db.transaction(() => {
            this.db
              .prepare(
                `update assets set library_tags_json=?,metadata_json=?,
                   library_updated_at=? where id=? and project_id=?`,
              )
              .run(
                JSON.stringify([cacheTag]),
                JSON.stringify({
                  internal: "panel-layer-cache",
                  panelId: panel.id,
                  cacheSignature,
                }),
                stamp,
                cacheAsset.id,
                projectId,
              );
            this.setPanelCacheReference(panel.id, cacheAsset.id, stamp);
          })();
          continue;
        }
      }
      const bytes = await renderPanelLayerCachePng({
        panel,
        panelLayers: layers,
        assets: renderAssets,
        cacheKey: `${projectId}:${panel.id}`,
      });
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      const width = Math.max(1, Math.round(panel.width));
      const height = Math.max(1, Math.round(panel.height));
      const stamp = now();
      if (cacheAsset) {
        const file = this.safeProjectPath(
          bundle.project.storagePath,
          cacheAsset.relativePath,
        );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const previous = fs.existsSync(file) ? fs.readFileSync(file) : null;
        fs.writeFileSync(file, bytes);
        try {
          this.db.transaction(() => {
            this.db
              .prepare(
                `update assets set file_name=?,mime_type='image/png',width=?,
                   height=?,byte_size=?,sha256=?,library_category='other',
                   library_tags_json=?,library_favorite=0,library_updated_at=?,
                   metadata_json=?
                 where id=? and project_id=?`,
              )
              .run(
                `.mangai-panel-cache-${panel.id}.png`,
                width,
                height,
                bytes.length,
                sha256,
                JSON.stringify([cacheTag]),
                stamp,
                JSON.stringify({
                  internal: "panel-layer-cache",
                  panelId: panel.id,
                  cacheSignature,
                }),
                cacheAsset.id,
                projectId,
              );
            this.setPanelCacheReference(panel.id, cacheAsset.id, stamp);
          })();
        } catch (error) {
          if (previous) fs.writeFileSync(file, previous);
          else fs.rmSync(file, { force: true });
          throw error;
        }
      } else {
        const assetId = uid();
        const relativePath = path.join(
          "assets",
          `.mangai-panel-cache-${panel.id}-${assetId}.png`,
        );
        const file = this.safeProjectPath(
          bundle.project.storagePath,
          relativePath,
        );
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes, { flag: "wx" });
        try {
          this.db.transaction(() => {
            this.db
              .prepare(
                `insert into assets(
                   id,project_id,file_name,relative_path,mime_type,width,height,
                   byte_size,sha256,created_at,generation_job_id,metadata_json,
                   library_category,library_tags_json,library_favorite,
                   library_updated_at
                 ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              )
              .run(
                assetId,
                projectId,
                `.mangai-panel-cache-${panel.id}.png`,
                relativePath,
                "image/png",
                width,
                height,
                bytes.length,
                sha256,
                stamp,
                null,
                JSON.stringify({
                  internal: "panel-layer-cache",
                  panelId: panel.id,
                  cacheSignature,
                }),
                "other",
                JSON.stringify([cacheTag]),
                0,
                stamp,
              );
            this.setPanelCacheReference(panel.id, assetId, stamp);
          })();
        } catch (error) {
          fs.rmSync(file, { force: true });
          throw error;
        }
      }
    }
    return this.bundle(projectId);
  }
  private setPanelCacheReference(
    panelId: string,
    assetId: string,
    stamp: string,
  ) {
    this.db
      .prepare(
        `update panels set image_asset_id=?,image_fit='cover',image_offset_x=0,
           image_offset_y=0,image_scale=1,image_rotation=0,image_opacity=1,
           updated_at=? where id=?`,
      )
      .run(assetId, stamp, panelId);
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
      for (const item of input.panels)
        this.syncLegacyPanelLayer({
          ...item,
          createdAt: "",
          updatedAt: "",
        });
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
  projectIdForAsset(assetId: string) {
    const row = this.db
      .prepare("select project_id from assets where id=?")
      .get(assetId) as { project_id: string } | undefined;
    if (!row) throw new Error("素材が見つかりません。");
    return row.project_id;
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
  addEpisodeTemplate(episodeId: string, templateId: EpisodeTemplateId) {
    const projectId = this.projectIdForEpisode(episodeId);
    const project = this.bundle(projectId).project;
    const template = getEpisodeTemplate(templateId);
    const startIndex = (
      this.db
        .prepare(
          "select coalesce(max(order_index),-1)+1 n from pages where episode_id=?",
        )
        .get(episodeId) as { n: number }
    ).n;
    this.db.transaction(() => {
      template.pages.forEach((pageTemplateId, pageOffset) => {
        const pageId = uid();
        const orderIndex = startIndex + pageOffset;
        this.db
          .prepare("insert into pages values(?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .run(
            pageId,
            episodeId,
            orderIndex + 1,
            orderIndex,
            project.width,
            project.height,
            "#ffffff",
            null,
            "",
            "",
            "",
            now(),
            now(),
          );
        applyPageTemplate(pageTemplateId, project).forEach((rect, index) =>
          this.upsertPanelRow({
            id: uid(),
            pageId,
            name: `コマ${index + 1}`,
            ...rect,
            rotation: 0,
            zIndex: index,
            visible: true,
            locked: false,
            borderColor: "#000000",
            borderWidth: 4,
            fillColor: "#ffffff",
            shape: "rectangle",
            slant: 0.12,
            imageAssetId: null,
            imageFit: "cover",
            imageOffsetX: 0,
            imageOffsetY: 0,
            imageScale: 1,
            imageRotation: 0,
            imageOpacity: 1,
            createdAt: "",
            updatedAt: "",
          }),
        );
      });
    })();
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
    for (const source of files) {
      const candidate = this.assetFiles.inspectImport(source);
      if (!candidate || this.assets.hasSha256(projectId, candidate.sha256))
        continue;
      const assetId = uid();
      const copied = this.assetFiles.copyIntoProject(
        project.storagePath,
        source,
        assetId,
        candidate.extension,
      );
      const stamp = now();
      try {
        this.db.transaction(() => {
          this.assets.insert({
            id: assetId,
            projectId,
            fileName: candidate.fileName,
            relativePath: copied.relativePath,
            mimeType: candidate.mimeType,
            width: candidate.width,
            height: candidate.height,
            byteSize: candidate.byteSize,
            sha256: candidate.sha256,
            createdAt: stamp,
          });
          this.assets.setCoverWhenMissing(projectId, assetId, stamp);
        })();
      } catch (error) {
        this.assetFiles.removeCopiedFile(copied.destination);
        throw error;
      }
    }
    return this.bundle(projectId);
  }
  saveAssetLibraryMetadata(input: AssetLibraryMetadataInput) {
    input = assetLibraryMetadataInputSchema.parse(input);
    const asset = this.assets.findLibraryMetadata(input.assetId);
    if (!asset) throw new Error("素材が見つかりません。");
    if (
      isInternalPanelCacheAsset({
        libraryTags: JSON.parse(asset.libraryTagsJson ?? "[]"),
      })
    )
      throw new Error("内部互換キャッシュは編集できません。");
    this.assets.updateLibraryMetadata({
      assetId: input.assetId,
      category: input.category,
      tagsJson: JSON.stringify(input.tags),
      favorite: input.favorite,
      updatedAt: now(),
    });
    return this.bundle(asset.projectId);
  }
  deleteAsset(id: string) {
    const asset = this.assets.findStoredAsset(id);
    if (!asset) throw new Error("素材が見つかりません。");
    if (
      isInternalPanelCacheAsset({
        libraryTags: JSON.parse(asset.libraryTagsJson ?? "[]"),
      })
    )
      throw new Error("内部互換キャッシュは削除できません。");
    const moved = this.assetFiles.moveToHistoryTrash(asset.storagePath, asset);
    try {
      this.assets.delete(id, now());
    } catch (error) {
      moved.rollback();
      throw error;
    }
    return this.bundle(asset.projectId);
  }
  assetData(relativePath: string) {
    const asset = this.assets.findData(relativePath);
    if (!asset) throw new Error("素材が見つかりません。");
    return this.assetFiles.readDataUrl(
      asset.storagePath,
      asset.relativePath,
      asset.mimeType,
    );
  }
  projectCover(id: string) {
    const row = this.assets.findCoverRelativePath(id);
    return row?.relativePath ? this.assetData(row.relativePath) : null;
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
    const assetMetadata = new Map(
      bundle.assets.map((asset) => [asset.id, asset]),
    );
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
        const panels = bundle.panels.filter((item) => item.pageId === page.id);
        const panelIds = new Set(panels.map((panel) => panel.id));
        const panelLayers = bundle.panelLayers.filter((layer) =>
          panelIds.has(layer.panelId),
        );
        const assetIds = new Set(
          [
            page.imageAssetId,
            ...panels.map((panel) => panel.imageAssetId),
            ...panelLayers.map((layer) => layer.assetId),
          ].filter((assetId): assetId is string => Boolean(assetId)),
        );
        const renderAssets = new Map<string, RenderAsset>();
        for (const assetId of assetIds) {
          const asset = assetMetadata.get(assetId);
          if (!asset) continue;
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
        images.push({
          fileName: `${String(index + 1).padStart(3, "0")}.png`,
          bytes: await renderPagePng({
            page,
            panels,
            panelLayers,
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
      "MANGAI販売パッケージ.zip",
    ];
    const pdfBytes = await createPagesPdf(images, {
      dpi: bundle.project.dpi,
    });
    const imagesZipBytes = await createImagesZip(images);
    const projectInfoBytes = createProjectManifest({
      sourceProjectId: bundle.project.id,
      title: bundle.project.title,
      subtitle: bundle.project.subtitle,
      description: bundle.project.description,
      genre: bundle.project.genre,
      ageRating: bundle.project.ageRating,
      contentClass: bundle.project.contentClass,
      createdBySurface: "desktop",
      policyVersion: CONTENT_POLICY_VERSION,
      readingDirection: bundle.project.readingDirection,
      width: bundle.project.width,
      height: bundle.project.height,
      dpi: bundle.project.dpi,
      episodeCount: bundle.episodes.length,
      pageCount: images.length,
      exportedAt: now(),
    });
    fs.writeFileSync(path.join(outputDir, files[0]), pdfBytes);
    fs.writeFileSync(path.join(outputDir, files[1]), imagesZipBytes);
    fs.writeFileSync(
      path.join(outputDir, files[2]),
      createProjectManifest({ ...bundle, exportedAt: now() }),
    );
    fs.writeFileSync(path.join(outputDir, files[3]), text.description, "utf8");
    fs.writeFileSync(path.join(outputDir, files[4]), text.snsPost, "utf8");
    const salesFiles: Array<{
      role: SalesPackageFileRole;
      path: string;
      mimeType: string;
      bytes: Uint8Array;
    }> = [
      {
        role: "product_pdf",
        path: "products/main.pdf",
        mimeType: "application/pdf",
        bytes: pdfBytes,
      },
      {
        role: "page_images_zip",
        path: "products/pages.zip",
        mimeType: "application/zip",
        bytes: imagesZipBytes,
      },
      {
        role: "project_info",
        path: "metadata/project.json",
        mimeType: "application/json",
        bytes: projectInfoBytes,
      },
      {
        role: "description",
        path: "metadata/description.txt",
        mimeType: "text/plain; charset=utf-8",
        bytes: Buffer.from(text.description, "utf8"),
      },
      {
        role: "social_post",
        path: "metadata/social-post.txt",
        mimeType: "text/plain; charset=utf-8",
        bytes: Buffer.from(text.snsPost, "utf8"),
      },
      ...images.slice(0, 3).map((image, index) => ({
        role: "sample" as const,
        path: `samples/${String(index + 1).padStart(3, "0")}.png`,
        mimeType: "image/png",
        bytes: image.bytes,
      })),
    ];
    const coverAsset = bundle.project.coverAssetId
      ? assetMetadata.get(bundle.project.coverAssetId)
      : undefined;
    const coverPath = coverAsset
      ? this.safeProjectPath(
          bundle.project.storagePath,
          coverAsset.relativePath,
        )
      : undefined;
    if (coverAsset && coverPath && fs.existsSync(coverPath)) {
      const extension =
        coverAsset.mimeType === "image/jpeg"
          ? "jpg"
          : coverAsset.mimeType === "image/webp"
            ? "webp"
            : "png";
      salesFiles.push({
        role: "cover",
        path: `cover/cover.${extension}`,
        mimeType: coverAsset.mimeType,
        bytes: fs.readFileSync(coverPath),
      });
    }
    const createdAt = now();
    const salesManifest: SalesPackageManifest = {
      format: SALES_PACKAGE_FORMAT,
      version: SALES_PACKAGE_VERSION,
      createdAt,
      createdBySurface: "desktop",
      policyVersion: CONTENT_POLICY_VERSION,
      work: {
        sourceProjectId: bundle.project.id,
        title: bundle.project.title,
        subtitle: bundle.project.subtitle,
        description: bundle.project.description,
        genre: bundle.project.genre,
        ageRating: bundle.project.ageRating,
        contentClass: bundle.project.contentClass,
        readingDirection: bundle.project.readingDirection,
        width: bundle.project.width,
        height: bundle.project.height,
        dpi: bundle.project.dpi,
        episodeCount: bundle.episodes.length,
        pageCount: images.length,
      },
      files: salesFiles.map((file) => ({
        role: file.role,
        path: file.path,
        mimeType: file.mimeType,
        byteSize: file.bytes.byteLength,
        sha256: crypto.createHash("sha256").update(file.bytes).digest("hex"),
      })),
    };
    fs.writeFileSync(
      path.join(outputDir, files[5]),
      await createSalesPackageZip(
        salesManifest,
        salesFiles.map(({ path: filePath, bytes }) => ({
          path: filePath,
          bytes,
        })),
      ),
    );
    if (bundle.project.contentClass === "general") {
      const cloudImportFile = "Cloud移行Project.json";
      const cloudImportManifest = cloudProjectImportSchema.parse({
        format: "mangai.cloud-project",
        version: 1,
        policyVersion: CONTENT_POLICY_VERSION,
        createdBySurface: "desktop",
        project: {
          sourceProjectId: bundle.project.id,
          title: bundle.project.title,
          description: bundle.project.description,
          contentClass: bundle.project.contentClass,
          ageRating: bundle.project.ageRating,
          readingDirection: bundle.project.readingDirection,
          width: bundle.project.width,
          height: bundle.project.height,
          dpi: bundle.project.dpi,
        },
        episodes: bundle.episodes.map((episode) => ({
          id: episode.id,
          title: episode.title,
          orderIndex: episode.orderIndex,
        })),
        pages: bundle.pages.map((page) => ({
          id: page.id,
          episodeId: page.episodeId,
          pageNumber: page.pageNumber,
          orderIndex: page.orderIndex,
          width: page.width,
          height: page.height,
          backgroundColor: page.backgroundColor,
        })),
        assets: bundle.assets
          .filter((asset) => !isInternalPanelCacheAsset(asset))
          .map((asset) => ({
            id: asset.id,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            byteSize: asset.byteSize,
            width: asset.width,
            height: asset.height,
            sha256: asset.sha256,
          })),
        snapshots: bundle.pages.map((page) => ({
          pageId: page.id,
          canvas: {
            panels: bundle.panels.filter((item) => item.pageId === page.id),
            panelLayers: bundle.panelLayers.filter((layer) =>
              bundle.panels.some(
                (panel) =>
                  panel.id === layer.panelId && panel.pageId === page.id,
              ),
            ),
            balloons: bundle.balloons.filter((item) => item.pageId === page.id),
            textObjects: bundle.textObjects.filter(
              (item) => item.pageId === page.id,
            ),
          },
        })),
      });
      fs.writeFileSync(
        path.join(outputDir, cloudImportFile),
        JSON.stringify(cloudImportManifest, null, 2),
        "utf8",
      );
      files.push(cloudImportFile);
    }
    const warnings = [
      ...(images.length === 0 ? ["画像がないため空のPDFを作成しました。"] : []),
      ...(!coverAsset
        ? ["表紙が未設定のため販売パッケージに表紙を含めませんでした。"]
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
    options.onProgress?.({
      current: total,
      total,
      percent: 100,
      status: "complete",
    });
    return { outputDir, files, warnings };
  }
  listExportHistory(projectId: string, limit = 10) {
    return (
      this.db
        .prepare(
          "select id,export_path as outputDir,files_json as filesJson,warnings_json as warningsJson,created_at as createdAt from export_history where project_id=? order by created_at desc limit ?",
        )
        .all(projectId, Math.max(1, Math.min(50, limit))) as any[]
    ).map((row) => ({
      id: row.id,
      outputDir: row.outputDir,
      files: JSON.parse(row.filesJson) as string[],
      warnings: JSON.parse(row.warningsJson) as string[],
      createdAt: row.createdAt,
    }));
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
        allowedOrigins: [],
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
        allowedOrigins: [],
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
        allowedOrigins: [],
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
    const previous = this.getProviderSettings().find(
      (value) => value.providerId === settings.providerId,
    );
    const changedFields = previous
      ? (Object.keys(settings) as Array<keyof ProviderSettings>).filter(
          (key) =>
            JSON.stringify(previous[key]) !== JSON.stringify(settings[key]),
        )
      : (Object.keys(settings) as Array<keyof ProviderSettings>);
    const stamp = now();
    this.db.transaction(() => {
      this.db
        .prepare(
          "insert into ai_provider_settings values(?,?,?,?) on conflict(provider_id) do update set enabled=excluded.enabled,config_json=excluded.config_json,updated_at=excluded.updated_at",
        )
        .run(
          settings.providerId,
          settings.enabled ? 1 : 0,
          JSON.stringify(settings),
          stamp,
        );
      if (changedFields.length)
        this.db
          .prepare("insert into ai_settings_history values(?,?,?,?,?)")
          .run(
            uid(),
            settings.providerId,
            JSON.stringify(changedFields),
            JSON.stringify({
              enabled: settings.enabled,
              endpointKind: /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(
                new URL(settings.baseUrl).hostname,
              )
                ? "local"
                : "remote",
              modelSelected: Boolean(settings.modelId),
            }),
            stamp,
          );
    })();
    return this.getProviderSettings();
  }
  listAISettingsHistory(limit = 20) {
    return (
      this.db
        .prepare(
          "select id,provider_id as providerId,changed_fields_json as changedFieldsJson,summary_json as summaryJson,created_at as createdAt from ai_settings_history order by created_at desc limit ?",
        )
        .all(Math.max(1, Math.min(100, limit))) as any[]
    ).map((row) => ({
      id: row.id,
      providerId: row.providerId,
      changedFields: JSON.parse(row.changedFieldsJson) as string[],
      summary: JSON.parse(row.summaryJson) as {
        enabled: boolean;
        endpointKind: "local" | "remote";
        modelSelected: boolean;
      },
      createdAt: row.createdAt,
    }));
  }
  saveAIModels(providerId: string, models: ImageGenerationModelMetadata[]) {
    const stamp = now();
    this.db.transaction(() => {
      this.db
        .prepare("delete from ai_models where provider_id=?")
        .run(providerId);
      const insert = this.db.prepare(
        "insert into ai_models values(?,?,?,?,?,?)",
      );
      for (const model of models) {
        const { id, name, ...metadata } = model;
        insert.run(
          uid(),
          providerId,
          id,
          name,
          JSON.stringify(metadata),
          stamp,
        );
      }
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
        ...metadata,
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
  externalCostSummary(
    projectId: string,
    providerId: string,
    billingMonth = new Date().toISOString().slice(0, 7),
  ) {
    if (!/^\d{4}-\d{2}$/.test(billingMonth))
      throw new Error("費用集計月が正しくありません。");
    const row = this.db
      .prepare(
        `select
           coalesce(sum(case when status='settled' then actual_amount_usd else 0 end),0) as actualUsd,
           coalesce(sum(case when status='reserved' then reserved_amount_usd else 0 end),0) as reservedUsd
         from external_cost_reservations
         where project_id=? and provider_id=? and billing_month=?`,
      )
      .get(projectId, providerId, billingMonth) as {
      actualUsd: number;
      reservedUsd: number;
    };
    return {
      billingMonth,
      actualUsd: row.actualUsd,
      reservedUsd: row.reservedUsd,
      totalUsd: row.actualUsd + row.reservedUsd,
    };
  }
  reserveExternalCost(input: {
    projectId: string;
    providerId: string;
    approvalToken: string;
    amountUsd: number;
    monthlyLimitUsd: number | null;
    createdAt?: string;
  }) {
    if (
      !input.approvalToken ||
      input.approvalToken.length > 500 ||
      !Number.isFinite(input.amountUsd) ||
      input.amountUsd < 0 ||
      input.amountUsd > 1_000_000
    )
      throw new Error("外部送信の費用予約が正しくありません。");
    if (
      input.monthlyLimitUsd === null ||
      !Number.isFinite(input.monthlyLimitUsd) ||
      input.monthlyLimitUsd < 0
    )
      throw new Error("Project月間費用上限が設定されていません。");
    const monthlyLimitUsd = input.monthlyLimitUsd;
    const requestedStamp = input.createdAt ?? now();
    const parsedStamp = new Date(requestedStamp);
    if (!Number.isFinite(parsedStamp.getTime()))
      throw new Error("外部送信の費用予約時刻が正しくありません。");
    const stamp = parsedStamp.toISOString();
    const billingMonth = stamp.slice(0, 7);
    const tokenSha256 = crypto
      .createHash("sha256")
      .update(input.approvalToken, "utf8")
      .digest("hex");
    return this.db.transaction(() => {
      const existing = this.db
        .prepare(
          "select 1 from external_cost_reservations where approval_token_sha256=?",
        )
        .get(tokenSha256);
      if (existing)
        throw new Error("外部送信の費用予約はすでに使用されています。");
      const summary = this.externalCostSummary(
        input.projectId,
        input.providerId,
        billingMonth,
      );
      if (summary.totalUsd + input.amountUsd > monthlyLimitUsd + 1e-9)
        throw new Error("Project月間費用上限を超えるため実行できません。");
      const id = uid();
      this.db
        .prepare(
          `insert into external_cost_reservations(
             id,project_id,provider_id,approval_token_sha256,billing_month,
             reserved_amount_usd,status,created_at,updated_at
           ) values(?,?,?,?,?,?,'reserved',?,?)`,
        )
        .run(
          id,
          input.projectId,
          input.providerId,
          tokenSha256,
          billingMonth,
          input.amountUsd,
          stamp,
          stamp,
        );
      return {
        id,
        ...this.externalCostSummary(
          input.projectId,
          input.providerId,
          billingMonth,
        ),
      };
    })();
  }
  settleExternalCost(input: {
    approvalToken: string;
    actualAmountUsd: number;
    jobId?: string;
    updatedAt?: string;
  }) {
    if (
      !input.approvalToken ||
      input.approvalToken.length > 500 ||
      !Number.isFinite(input.actualAmountUsd) ||
      input.actualAmountUsd < 0 ||
      input.actualAmountUsd > 1_000_000
    )
      throw new Error("外部送信の実費が正しくありません。");
    const tokenSha256 = crypto
      .createHash("sha256")
      .update(input.approvalToken, "utf8")
      .digest("hex");
    const result = this.db
      .prepare(
        `update external_cost_reservations
         set status='settled',actual_amount_usd=?,job_id=?,updated_at=?
         where approval_token_sha256=? and status='reserved'`,
      )
      .run(
        input.actualAmountUsd,
        input.jobId ?? null,
        input.updatedAt ?? now(),
        tokenSha256,
      );
    if (!result.changes)
      throw new Error("外部送信の費用予約を確定できませんでした。");
    return true;
  }
  releaseExternalCostReservation(approvalToken: string) {
    if (!approvalToken || approvalToken.length > 500) return false;
    const tokenSha256 = crypto
      .createHash("sha256")
      .update(approvalToken, "utf8")
      .digest("hex");
    return Boolean(
      this.db
        .prepare(
          `update external_cost_reservations set status='released',updated_at=?
           where approval_token_sha256=? and status='reserved'`,
        )
        .run(now(), tokenSha256).changes,
    );
  }
  releaseExternalCostReservationForJob(jobId: string) {
    return Boolean(
      this.db
        .prepare(
          `update external_cost_reservations set status='released',updated_at=?
           where job_id=? and status='reserved'`,
        )
        .run(now(), jobId).changes,
    );
  }
  externalCostReservationForJob(jobId: string) {
    return this.db
      .prepare(
        `select reserved_amount_usd as reservedAmountUsd,billing_month as billingMonth
         from external_cost_reservations where job_id=? and status='reserved'`,
      )
      .get(jobId) as
      { reservedAmountUsd: number; billingMonth: string } | undefined;
  }
  settleExternalCostForJob(input: {
    jobId: string;
    actualAmountUsd: number;
    updatedAt?: string;
  }) {
    if (
      !input.jobId ||
      !Number.isFinite(input.actualAmountUsd) ||
      input.actualAmountUsd < 0 ||
      input.actualAmountUsd > 1_000_000
    )
      throw new Error("外部送信の実費が正しくありません。");
    const result = this.db
      .prepare(
        `update external_cost_reservations
         set status='settled',actual_amount_usd=?,updated_at=?
         where job_id=? and status='reserved'`,
      )
      .run(input.actualAmountUsd, input.updatedAt ?? now(), input.jobId);
    if (!result.changes)
      throw new Error("外部送信Jobの費用予約を確定できませんでした。");
    return true;
  }
  createGenerationJob(
    input: {
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
    },
    options: {
      maxAttempts?: number;
      activeProviderLimit?: number;
    } = {},
  ) {
    const isDezgoImage =
      input.providerId === "dezgo" && input.generationType === "image";
    const maxAttempts =
      options.maxAttempts ??
      (isDezgoImage ? DEZGO_QUEUE_POLICY.maxAttempts : 3);
    const activeProviderLimit =
      options.activeProviderLimit ??
      (isDezgoImage ? DEZGO_QUEUE_POLICY.maxActiveJobs : undefined);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
      throw new Error("生成ジョブの最大試行回数が正しくありません。");
    if (
      activeProviderLimit !== undefined &&
      (!Number.isInteger(activeProviderLimit) ||
        activeProviderLimit < 1 ||
        activeProviderLimit > 1000)
    )
      throw new Error("生成Queue上限が正しくありません。");
    const id = uid();
    return this.db.transaction(() => {
      if (activeProviderLimit !== undefined) {
        const active = this.countActiveGenerationJobs(input.providerId);
        if (active >= activeProviderLimit)
          throw new Error(
            `このProviderの生成Queueは${activeProviderLimit}件までです。完了またはキャンセル後に再試行してください。`,
          );
      }
      const queueOrder = (
        this.db
          .prepare(
            "select coalesce(max(queue_order),0)+1 as value from generation_jobs",
          )
          .get() as { value: number }
      ).value;
      this.db
        .prepare(
          "insert into generation_jobs(id,project_id,episode_id,page_id,provider_type,provider_id,model_id,generation_type,status,prompt,negative_prompt,input_json,created_at,queue_order,max_attempts) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
          queueOrder,
          maxAttempts,
        );
      return id;
    })();
  }
  createApprovedExternalGenerationJob(input: {
    approvalToken: string;
    projectId: string;
    pageId?: string;
    providerId: string;
    modelId: string;
    prompt: string;
    inputJson: unknown;
    routeAudit: {
      draft: GenerationJobDraftInput;
      context: RoutingContextInput;
      decision: RouteDecision;
      promptSha256: string;
    };
  }) {
    if (!input.approvalToken || input.approvalToken.length > 500)
      throw new Error("外部送信の承認を確認できません。");
    const tokenSha256 = crypto
      .createHash("sha256")
      .update(input.approvalToken, "utf8")
      .digest("hex");
    return this.db.transaction(() => {
      const reservation = this.db
        .prepare(
          `select project_id as projectId,provider_id as providerId
           from external_cost_reservations
           where approval_token_sha256=? and status='reserved' and job_id is null`,
        )
        .get(tokenSha256) as
        { projectId: string; providerId: string } | undefined;
      if (
        !reservation ||
        reservation.projectId !== input.projectId ||
        reservation.providerId !== input.providerId
      )
        throw new Error("外部送信の費用予約を確認できません。");
      const jobId = this.createGenerationJob({
        projectId: input.projectId,
        pageId: input.pageId,
        providerType: "cloud",
        providerId: input.providerId,
        modelId: input.modelId,
        generationType: "image",
        prompt: input.prompt,
        inputJson: input.inputJson,
      });
      const bound = this.db
        .prepare(
          `update external_cost_reservations set job_id=?,updated_at=?
           where approval_token_sha256=? and status='reserved' and job_id is null`,
        )
        .run(jobId, now(), tokenSha256);
      if (!bound.changes)
        throw new Error("外部送信Queueと費用予約を関連付けできませんでした。");
      this.createGenerationRouteDecision({
        jobId,
        projectId: input.projectId,
        ...input.routeAudit,
      });
      return jobId;
    })();
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
      "select id,project_id as projectId,episode_id as episodeId,page_id as pageId,provider_type as providerType,provider_id as providerId,model_id as modelId,generation_type as generationType,status,priority,queue_order as queueOrder,attempt_count as attemptCount,max_attempts as maxAttempts,next_attempt_at as nextAttemptAt,progress,prompt,negative_prompt as negativePrompt,input_json as inputJson,output_json as outputJson,provider_job_id as providerJobId,error_code as errorCode,error_message as errorMessage,created_at as createdAt,started_at as startedAt,completed_at as completedAt from generation_jobs";
    return projectId
      ? this.db
          .prepare(`${sql} where project_id=? order by created_at desc`)
          .all(projectId)
      : this.db.prepare(`${sql} order by created_at desc`).all();
  }
  createPhase5HardwareEvidence(
    projectId: string,
    runtime: RuntimeProfileState,
  ) {
    const project = this.bundle(projectId).project;
    if (project.contentClass !== "adult")
      throw new Error("Phase 5実機証跡は成人向けProjectで作成してください。");
    if (
      !["vram_8gb", "vram_12gb", "vram_16gb"].includes(runtime.effectiveProfile)
    )
      throw new Error("8GB／12GB／16GBの実機Profileを選択してください。");
    const rows = this.db
      .prepare(
        `select j.input_json as inputJson,j.completed_at as completedAt,
                a.sha256 as outputSha256
         from generation_jobs j
         join generation_outputs o on o.job_id=j.id
         join assets a on a.id=o.asset_id
         where j.project_id=? and j.provider_id='comfyui'
           and j.status='completed' and j.completed_at is not null
         order by j.completed_at desc,o.created_at desc`,
      )
      .all(projectId) as Array<{
      inputJson: string;
      completedAt: string;
      outputSha256: string;
    }>;
    const required = [
      "text_to_image",
      "image_to_image",
      "controlnet",
      "inpainting",
    ] as const;
    const byOperation = new Map<
      (typeof required)[number],
      {
        operation: (typeof required)[number];
        result: "passed";
        outputSha256: string;
        completedAt: string;
      }
    >();
    for (const row of rows) {
      try {
        const input = JSON.parse(row.inputJson) as Record<string, unknown>;
        if (input.jobType !== "adult_character_render") continue;
        const operation =
          input.operation === undefined ? "text_to_image" : input.operation;
        if (
          !required.includes(operation as (typeof required)[number]) ||
          byOperation.has(operation as (typeof required)[number])
        )
          continue;
        byOperation.set(operation as (typeof required)[number], {
          operation: operation as (typeof required)[number],
          result: "passed",
          outputSha256: row.outputSha256,
          completedAt: row.completedAt,
        });
      } catch {
        // Invalid legacy input cannot be used as acceptance evidence.
      }
    }
    const missing = required.filter((operation) => !byOperation.has(operation));
    if (missing.length)
      throw new Error(
        `実機証跡に必要な生成が不足しています: ${missing.join(", ")}`,
      );
    const exportRow = this.db
      .prepare(
        `select export_path as outputDir,files_json as filesJson,
                created_at as createdAt
         from export_history where project_id=? order by created_at desc limit 1`,
      )
      .get(projectId) as
      { outputDir: string; filesJson: string; createdAt: string } | undefined;
    if (!exportRow)
      throw new Error("実機確認後のProject書き出しがありません。");
    const exportRoot = path.resolve(this.paths.exports) + path.sep;
    const outputDir = path.resolve(exportRow.outputDir);
    if (!`${outputDir}${path.sep}`.startsWith(exportRoot))
      throw new Error("書き出し証跡の保存先を確認できません。");
    const files = JSON.parse(exportRow.filesJson) as unknown;
    if (!Array.isArray(files)) throw new Error("書き出し履歴が不正です。");
    const digest = (name: string) => {
      if (!files.includes(name))
        throw new Error(`${name}の書き出しがありません。`);
      const file = path.join(outputDir, name);
      if (!fs.existsSync(file)) throw new Error(`${name}が見つかりません。`);
      return crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex");
    };
    return phase5HardwareEvidenceSchema.parse({
      format: "mangai.phase5-hardware-evidence",
      version: 1,
      profile: runtime.effectiveProfile,
      hardware: {
        totalRamBytes: runtime.hardware.totalRamBytes,
        gpuName: runtime.hardware.gpuName,
        dedicatedVramMb: runtime.hardware.dedicatedVramMb,
      },
      checkedAt: now(),
      projectIdSha256: crypto
        .createHash("sha256")
        .update(projectId)
        .digest("hex"),
      operations: required.map((operation) => byOperation.get(operation)!),
      export: {
        pdfSha256: digest("本編PDF.pdf"),
        salesPackageSha256: digest("MANGAI販売パッケージ.zip"),
        createdAt: exportRow.createdAt,
      },
    });
  }
  getGenerationJob(id: string) {
    return this.db
      .prepare("select * from generation_jobs where id=?")
      .get(id) as Record<string, unknown> | undefined;
  }
  countActiveGenerationJobs(providerId: string) {
    return (
      this.db
        .prepare(
          `select count(*) as count from generation_jobs
           where provider_id=? and generation_type='image'
             and status in ('queued','paused','running')`,
        )
        .get(providerId) as { count: number }
    ).count;
  }
  nextQueuedImageJob(providerIds?: string[]) {
    if (providerIds && !providerIds.length) return undefined;
    const providerClause = providerIds
      ? ` and provider_id in (${providerIds.map(() => "?").join(",")})`
      : "";
    return this.db
      .prepare(
        `select id,provider_id as providerId,input_json as inputJson from generation_jobs
         where status='queued' and generation_type='image'
           and (next_attempt_at is null or next_attempt_at<=?)
           ${providerClause}
         order by priority desc,queue_order,created_at,id limit 1`,
      )
      .get(now(), ...(providerIds ?? [])) as
      { id: string; providerId: string; inputJson: string } | undefined;
  }
  nextQueuedAdultDezgoJob() {
    const rows = this.db
      .prepare(
        `select id,provider_id as providerId,input_json as inputJson
         from generation_jobs
         where status='queued' and generation_type='image'
           and provider_id='dezgo'
           and (next_attempt_at is null or next_attempt_at<=?)
         order by priority desc,queue_order,created_at,id`,
      )
      .all(now()) as Array<{
      id: string;
      providerId: "dezgo";
      inputJson: string;
    }>;
    return rows.find((row) => {
      try {
        return (
          (JSON.parse(row.inputJson) as { jobType?: unknown }).jobType ===
          "adult_character_render"
        );
      } catch {
        return false;
      }
    });
  }
  getAdultGenerationSettings(referenceTime = now()): AdultGenerationSettings {
    const referenceMs = new Date(referenceTime).getTime();
    if (!Number.isFinite(referenceMs))
      throw new Error("成人向け設定の基準日時が不正です。");
    const row = this.db
      .prepare(
        `select administrator_enabled as administratorEnabled,
                user_confirmed_18_plus as storedConfirmation,
                terms_version as termsVersion,confirmed_at as confirmedAt,
                expires_at as expiresAt,revoked_at as revokedAt,
                updated_at as updatedAt
         from adult_generation_settings where id=1`,
      )
      .get() as
      | {
          administratorEnabled: number;
          storedConfirmation: number;
          termsVersion: string | null;
          confirmedAt: string | null;
          expiresAt: string | null;
          revokedAt: string | null;
          updatedAt: string;
        }
      | undefined;
    if (!row)
      return adultGenerationSettingsSchema.parse({
        administratorEnabled: false,
        userConfirmed18Plus: false,
        consentStatus: "missing",
        termsVersion: null,
        confirmedAt: null,
        expiresAt: null,
        revokedAt: null,
        updatedAt: null,
      });
    const confirmedMs = row.confirmedAt
      ? new Date(row.confirmedAt).getTime()
      : Number.NaN;
    const expiresMs = row.expiresAt
      ? new Date(row.expiresAt).getTime()
      : Number.NaN;
    let consentStatus: AdultGenerationSettings["consentStatus"] = "missing";
    if (row.revokedAt) consentStatus = "revoked";
    else if (
      row.storedConfirmation &&
      row.termsVersion !== ADULT_GENERATION_TERMS_VERSION
    )
      consentStatus = "terms_changed";
    else if (
      row.storedConfirmation &&
      Number.isFinite(confirmedMs) &&
      Number.isFinite(expiresMs)
    )
      consentStatus =
        referenceMs >= confirmedMs && referenceMs < expiresMs
          ? "active"
          : "expired";
    return adultGenerationSettingsSchema.parse({
      administratorEnabled: Boolean(row.administratorEnabled),
      userConfirmed18Plus: consentStatus === "active",
      consentStatus,
      termsVersion: row.termsVersion,
      confirmedAt: row.confirmedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      updatedAt: row.updatedAt,
    });
  }
  getAdultProviderApproval(): AdultProviderApproval {
    const row = this.db
      .prepare(
        `select provider_id as providerId,status,
                evidence_sha256 as evidenceSha256,
                confirmed_at as confirmedAt,expires_at as expiresAt,
                revoked_at as revokedAt,updated_at as updatedAt
         from adult_provider_approvals where provider_id='dezgo'`,
      )
      .get() as AdultProviderApproval | undefined;
    return adultProviderApprovalSchema.parse(
      row ?? {
        providerId: "dezgo",
        status: "unverified",
        evidenceSha256: null,
        confirmedAt: null,
        expiresAt: null,
        revokedAt: null,
        updatedAt: null,
      },
    );
  }
  saveAdultProviderApproval(input: unknown): AdultProviderApproval {
    const approval = adultProviderApprovalInputSchema.parse(input);
    const stamp = now();
    this.db
      .prepare(
        `insert into adult_provider_approvals(
           provider_id,status,evidence_sha256,confirmed_at,expires_at,
           revoked_at,updated_at
         ) values(?,?,?,?,?,?,?)
         on conflict(provider_id) do update set status=excluded.status,
           evidence_sha256=excluded.evidence_sha256,
           confirmed_at=excluded.confirmed_at,expires_at=excluded.expires_at,
           revoked_at=excluded.revoked_at,updated_at=excluded.updated_at`,
      )
      .run(
        approval.providerId,
        approval.status,
        approval.evidenceSha256,
        approval.confirmedAt,
        approval.expiresAt,
        approval.revokedAt,
        stamp,
      );
    return this.getAdultProviderApproval();
  }
  listAdultModelApprovals(): AdultModelApproval[] {
    return (
      this.db
        .prepare(
          `select provider_id as providerId,model_id as modelId,status,
                  license_evidence_sha256 as licenseEvidenceSha256,
                  verified_at as verifiedAt,expires_at as expiresAt,
                  updated_at as updatedAt
           from adult_model_approvals where provider_id='dezgo'
           order by model_id`,
        )
        .all() as AdultModelApproval[]
    ).map((row) => adultModelApprovalSchema.parse(row));
  }
  saveAdultModelApproval(input: unknown): AdultModelApproval {
    const model = adultModelApprovalInputSchema.parse(input);
    const stamp = now();
    this.db
      .prepare(
        `insert into adult_model_approvals(
           provider_id,model_id,status,license_evidence_sha256,verified_at,
           expires_at,updated_at
         ) values(?,?,?,?,?,?,?)
         on conflict(provider_id,model_id) do update set status=excluded.status,
           license_evidence_sha256=excluded.license_evidence_sha256,
           verified_at=excluded.verified_at,expires_at=excluded.expires_at,
           updated_at=excluded.updated_at`,
      )
      .run(
        model.providerId,
        model.modelId,
        model.status,
        model.licenseEvidenceSha256,
        model.verifiedAt,
        model.expiresAt,
        stamp,
      );
    return adultModelApprovalSchema.parse({ ...model, updatedAt: stamp });
  }
  getAdultProviderPolicyState(referenceTime = now()) {
    const approval = this.getAdultProviderApproval();
    const models = this.listAdultModelApprovals();
    return {
      approval,
      models,
      eligibleModelIds: models
        .filter(
          (model) =>
            evaluateAdultProviderCapability({
              approval,
              model,
              referenceTime,
            }).allowed,
        )
        .map((model) => model.modelId),
      lastImport:
        (this.db
          .prepare(
            `select key_id as keyId,payload_sha256 as payloadSha256,
                    issued_at as issuedAt,expires_at as expiresAt,
                    imported_at as importedAt
             from adult_provider_policy_imports order by imported_at desc,id desc limit 1`,
          )
          .get() as
          | {
              keyId: string;
              payloadSha256: string;
              issuedAt: string;
              expiresAt: string;
              importedAt: string;
            }
          | undefined) ?? null,
    };
  }
  stopPendingAdultDezgoJobsDisallowedByPolicy(referenceTime = now()) {
    const approval = this.getAdultProviderApproval();
    const models = this.listAdultModelApprovals();
    const modelsById = new Map(models.map((model) => [model.modelId, model]));
    const rows = this.db
      .prepare(
        `select id,model_id as modelId,input_json as inputJson
         from generation_jobs
         where provider_id='dezgo' and generation_type='image'
           and status in ('queued','paused')`,
      )
      .all() as Array<{
      id: string;
      modelId: string | null;
      inputJson: string;
    }>;
    const blocked = rows.flatMap((row) => {
      try {
        const input = JSON.parse(row.inputJson) as { jobType?: unknown };
        if (input.jobType !== "adult_character_render") return [];
      } catch {
        return [];
      }
      const result = evaluateAdultProviderCapability({
        approval,
        model: row.modelId ? (modelsById.get(row.modelId) ?? null) : null,
        referenceTime,
      });
      return result.allowed ? [] : [{ id: row.id, reason: result.reason }];
    });
    const errors = {
      provider_unverified: [
        "ADULT_PROVIDER_UNVERIFIED",
        "Dezgoの成人向け利用承認を確認できないため、待機中の生成を停止しました。",
      ],
      provider_revoked: [
        "ADULT_PROVIDER_REVOKED",
        "Dezgoの成人向け利用承認が失効したため、待機中の生成を停止しました。",
      ],
      provider_expired: [
        "ADULT_PROVIDER_EXPIRED",
        "Dezgoの成人向け利用承認期限が切れたため、待機中の生成を停止しました。",
      ],
      model_not_allowlisted: [
        "ADULT_MODEL_NOT_ALLOWLISTED",
        "選択モデルが成人向けallowlistにないため、待機中の生成を停止しました。",
      ],
      model_revoked: [
        "ADULT_MODEL_REVOKED",
        "選択モデルの成人向け承認が失効したため、待機中の生成を停止しました。",
      ],
      model_approval_expired: [
        "ADULT_MODEL_APPROVAL_EXPIRED",
        "選択モデルの成人向け承認期限が切れたため、待機中の生成を停止しました。",
      ],
    } as const;
    this.db.transaction(() => {
      for (const item of blocked) {
        const [errorCode, errorMessage] = errors[item.reason];
        this.releaseExternalCostReservationForJob(item.id);
        this.updateGenerationJob(item.id, "failed", {
          errorCode,
          errorMessage,
        });
      }
    })();
    return blocked.map((item) => item.id);
  }
  applyAdultProviderPolicyBundle(
    input: {
      keyId: string;
      payloadSha256: string;
      payload: {
        issuedAt: string;
        expiresAt: string;
        providerApproval: unknown;
        models: unknown[];
      };
    },
    referenceTime = now(),
  ) {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(input.keyId))
      throw new Error("成人向け運用policyの署名鍵IDが不正です。");
    if (!/^[0-9a-f]{64}$/.test(input.payloadSha256))
      throw new Error("成人向け運用policyのpayload hashが不正です。");
    const issuedAt = z.string().datetime().parse(input.payload.issuedAt);
    const expiresAt = z.string().datetime().parse(input.payload.expiresAt);
    const approval = adultProviderApprovalInputSchema.parse(
      input.payload.providerApproval,
    );
    const models = input.payload.models.map((model) =>
      adultModelApprovalInputSchema.parse(model),
    );
    if (new Set(models.map((model) => model.modelId)).size !== models.length)
      throw new Error("成人向け運用policyのモデルIDが重複しています。");
    const importedAt = now();
    this.db.transaction(() => {
      this.saveAdultProviderApproval(approval);
      this.db
        .prepare("delete from adult_model_approvals where provider_id='dezgo'")
        .run();
      for (const model of models) this.saveAdultModelApproval(model);
      this.db
        .prepare(
          `insert into adult_provider_policy_imports(
             id,key_id,payload_sha256,issued_at,expires_at,imported_at
           ) values(?,?,?,?,?,?)`,
        )
        .run(
          uid(),
          input.keyId,
          input.payloadSha256,
          issuedAt,
          expiresAt,
          importedAt,
        );
      this.stopPendingAdultDezgoJobsDisallowedByPolicy(referenceTime);
    })();
    return this.getAdultProviderPolicyState(referenceTime);
  }
  setAdultGenerationAdministratorEnabled(
    enabled: boolean,
  ): AdultGenerationSettings {
    const stamp = now();
    this.db
      .prepare(
        `insert into adult_generation_settings(
           id,administrator_enabled,user_confirmed_18_plus,terms_version,
           confirmed_at,expires_at,revoked_at,updated_at
         ) values(1,?,0,null,null,null,null,?)
         on conflict(id) do update set
           administrator_enabled=excluded.administrator_enabled,
           updated_at=excluded.updated_at`,
      )
      .run(enabled ? 1 : 0, stamp);
    return this.getAdultGenerationSettings(stamp);
  }
  confirmAdultGeneration18Plus(input: unknown): AdultGenerationSettings {
    adultGenerationConsentInputSchema.parse(input);
    const confirmedAt = now();
    const expiresAt = new Date(
      new Date(confirmedAt).getTime() +
        ADULT_GENERATION_CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    this.db
      .prepare(
        `insert into adult_generation_settings(
           id,administrator_enabled,user_confirmed_18_plus,terms_version,
           confirmed_at,expires_at,revoked_at,updated_at
         ) values(1,0,1,?,?,?,null,?)
         on conflict(id) do update set
           user_confirmed_18_plus=1,terms_version=excluded.terms_version,
           confirmed_at=excluded.confirmed_at,expires_at=excluded.expires_at,
           revoked_at=null,updated_at=excluded.updated_at`,
      )
      .run(ADULT_GENERATION_TERMS_VERSION, confirmedAt, expiresAt, confirmedAt);
    return this.getAdultGenerationSettings(confirmedAt);
  }
  revokeAdultGenerationConsent(): AdultGenerationSettings {
    const revokedAt = now();
    this.db
      .prepare(
        `update adult_generation_settings
         set user_confirmed_18_plus=0,revoked_at=?,updated_at=? where id=1`,
      )
      .run(revokedAt, revokedAt);
    return this.getAdultGenerationSettings(revokedAt);
  }
  stopUnauthorizedPendingAdultGenerationJobs(referenceTime = now()) {
    const settings = this.getAdultGenerationSettings(referenceTime);
    if (settings.administratorEnabled && settings.userConfirmed18Plus)
      return [] as string[];
    const rows = this.db
      .prepare(
        `select id,input_json as inputJson from generation_jobs
         where generation_type='image' and status in ('queued','paused')`,
      )
      .all() as Array<{ id: string; inputJson: string }>;
    const adultJobIds = rows
      .filter((row) => {
        try {
          const input = JSON.parse(row.inputJson) as { jobType?: unknown };
          return input.jobType === "adult_character_render";
        } catch {
          return false;
        }
      })
      .map((row) => row.id);
    const errorCode = settings.administratorEnabled
      ? "ADULT_GENERATION_CONSENT_REQUIRED"
      : "ADULT_GENERATION_ADMIN_DISABLED";
    const errorMessage = settings.administratorEnabled
      ? "18歳以上の確認が無効または期限切れのため、成人向け生成を停止しました。"
      : "管理者設定で成人向け生成が無効なため、成人向け生成を停止しました。";
    this.db.transaction(() => {
      for (const jobId of adultJobIds) {
        this.releaseExternalCostReservationForJob(jobId);
        this.updateGenerationJob(jobId, "failed", {
          errorCode,
          errorMessage,
        });
      }
    })();
    return adultJobIds;
  }
  getGenerationQueueSettings(): GenerationQueueSettings {
    const row = this.db
      .prepare(
        "select night_mode_enabled as nightModeEnabled,start_time as startTime,end_time as endTime from generation_queue_settings where id=1",
      )
      .get() as
      | { nightModeEnabled: number; startTime: string; endTime: string }
      | undefined;
    return generationQueueSettingsSchema.parse(
      row ? { ...row, nightModeEnabled: Boolean(row.nightModeEnabled) } : {},
    );
  }
  saveGenerationQueueSettings(input: unknown): GenerationQueueSettings {
    const settings = generationQueueSettingsSchema.parse(input);
    this.db
      .prepare(
        `insert into generation_queue_settings values(1,?,?,?,?)
         on conflict(id) do update set night_mode_enabled=excluded.night_mode_enabled,
         start_time=excluded.start_time,end_time=excluded.end_time,updated_at=excluded.updated_at`,
      )
      .run(
        settings.nightModeEnabled ? 1 : 0,
        settings.startTime,
        settings.endTime,
        now(),
      );
    return settings;
  }
  nextQueuedImageDelayMs(providerIds?: string[]) {
    if (providerIds && !providerIds.length) return null;
    const providerClause = providerIds
      ? ` and provider_id in (${providerIds.map(() => "?").join(",")})`
      : "";
    const row = this.db
      .prepare(
        `select next_attempt_at as nextAttemptAt from generation_jobs
         where status='queued' and generation_type='image' and next_attempt_at is not null
         ${providerClause}
         order by next_attempt_at limit 1`,
      )
      .get(...(providerIds ?? [])) as { nextAttemptAt: string } | undefined;
    return row
      ? Math.max(0, new Date(row.nextAttemptAt).getTime() - Date.now())
      : null;
  }
  beginGenerationJobAttempt(id: string) {
    this.db
      .prepare(
        "update generation_jobs set attempt_count=attempt_count+1,next_attempt_at=null where id=? and generation_type='image'",
      )
      .run(id);
    return this.db
      .prepare(
        "select attempt_count as attemptCount,max_attempts as maxAttempts from generation_jobs where id=?",
      )
      .get(id) as { attemptCount: number; maxAttempts: number };
  }
  requeueGenerationJob(
    id: string,
    errorCode: string,
    errorMessage: string,
    delayMs: number,
  ) {
    const job = this.db
      .prepare(
        "select attempt_count as attemptCount,max_attempts as maxAttempts from generation_jobs where id=?",
      )
      .get(id) as { attemptCount: number; maxAttempts: number } | undefined;
    if (!job || job.attemptCount >= job.maxAttempts) return false;
    this.db
      .prepare(
        `update generation_jobs set status='queued',progress=0,provider_job_id=null,
         error_code=?,error_message=?,next_attempt_at=?,completed_at=null where id=?`,
      )
      .run(
        errorCode,
        errorMessage,
        new Date(Date.now() + delayMs).toISOString(),
        id,
      );
    return true;
  }
  setGenerationJobStatus(id: string, status: GenerationStatus) {
    const job = this.db
      .prepare(
        "select status,generation_type as generationType from generation_jobs where id=?",
      )
      .get(id) as { status: string; generationType: string } | undefined;
    if (!job || job.generationType !== "image") return false;
    this.updateGenerationJob(id, status, {
      progress: status === "queued" ? 0 : undefined,
    });
    if (status === "queued")
      this.db
        .prepare("update generation_jobs set next_attempt_at=null where id=?")
        .run(id);
    return true;
  }
  changeGenerationJobPriority(id: string, delta: number) {
    this.db
      .prepare(
        "update generation_jobs set priority=max(-100,min(100,priority+?)) where id=? and status in ('queued','paused') and generation_type='image'",
      )
      .run(Math.sign(delta), id);
    return this.listGenerationJobs();
  }
  createGenerationRouteDecision(input: {
    jobId: string;
    projectId: string;
    draft: GenerationJobDraftInput;
    context: RoutingContextInput;
    decision: RouteDecision;
    promptSha256: string;
  }): GenerationRouteDecisionRecord {
    const job = this.db
      .prepare("select project_id as projectId from generation_jobs where id=?")
      .get(input.jobId) as { projectId: string | null } | undefined;
    if (!job || job.projectId !== input.projectId)
      throw new Error("生成ジョブとProjectの参照が一致しません。");
    const record = generationRouteDecisionRecordSchema.parse({
      id: uid(),
      jobId: input.jobId,
      projectId: input.projectId,
      draft: generationJobDraftSchema.parse(input.draft),
      context: routingContextSchema.parse(input.context),
      decision: routeDecisionSchema.parse(input.decision),
      promptSha256: input.promptSha256,
      createdAt: now(),
    });
    if (record.draft.projectId !== record.projectId)
      throw new Error("Route判定とProjectの参照が一致しません。");
    this.db
      .prepare(
        `insert into generation_route_decisions(
           id,job_id,project_id,draft_json,context_json,decision_json,
           prompt_sha256,created_at
         ) values(?,?,?,?,?,?,?,?)`,
      )
      .run(
        record.id,
        record.jobId,
        record.projectId,
        JSON.stringify(record.draft),
        JSON.stringify(record.context),
        JSON.stringify(record.decision),
        record.promptSha256,
        record.createdAt,
      );
    return record;
  }
  listGenerationRouteDecisions(projectId: string) {
    return (
      this.db
        .prepare(
          `select id,job_id as jobId,project_id as projectId,
                  draft_json as draftJson,context_json as contextJson,
                  decision_json as decisionJson,prompt_sha256 as promptSha256,
                  created_at as createdAt
           from generation_route_decisions where project_id=?
           order by created_at desc`,
        )
        .all(projectId) as Array<{
        id: string;
        jobId: string;
        projectId: string;
        draftJson: string;
        contextJson: string;
        decisionJson: string;
        promptSha256: string;
        createdAt: string;
      }>
    ).map((row) =>
      generationRouteDecisionRecordSchema.parse({
        id: row.id,
        jobId: row.jobId,
        projectId: row.projectId,
        draft: JSON.parse(row.draftJson),
        context: JSON.parse(row.contextJson),
        decision: JSON.parse(row.decisionJson),
        promptSha256: row.promptSha256,
        createdAt: row.createdAt,
      }),
    );
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
    const created = !before.has(asset.id);
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
    return { bundle: this.bundle(projectId), assetId: asset.id, created };
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
  listCharacterProfiles(projectId: string): CharacterProfile[] {
    if (!this.db.prepare("select 1 from projects where id=?").get(projectId))
      throw new Error("Projectが見つかりません。");
    const profiles = this.db
      .prepare(
        `select id,project_id,name,description,prompt,negative_prompt,created_at,updated_at
         from character_profiles where project_id=? order by updated_at desc,name`,
      )
      .all(projectId) as Array<Record<string, any>>;
    const references = this.db.prepare(
      `select asset_id,role,order_index from character_profile_assets
       where character_profile_id=? order by order_index,created_at`,
    );
    return profiles.map((profile) => ({
      id: profile.id,
      projectId: profile.project_id,
      name: profile.name,
      description: profile.description,
      prompt: profile.prompt,
      negativePrompt: profile.negative_prompt,
      referenceAssets: (
        references.all(profile.id) as Array<Record<string, any>>
      ).map((item) => ({
        assetId: item.asset_id,
        role: item.role as CharacterReferenceRole,
        orderIndex: item.order_index,
      })),
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    }));
  }
  getCharacterProfile(projectId: string, id: string): CharacterProfile {
    const profile = this.listCharacterProfiles(projectId).find(
      (item) => item.id === id,
    );
    if (!profile) throw new Error("キャラクターProfileが見つかりません。");
    return profile;
  }
  readGenerationInputAsset(projectId: string, assetId: string) {
    const asset = this.db
      .prepare(
        `select a.file_name,a.relative_path,a.mime_type,a.byte_size,a.sha256,
                p.storage_path
         from assets a join projects p on p.id=a.project_id
         where a.id=? and a.project_id=?`,
      )
      .get(assetId, projectId) as Record<string, any> | undefined;
    if (!asset) throw new Error("Project内の入力素材が見つかりません。");
    if (!["image/png", "image/jpeg", "image/webp"].includes(asset.mime_type))
      throw new Error("入力素材の画像形式に対応していません。");
    const file = this.safeProjectPath(asset.storage_path, asset.relative_path);
    if (!fs.existsSync(file))
      throw new Error("入力素材ファイルが見つかりません。");
    this.verifyAssetFile(file, {
      byteSize: asset.byte_size,
      sha256: asset.sha256,
    });
    return {
      fileName: asset.file_name,
      bytes: new Uint8Array(fs.readFileSync(file)),
      mimeType: asset.mime_type as "image/png" | "image/jpeg" | "image/webp",
    };
  }
  getAdultReferenceImageAssessment(
    projectId: string,
    assetId: string,
  ): AdultReferenceImageAssessment | null {
    const asset = this.db
      .prepare(
        "select metadata_json as metadataJson from assets where id=? and project_id=?",
      )
      .get(assetId, projectId) as { metadataJson: string } | undefined;
    if (!asset) throw new Error("Project内の参照素材が見つかりません。");
    try {
      const metadata = JSON.parse(asset.metadataJson) as {
        adultReferenceImageAssessment?: unknown;
      };
      if (!metadata.adultReferenceImageAssessment) return null;
      return adultReferenceImageAssessmentSchema.parse(
        metadata.adultReferenceImageAssessment,
      );
    } catch {
      return null;
    }
  }
  listAdultReferenceImageAssessments(projectId: string) {
    if (!this.db.prepare("select 1 from projects where id=?").get(projectId))
      throw new Error("Projectが見つかりません。");
    const assets = this.db
      .prepare(
        "select id,metadata_json as metadataJson from assets where project_id=?",
      )
      .all(projectId) as Array<{ id: string; metadataJson: string }>;
    return assets.flatMap((asset) => {
      try {
        const metadata = JSON.parse(asset.metadataJson) as {
          adultReferenceImageAssessment?: unknown;
        };
        if (!metadata.adultReferenceImageAssessment) return [];
        return [
          {
            assetId: asset.id,
            assessment: adultReferenceImageAssessmentSchema.parse(
              metadata.adultReferenceImageAssessment,
            ),
          },
        ];
      } catch {
        return [];
      }
    });
  }
  saveAdultReferenceImageAssessment(input: unknown) {
    const value = adultReferenceImageAssessmentInputSchema.parse(input);
    const asset = this.db
      .prepare(
        "select metadata_json as metadataJson from assets where id=? and project_id=?",
      )
      .get(value.assetId, value.projectId) as
      { metadataJson: string } | undefined;
    if (!asset) throw new Error("Project内の参照素材が見つかりません。");
    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(asset.metadataJson);
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
        metadata = {};
    } catch {
      metadata = {};
    }
    metadata.adultReferenceImageAssessment = value.assessment;
    this.db
      .prepare("update assets set metadata_json=? where id=? and project_id=?")
      .run(JSON.stringify(metadata), value.assetId, value.projectId);
    return this.listAdultReferenceImageAssessments(value.projectId);
  }
  saveCharacterProfile(input: unknown): CharacterProfile[] {
    const value = characterProfileInputSchema.parse(input),
      stamp = now(),
      id = value.id ?? uid();
    if (
      !this.db.prepare("select 1 from projects where id=?").get(value.projectId)
    )
      throw new Error("Projectが見つかりません。");
    const existing = value.id
      ? (this.db
          .prepare("select project_id from character_profiles where id=?")
          .get(value.id) as { project_id: string } | undefined)
      : undefined;
    if (value.id && !existing)
      throw new Error("キャラクターProfileが見つかりません。");
    if (existing && existing.project_id !== value.projectId)
      throw new Error("別ProjectのキャラクターProfileは更新できません。");
    this.db
      .prepare(
        `insert into character_profiles(
           id,project_id,name,description,prompt,negative_prompt,created_at,updated_at
         ) values(?,?,?,?,?,?,?,?)
         on conflict(id) do update set name=excluded.name,
           description=excluded.description,prompt=excluded.prompt,
           negative_prompt=excluded.negative_prompt,updated_at=excluded.updated_at`,
      )
      .run(
        id,
        value.projectId,
        value.name,
        value.description,
        value.prompt,
        value.negativePrompt,
        stamp,
        stamp,
      );
    return this.listCharacterProfiles(value.projectId);
  }
  deleteCharacterProfile(id: string): CharacterProfile[] {
    const profile = this.db
      .prepare("select project_id from character_profiles where id=?")
      .get(id) as { project_id: string } | undefined;
    if (!profile) throw new Error("キャラクターProfileが見つかりません。");
    this.db.prepare("delete from character_profiles where id=?").run(id);
    return this.listCharacterProfiles(profile.project_id);
  }
  attachCharacterReferenceAsset(input: unknown): CharacterProfile[] {
    const value = characterReferenceAssetInputSchema.parse(input),
      profile = this.db
        .prepare("select project_id from character_profiles where id=?")
        .get(value.characterProfileId) as { project_id: string } | undefined,
      asset = this.db
        .prepare("select project_id from assets where id=?")
        .get(value.assetId) as { project_id: string } | undefined;
    if (!profile) throw new Error("キャラクターProfileが見つかりません。");
    if (!asset) throw new Error("参照素材が見つかりません。");
    if (profile.project_id !== asset.project_id)
      throw new Error("別Projectの素材は参照画像に設定できません。");
    const order = (
      this.db
        .prepare(
          "select coalesce(max(order_index),-1)+1 as value from character_profile_assets where character_profile_id=?",
        )
        .get(value.characterProfileId) as { value: number }
    ).value;
    this.db
      .prepare(
        `insert into character_profile_assets(
           character_profile_id,asset_id,role,order_index,created_at
         ) values(?,?,?,?,?)
         on conflict(character_profile_id,asset_id) do update set
           role=excluded.role`,
      )
      .run(value.characterProfileId, value.assetId, value.role, order, now());
    return this.listCharacterProfiles(profile.project_id);
  }
  detachCharacterReferenceAsset(input: unknown): CharacterProfile[] {
    const value = characterReferenceAssetInputSchema
        .pick({ characterProfileId: true, assetId: true })
        .parse(input),
      profile = this.db
        .prepare("select project_id from character_profiles where id=?")
        .get(value.characterProfileId) as { project_id: string } | undefined;
    if (!profile) throw new Error("キャラクターProfileが見つかりません。");
    this.db
      .prepare(
        "delete from character_profile_assets where character_profile_id=? and asset_id=?",
      )
      .run(value.characterProfileId, value.assetId);
    return this.listCharacterProfiles(profile.project_id);
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
    const rows = this.db
      .prepare(
        "select id,name,file_path as filePath,mapping_json as mappingJson,is_default as isDefault,created_at as createdAt,updated_at as updatedAt from comfy_workflows order by is_default desc,name",
      )
      .all() as Array<Record<string, any>>;
    return rows.map((row) => {
      try {
        const definition = this.getComfyWorkflow(row.id);
        return {
          ...row,
          optimization: analyzeComfyWorkflowOptimization(definition.workflow),
          supportedOperations: [
            ...(definition.mapping.prompt ? ["text_to_image"] : []),
            ...(definition.mapping.sourceImage ? ["image_to_image"] : []),
            ...(definition.mapping.controlImage ? ["controlnet"] : []),
            ...(definition.mapping.sourceImage && definition.mapping.maskImage
              ? ["inpainting"]
              : []),
          ],
        };
      } catch {
        return { ...row, optimization: null };
      }
    });
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
    const optimization = analyzeComfyWorkflowOptimization(definition.workflow),
      supportedOperations = [
        ...(definition.mapping.prompt ? ["text_to_image"] : []),
        ...(definition.mapping.sourceImage ? ["image_to_image"] : []),
        ...(definition.mapping.controlImage ? ["controlnet"] : []),
        ...(definition.mapping.sourceImage && definition.mapping.maskImage
          ? ["inpainting"]
          : []),
      ],
      warnings = [
        !optimization.hasTiledVaeDecode
          ? "低スペック向けのVAEDecodeTiledが見つかりません。"
          : "",
        "CPUオフロードはworkflow JSONでは確認できません。ComfyUIの起動設定を実環境で確認してください。",
      ].filter(Boolean);
    return {
      ok: errors.length === 0,
      message: errors.length
        ? errors.join("\n")
        : `${fields.length}項目のマッピングを確認しました。`,
      fields,
      warnings,
      optimization,
      supportedOperations,
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
      shape: p.shape ?? "rectangle",
      slant: p.slant ?? 0.12,
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
    const panelLayers = (
      this.db
        .prepare(
          `select l.* from panel_layers l
           join panels pn on pn.id=l.panel_id
           join pages p on p.id=pn.page_id
           join episodes e on e.id=p.episode_id
           where e.project_id=? order by l.panel_id,l.order_index`,
        )
        .all(projectId) as any[]
    ).map((layer) => ({
      id: layer.id,
      panelId: layer.panel_id,
      name: layer.name,
      type: layer.layer_type,
      orderIndex: layer.order_index,
      visible: Boolean(layer.visible),
      locked: Boolean(layer.locked),
      opacity: layer.opacity,
      blendMode: layer.blend_mode,
      assetId: layer.asset_id,
      sourceJobId: layer.source_job_id,
      imageFit: layer.image_fit,
      imageOffsetX: layer.image_offset_x,
      imageOffsetY: layer.image_offset_y,
      imageScale: layer.image_scale,
      imageRotation: layer.image_rotation,
      createdAt: layer.created_at,
      updatedAt: layer.updated_at,
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
    ).map((t) => {
      const parent = balloons.find((item) => item.id === t.parent_balloon_id);
      const usesRelativeGeometry =
        parent &&
        Number.isFinite(t.relative_x) &&
        Number.isFinite(t.relative_y) &&
        Number.isFinite(t.relative_width) &&
        Number.isFinite(t.relative_height);
      return {
        id: t.id,
        pageId: t.page_id,
        parentBalloonId: t.parent_balloon_id,
        name: t.name,
        text: t.text,
        writingMode: t.writing_mode,
        x: usesRelativeGeometry ? parent.x + t.relative_x * parent.width : t.x,
        y: usesRelativeGeometry ? parent.y + t.relative_y * parent.height : t.y,
        width: usesRelativeGeometry ? t.relative_width * parent.width : t.width,
        height: usesRelativeGeometry
          ? t.relative_height * parent.height
          : t.height,
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
      };
    });
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
      libraryCategory: a.library_category ?? "unclassified",
      libraryTags: JSON.parse(a.library_tags_json ?? "[]"),
      libraryFavorite: Boolean(a.library_favorite),
      libraryUpdatedAt: a.library_updated_at ?? null,
      createdAt: a.created_at,
    }));
    return {
      project: this.project(p),
      episodes,
      pages,
      panels,
      panelLayers,
      balloons,
      textObjects,
      assets,
    };
  }
}
