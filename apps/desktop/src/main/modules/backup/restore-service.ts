import fs from "node:fs";
import { BackupReader } from "./backup-reader.js";
import type { BulkOperationOptions } from "./backup-operation.js";

type RestorableManifest = {
  bundle: {
    assets: Array<{
      id: string;
      fileName: string;
      byteSize: number;
      sha256: string;
    }>;
  };
};

export class RestoreService {
  constructor(private readonly reader: BackupReader) {}

  async restore<TManifest extends RestorableManifest, TResult>(input: {
    source: string;
    projectsRoot: string;
    parseManifest: (value: unknown) => TManifest;
    options?: BulkOperationOptions;
    commit: (prepared: {
      manifest: TManifest;
      stagingDirectory: string;
      stagedAssetsDirectory: string;
    }) => Promise<TResult> | TResult;
  }) {
    const prepared = await this.reader.read({
      source: input.source,
      projectsRoot: input.projectsRoot,
      parseManifest: input.parseManifest,
      options: input.options,
    });
    try {
      return await input.commit(prepared);
    } catch (error) {
      fs.rmSync(prepared.stagingDirectory, {
        recursive: true,
        force: true,
      });
      throw error;
    }
  }
}
