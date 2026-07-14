import fs from "node:fs";
import path from "node:path";
import {
  DatabaseIntegrityError,
  MangaiDatabase,
  type Paths,
} from "./database.js";

export type DatabaseRecoveryReport = {
  recovered: true;
  detectedAt: string;
  reason: string;
  archiveDirectory: string;
  source: "project-backups" | "sqlite-backup" | "empty";
  restoredProjects: string[];
  failedBackups: Array<{ filePath: string; message: string }>;
};

function databaseFiles(databasePath: string) {
  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
}

function removeDatabaseFiles(databasePath: string) {
  for (const filePath of databaseFiles(databasePath))
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

function latestProjectBackups(root: string) {
  const automaticRoot = path.join(root, "backups", "automatic");
  if (!fs.existsSync(automaticRoot)) return [];
  return fs
    .readdirSync(automaticRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(automaticRoot, entry.name);
      const latest = fs
        .readdirSync(directory)
        .filter((name) => name.endsWith(".mangai-backup"))
        .map((name) => {
          const filePath = path.join(directory, name);
          return { filePath, modifiedAt: fs.statSync(filePath).mtimeMs };
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt)[0];
      return latest ? [latest.filePath] : [];
    });
}

function sqliteBackupCandidates(root: string) {
  const directory = path.join(root, "backups");
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => /^mangai_local-before-.+\.sqlite$/.test(name))
    .map((name) => {
      const filePath = path.join(directory, name);
      return { filePath, modifiedAt: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .map((item) => item.filePath);
}

export async function openDatabaseWithRecovery(paths: Paths): Promise<{
  database: MangaiDatabase;
  recovery: DatabaseRecoveryReport | null;
}> {
  try {
    return { database: new MangaiDatabase(paths), recovery: null };
  } catch (error) {
    if (!(error instanceof DatabaseIntegrityError)) throw error;
    const detectedAt = new Date().toISOString();
    const stamp = detectedAt.replace(/[:.]/g, "-");
    const archiveDirectory = path.join(
      paths.root,
      "backups",
      "recovery",
      stamp,
    );
    fs.mkdirSync(archiveDirectory, { recursive: true });
    const moved: Array<{ source: string; archived: string }> = [];
    for (const source of databaseFiles(paths.database)) {
      if (!fs.existsSync(source)) continue;
      const archived = path.join(archiveDirectory, path.basename(source));
      fs.renameSync(source, archived);
      moved.push({ source, archived });
    }
    const report: DatabaseRecoveryReport = {
      recovered: true,
      detectedAt,
      reason: error.message,
      archiveDirectory,
      source: "empty",
      restoredProjects: [],
      failedBackups: [],
    };
    try {
      const projectBackups = latestProjectBackups(paths.root);
      if (projectBackups.length) {
        const database = new MangaiDatabase(paths);
        report.source = "project-backups";
        for (const filePath of projectBackups)
          try {
            const restored = await database.restoreProject(filePath, {
              titleSuffix: "",
            });
            report.restoredProjects.push(restored.project.title);
          } catch (cause) {
            report.failedBackups.push({
              filePath,
              message: cause instanceof Error ? cause.message : String(cause),
            });
          }
        return { database, recovery: report };
      }
      for (const candidate of sqliteBackupCandidates(paths.root)) {
        try {
          removeDatabaseFiles(paths.database);
          fs.copyFileSync(
            candidate,
            paths.database,
            fs.constants.COPYFILE_EXCL,
          );
          const database = new MangaiDatabase(paths);
          report.source = "sqlite-backup";
          report.restoredProjects = database
            .listProjects()
            .map((project) => project.title);
          return { database, recovery: report };
        } catch (cause) {
          report.failedBackups.push({
            filePath: candidate,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
      removeDatabaseFiles(paths.database);
      return { database: new MangaiDatabase(paths), recovery: report };
    } catch (recoveryError) {
      removeDatabaseFiles(paths.database);
      for (const item of moved)
        if (fs.existsSync(item.archived))
          fs.renameSync(item.archived, item.source);
      throw recoveryError;
    }
  }
}
