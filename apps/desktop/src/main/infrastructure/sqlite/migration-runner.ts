import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export type Migration = {
  version: string;
  name: string;
  backupRequired: boolean;
  run: (database: Database.Database) => void;
};

export type MigrationRunnerEvent =
  | {
      event: "migration_backup_created";
      version: string;
      name: string;
    }
  | {
      event: "migration_applied";
      version: string;
      name: string;
    }
  | {
      event: "migration_failed";
      version: string;
      name: string;
      error: unknown;
    };

type MigrationRunnerOptions = {
  databasePath: string;
  backupDirectory: string;
  databaseExisted: boolean;
  now?: () => Date;
  onEvent?: (event: MigrationRunnerEvent) => void;
};

const migrationVersionPattern = /^[a-z0-9][a-z0-9-]*$/;

function hasMigrationTable(database: Database.Database) {
  return Boolean(
    database
      .prepare(
        "select 1 from sqlite_master where type='table' and name='schema_migrations'",
      )
      .get(),
  );
}

function appliedVersions(database: Database.Database) {
  if (!hasMigrationTable(database)) return new Set<string>();
  return new Set(
    (
      database.prepare("select version from schema_migrations").all() as Array<{
        version: string;
      }>
    ).map((row) => row.version),
  );
}

function validateMigrations(migrations: readonly Migration[]) {
  const versions = new Set<string>();
  for (const migration of migrations) {
    if (!migrationVersionPattern.test(migration.version))
      throw new Error(`Invalid migration version: ${migration.version}`);
    if (!migration.name.trim())
      throw new Error(`Migration name is required: ${migration.version}`);
    if (versions.has(migration.version))
      throw new Error(`Duplicate migration version: ${migration.version}`);
    versions.add(migration.version);
  }
}

export class MigrationRunner {
  constructor(
    private readonly database: Database.Database,
    private readonly options: MigrationRunnerOptions,
  ) {}

  private createBackup(migration: Migration) {
    fs.mkdirSync(this.options.backupDirectory, { recursive: true });
    this.database.pragma("wal_checkpoint(RESTART)");
    const stamp = (this.options.now?.() ?? new Date())
      .toISOString()
      .replace(/[:.]/g, "-");
    const destination = path.join(
      this.options.backupDirectory,
      `mangai_local-before-${migration.version}-${stamp}.sqlite`,
    );
    const temporary = `${destination}.tmp`;
    try {
      fs.copyFileSync(
        this.options.databasePath,
        temporary,
        fs.constants.COPYFILE_EXCL,
      );
      fs.renameSync(temporary, destination);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      throw error;
    }
    this.options.onEvent?.({
      event: "migration_backup_created",
      version: migration.version,
      name: migration.name,
    });
  }

  run(migrations: readonly Migration[], prepare: () => void) {
    validateMigrations(migrations);
    const applied = appliedVersions(this.database);
    const pending = migrations.filter(
      (migration) => !applied.has(migration.version),
    );

    if (pending.length === 0) {
      this.database.transaction(prepare)();
      return { applied: [] };
    }

    pending.forEach((migration, index) => {
      try {
        if (this.options.databaseExisted && migration.backupRequired)
          this.createBackup(migration);
        const appliedAt = (this.options.now?.() ?? new Date()).toISOString();
        this.database.transaction(() => {
          if (index === 0) prepare();
          migration.run(this.database);
          this.database
            .prepare(
              "insert into schema_migrations(version,name,applied_at) values(?,?,?)",
            )
            .run(migration.version, migration.name, appliedAt);
        })();
        this.options.onEvent?.({
          event: "migration_applied",
          version: migration.version,
          name: migration.name,
        });
      } catch (error) {
        this.options.onEvent?.({
          event: "migration_failed",
          version: migration.version,
          name: migration.name,
          error,
        });
        throw error;
      }
    });

    return {
      applied: pending.map((migration) => migration.version),
    };
  }
}
