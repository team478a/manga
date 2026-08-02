import type { CloudCharacterProfile } from "@/lib/cloud-character-profile";
import type { CloudContinuityFact } from "@/lib/cloud-narrative-continuity";
import type { CloudWorldProfile } from "@/lib/cloud-world-bible";
import type { CloudLongformStructure, CloudPage } from "@/modules/cloud-creator/contracts/types";

export type CloudContinuitySuggestion = {
  id: string;
  factKind: CloudContinuityFact["fact_kind"];
  subject: string;
  attribute: string;
  factValue: string;
  startPage: number;
  endPage: number;
  sourcePage: number | null;
  notes: string;
  sourceLabel: string;
};

type SuggestionSources = {
  projectId: string;
  pages: CloudPage[];
  longform: CloudLongformStructure;
  characters: CloudCharacterProfile[];
  worlds: CloudWorldProfile[];
  existingFacts: CloudContinuityFact[];
};

const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("ja");
const compact = (value: string) => value.trim().replace(/\s+/g, " ");

function candidateId(parts: string[]) {
  return parts.map((part) => encodeURIComponent(normalize(part))).join(":");
}

function isAlreadyRegistered(candidate: CloudContinuitySuggestion, facts: CloudContinuityFact[]) {
  return facts.some((fact) =>
    fact.fact_kind === candidate.factKind &&
    normalize(fact.subject) === normalize(candidate.subject) &&
    normalize(fact.attribute) === normalize(candidate.attribute) &&
    normalize(fact.fact_value) === normalize(candidate.factValue) &&
    fact.start_page === candidate.startPage &&
    fact.end_page === candidate.endPage,
  );
}

export function buildCloudContinuitySuggestions(source: SuggestionSources) {
  const totalPages = Math.max(source.pages.length, 1);
  const suggestions: CloudContinuitySuggestion[] = [];
  const add = (candidate: Omit<CloudContinuitySuggestion, "id">, sourceId: string) => {
    const factValue = compact(candidate.factValue);
    if (!factValue) return;
    const suggestion = {
      ...candidate,
      factValue,
      id: candidateId([source.projectId, sourceId, candidate.factKind, candidate.subject, candidate.attribute, factValue]),
    };
    if (!isAlreadyRegistered(suggestion, source.existingFacts)) suggestions.push(suggestion);
  };

  for (const character of source.characters) {
    const base = {
      factKind: "appearance" as const,
      subject: character.name,
      startPage: 1,
      endPage: totalPages,
      sourcePage: null,
      notes: `キャラクター設定 v${character.current_version}から確認候補として抽出`,
      sourceLabel: "キャラクター設定",
    };
    const values = [
      ["見た目年齢", character.appearance_age],
      ["体格", character.body_build],
      ["髪", character.hair],
      ["衣装", character.costume],
      ["配色", character.color_palette],
      ...character.immutable_traits.map((value, index) => [`固定特徴${index + 1}`, value]),
    ];
    for (const [attribute, factValue] of values)
      add({ ...base, attribute, factValue }, `character:${character.id}:v${character.current_version}`);
  }

  for (const world of source.worlds) {
    const factKind = world.kind;
    const base = {
      factKind,
      subject: world.name,
      startPage: 1,
      endPage: totalPages,
      sourcePage: null,
      notes: `${world.kind === "location" ? "場所" : "小物"}設定 v${world.current_version}から確認候補として抽出`,
      sourceLabel: world.kind === "location" ? "場所設定" : "小物設定",
    };
    const values = [
      ["設定", world.description],
      ["配色", world.color_palette],
      ...world.visual_traits.map((value, index) => [`外見特徴${index + 1}`, value]),
      ...world.continuity_rules.map((value, index) => [`連続性ルール${index + 1}`, value]),
    ];
    for (const [attribute, factValue] of values)
      add({ ...base, attribute, factValue }, `world:${world.id}:v${world.current_version}`);
  }

  for (const scene of source.longform.scenes) {
    const scenePages = source.pages
      .filter((page) => source.longform.pageSceneIds[page.id] === scene.id)
      .map((page) => page.page_number)
      .sort((left, right) => left - right);
    if (!scenePages.length || !scene.summary.trim()) continue;
    add({
      factKind: "timeline",
      subject: scene.title,
      attribute: "シーン要約",
      factValue: scene.summary,
      startPage: scenePages[0],
      endPage: scenePages.at(-1)!,
      sourcePage: scenePages[0],
      notes: "ページに割り当て済みのシーン構成から確認候補として抽出",
      sourceLabel: "シーン構成",
    }, `scene:${scene.id}:v${scene.revision}`);
  }

  return suggestions;
}
