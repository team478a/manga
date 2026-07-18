import React from "react";
import {
  isInternalPanelCacheAsset,
  type CharacterProfile,
  type ProjectBundle,
} from "@mangai/project-core";
import { useI18n } from "../../i18n";

const emptyDraft = {
  name: "",
  description: "",
  prompt: "",
  negativePrompt: "",
};

export function CharacterProfileManager({
  bundle,
  profiles,
  selectedId,
  onProfiles,
  onSelectedId,
}: {
  bundle: ProjectBundle;
  profiles: CharacterProfile[];
  selectedId: string;
  onProfiles: (profiles: CharacterProfile[]) => void;
  onSelectedId: (id: string) => void;
}) {
  const { t } = useI18n();
  const selected = profiles.find((profile) => profile.id === selectedId);
  const [draft, setDraft] = React.useState(emptyDraft);
  const [assetId, setAssetId] = React.useState("");
  const [role, setRole] = React.useState<"reference" | "face" | "pose">(
    "reference",
  );
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    setDraft(
      selected
        ? {
            name: selected.name,
            description: selected.description,
            prompt: selected.prompt,
            negativePrompt: selected.negativePrompt,
          }
        : emptyDraft,
    );
  }, [selectedId, selected?.updatedAt]);
  const assets = bundle.assets.filter(
    (asset) => !isInternalPanelCacheAsset(asset),
  );
  const save = async () => {
    if (!draft.name.trim()) return;
    const next = await window.mangai.saveCharacterProfile({
      id: selectedId || undefined,
      projectId: bundle.project.id,
      ...draft,
    });
    onProfiles(next);
    const saved = selectedId
      ? next.find((profile) => profile.id === selectedId)
      : next.find((profile) => profile.name === draft.name.trim());
    if (saved) onSelectedId(saved.id);
    setMessage(t("generation.characterSave"));
  };
  return (
    <section className="panel-lite">
      <h3>{t("generation.characterTitle")}</h3>
      <p>{t("generation.characterHelp")}</p>
      <div className="inline">
        <label>
          {t("generation.characterSelect")}
          <select
            value={selectedId}
            onChange={(event) => onSelectedId(event.target.value)}
          >
            <option value="">{t("generation.characterNone")}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            onSelectedId("");
            setDraft(emptyDraft);
            setMessage("");
          }}
        >
          {t("generation.characterNew")}
        </button>
      </div>
      <label>
        {t("generation.characterName")}
        <input
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label>
        {t("generation.characterDescription")}
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {t("generation.characterPrompt")}
        <textarea
          value={draft.prompt}
          onChange={(event) =>
            setDraft((current) => ({ ...current, prompt: event.target.value }))
          }
        />
      </label>
      <label>
        {t("generation.characterNegative")}
        <textarea
          value={draft.negativePrompt}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              negativePrompt: event.target.value,
            }))
          }
        />
      </label>
      <div className="inline">
        <button disabled={!draft.name.trim()} onClick={() => void save()}>
          {t("generation.characterSave")}
        </button>
        <button
          className="danger"
          disabled={!selectedId}
          onClick={async () => {
            if (!selectedId || !confirm(t("generation.characterDeleteConfirm")))
              return;
            onProfiles(await window.mangai.deleteCharacterProfile(selectedId));
            onSelectedId("");
          }}
        >
          {t("generation.characterDelete")}
        </button>
      </div>
      {selected && (
        <div className="panel-lite">
          <div className="inline">
            <label>
              {t("generation.characterReference")}
              <select
                value={assetId}
                onChange={(event) => setAssetId(event.target.value)}
              >
                <option value="">{t("generation.selectAsset")}</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("generation.characterReferenceRole")}
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as typeof role)
                }
              >
                <option value="reference">
                  {t("generation.characterReferenceGeneral")}
                </option>
                <option value="face">
                  {t("generation.characterReferenceFace")}
                </option>
                <option value="pose">
                  {t("generation.characterReferencePose")}
                </option>
              </select>
            </label>
            <button
              className="secondary"
              disabled={!assetId}
              onClick={async () => {
                onProfiles(
                  await window.mangai.attachCharacterReferenceAsset({
                    characterProfileId: selected.id,
                    assetId,
                    role,
                  }),
                );
                setAssetId("");
              }}
            >
              {t("generation.characterReferenceAdd")}
            </button>
          </div>
          {selected.referenceAssets.map((reference) => {
            const asset = bundle.assets.find(
              (item) => item.id === reference.assetId,
            );
            return (
              <div className="inline" key={reference.assetId}>
                <span>{asset?.fileName ?? reference.assetId}</span>
                <span>{reference.role}</span>
                <button
                  className="secondary"
                  onClick={async () =>
                    onProfiles(
                      await window.mangai.detachCharacterReferenceAsset(
                        selected.id,
                        reference.assetId,
                      ),
                    )
                  }
                >
                  {t("generation.characterReferenceRemove")}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
