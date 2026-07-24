import type Database from "better-sqlite3";

export type AssetInsert = {
  id: string;
  projectId: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  createdAt: string;
};

export type StoredAsset = {
  id: string;
  projectId: string;
  storagePath: string;
  relativePath: string;
  byteSize: number;
  sha256: string;
  libraryTagsJson: string;
};

export class AssetRepository {
  constructor(private readonly database: Database.Database) {}

  hasSha256(projectId: string, sha256: string) {
    return Boolean(
      this.database
        .prepare("select 1 from assets where project_id=? and sha256=?")
        .get(projectId, sha256),
    );
  }

  insert(asset: AssetInsert) {
    this.database
      .prepare(
        `insert into assets(
           id,project_id,file_name,relative_path,mime_type,width,height,
           byte_size,sha256,created_at
         ) values(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        asset.id,
        asset.projectId,
        asset.fileName,
        asset.relativePath,
        asset.mimeType,
        asset.width,
        asset.height,
        asset.byteSize,
        asset.sha256,
        asset.createdAt,
      );
  }

  setCoverWhenMissing(projectId: string, assetId: string, updatedAt: string) {
    this.database
      .prepare(
        "update projects set cover_asset_id=coalesce(cover_asset_id,?),updated_at=? where id=?",
      )
      .run(assetId, updatedAt, projectId);
  }

  findLibraryMetadata(assetId: string) {
    return this.database
      .prepare(
        "select project_id as projectId,library_tags_json as libraryTagsJson from assets where id=?",
      )
      .get(assetId) as
      { projectId: string; libraryTagsJson: string } | undefined;
  }

  updateLibraryMetadata(input: {
    assetId: string;
    category: string;
    tagsJson: string;
    favorite: boolean;
    updatedAt: string;
  }) {
    this.database
      .prepare(
        `update assets
         set library_category=?,library_tags_json=?,library_favorite=?,
             library_updated_at=?
         where id=?`,
      )
      .run(
        input.category,
        input.tagsJson,
        input.favorite ? 1 : 0,
        input.updatedAt,
        input.assetId,
      );
  }

  findStoredAsset(assetId: string) {
    const row = this.database
      .prepare(
        `select a.id,a.project_id as projectId,p.storage_path as storagePath,
                a.relative_path as relativePath,a.byte_size as byteSize,
                a.sha256,a.library_tags_json as libraryTagsJson
         from assets a join projects p on p.id=a.project_id
         where a.id=?`,
      )
      .get(assetId);
    return row as StoredAsset | undefined;
  }

  delete(assetId: string, updatedAt: string) {
    this.database.transaction(() => {
      this.database
        .prepare(
          "update projects set cover_asset_id=null,updated_at=? where cover_asset_id=?",
        )
        .run(updatedAt, assetId);
      this.database.prepare("delete from assets where id=?").run(assetId);
    })();
  }

  findData(relativePath: string) {
    return this.database
      .prepare(
        `select a.relative_path as relativePath,a.mime_type as mimeType,
                p.storage_path as storagePath
         from assets a join projects p on p.id=a.project_id
         where a.relative_path=?`,
      )
      .get(relativePath) as
      | { relativePath: string; mimeType: string; storagePath: string }
      | undefined;
  }

  findCoverRelativePath(projectId: string) {
    return this.database
      .prepare(
        `select a.relative_path as relativePath
         from projects p
         left join assets a on a.id=coalesce(
           p.cover_asset_id,
           (select id from assets where project_id=p.id order by created_at limit 1)
         )
         where p.id=?`,
      )
      .get(projectId) as { relativePath: string | null } | undefined;
  }
}
