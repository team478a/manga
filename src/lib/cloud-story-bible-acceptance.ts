import type { CloudGenerationProvenance } from "./cloud-generation-provenance";

export type StoryBibleScore = "PASS" | "FAIL" | "NOT_EVALUATED";
export type StoryBibleScorecard = { key:string; label:string; score:StoryBibleScore; detail:string };

export function scoreTenSceneStoryBible(input:{scenes:Array<{sceneId:string;provenance:CloudGenerationProvenance;costumeVersion:string|null}>;expectedCharacterId:string;expectedCharacterVersion:number;expectedCostumeVersion:string;requiredReferenceRoles:string[]}):StoryBibleScorecard[]{
 const scenes=input.scenes;const ten=scenes.length===10;
 const identity=ten&&scenes.every(({provenance})=>provenance.characterVersions.some(item=>item.profileId===input.expectedCharacterId&&item.version===input.expectedCharacterVersion));
 const costume=ten&&scenes.every(item=>item.costumeVersion===input.expectedCostumeVersion);
 const references=ten&&scenes.every(({provenance})=>input.requiredReferenceRoles.every(role=>provenance.references.some(item=>item.profileId===input.expectedCharacterId&&item.profileVersion===input.expectedCharacterVersion&&item.role===role)));
 const workflow=ten&&scenes.every(({provenance})=>provenance.workflowVersion==="storyboard-panel-v1"&&provenance.providerId.length>0&&provenance.modelId.length>0);
 const tracked=ten&&scenes.every(({provenance})=>provenance.referenceBundleVersion===1&&provenance.referenceResolverVersion==="character-reference-v1");
 const row=(key:string,label:string,pass:boolean,detail:string):StoryBibleScorecard=>({key,label,score:pass?"PASS":"FAIL",detail});
 return [row("scene_count","固定10シーン",ten,`${scenes.length}/10`),row("identity_trace","人物version追跡",identity,identity?"全シーン一致":"不一致あり"),row("costume_trace","衣装version追跡",costume,costume?"全シーン一致":"不一致あり"),row("reference_coverage","承認済み参照role",references,references?"必須role充足":"不足あり"),row("workflow_trace","Provider・model・workflow追跡",workflow,workflow?"全シーン追跡可":"不足あり"),row("bundle_trace","参照bundle・resolver追跡",tracked,tracked?"全シーン固定":"不足あり"),
  ...["顔","髪","衣装の視覚一致","体格","配色","構図追従"].map((label,index)=>({key:`visual_${index+1}`,label,score:"NOT_EVALUATED" as const,detail:"画像生成・Vision評価を実行していない"}))];
}
