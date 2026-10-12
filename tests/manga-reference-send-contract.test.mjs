import assert from "node:assert/strict";
import test from "node:test";
import { resolvePanelReferenceBundle } from "../src/modules/manga/domain/panel-reference-bundle.ts";
import { cloudImageReferenceCapacity } from "../src/lib/cloud-image-reference-capacity.ts";
import { resolveReferenceImageUrls } from "../src/modules/cloud-ai/infrastructure/reference-image-urls.ts";
import { resolveVersionedCharacterReferences, retainSentCharacterReferences } from "../src/modules/manga/domain/panel-reference-policy.ts";

const role = (assetId, subjectKind = "character", subjectId = "A") => ({assetId, subjectKind, subjectId});
const subjects = [{kind:"character",id:"A"},{kind:"character",id:"B"},{kind:"style",id:"style"},{kind:"location",id:"room"},{kind:"prop",id:"key"}];
const references = [role("a1"),role("a2"),role("b1","character","B"),role("b2","character","B"),role("style","style","style"),role("room","location","room"),role("key","prop","key")];

for (const [model, cap] of [["flux-2-pro",8],["flux-2-max",8],["flux-2-klein-9b",4]]) {
  test(`${model}: capを番号付け前に適用し修正元を先頭固定する`, () => {
    assert.equal(cloudImageReferenceCapacity(model), cap);
    const bundle = resolvePanelReferenceBundle({references,orderedSubjects:subjects,sourceAssetId:"source",maxAssets:cap});
    assert.deepEqual(bundle.map(item=>item.assetId), ["source","a1","a2","b1","b2","style","room","key"].slice(0,cap));
    assert.deepEqual(bundle.map(item=>item.inputName), ["input_image",...Array.from({length:cap-1},(_,i)=>`input_image_${i+2}`)]);
    assert.equal(bundle[0].editSource,true);
  });
}
test("同じAssetの修正元・複数人物・画風roleを1入力へ統合する", () => {
  const bundle=resolvePanelReferenceBundle({references:[role("shared"),role("shared","character","B"),role("shared","style","style")],orderedSubjects:subjects,sourceAssetId:"shared",maxAssets:1});
  assert.equal(bundle.length,1);
  assert.equal(bundle[0].roles.length,3);
  assert.equal(bundle[0].inputName,"input_image");
  assert.equal(bundle[0].editSource,true);
});
test("Fillは元画像だけを参照し独立人物参照を送信済み扱いにしない", () => {
  assert.equal(cloudImageReferenceCapacity("flux-pro-1.0-fill"),1);
  const bundle=resolvePanelReferenceBundle({references,orderedSubjects:subjects,sourceAssetId:"source",maxAssets:1,fillOnly:true});
  assert.deepEqual(bundle.map(item=>[item.assetId,item.roles]),[["source",[]]]);
});
test("DB返却順が逆でも署名URLは保存したAsset順を保持する", async () => {
  const urls=await resolveReferenceImageUrls(["a","b"],[{id:"b",storage_path:"path/b"},{id:"a",storage_path:"path/a"}],async path=>`https://example.test/${path}`);
  assert.deepEqual(urls,["https://example.test/path/a","https://example.test/path/b"]);
});
for (const [label, ids, rows, sign] of [
  ["missing",["a"],[],async()=>"url"],
  ["cross-project/unexpected",["a"],[{id:"b",storage_path:"b"}],async()=>"url"],
  ["empty path",["a"],[{id:"a",storage_path:""}],async()=>"url"],
  ["duplicate ID",["a","a"],[{id:"a",storage_path:"a"}],async()=>"url"],
  ["unreadable",["a"],[{id:"a",storage_path:"a"}],async()=>null],
]) test(`署名準備${label}は部分的な参照で続行しない`,async()=>{
  await assert.rejects(resolveReferenceImageUrls(ids,rows,sign),error=>error.code==="provider_rejected"&&!error.retryable);
});
test("版付き人物参照はcap後に実際に送るAssetだけを追跡し不足はblockする",()=>{
  const make=(subjectId,assetId)=>({subjectKind:"character",subjectId,assetId,characterVersionId:subjectId,profileVersion:2,role:"front",priority:0});
  const resolution=resolveVersionedCharacterReferences({characters:[{profileId:"A",versionId:"A",version:2},{profileId:"B",versionId:"B",version:2}],bindings:[make("A","a"),make("B","b")],policy:"block"});
  const final=retainSentCharacterReferences(resolution,["a"]);
  assert.deepEqual(final.references.map(item=>item.assetId),["a"]);
  assert.equal(final.blocked,true);
  assert.equal(final.warnings[0].profileId,"B");
  assert.equal(resolution.references.length,2); // no mutation of a frozen old resolution
});
test("版付きresolver自体の上限で落ちた人物も準備完了扱いにしない",()=>{
  const characters=Array.from({length:9},(_,i)=>({profileId:`person-${i}`,versionId:`version-${i}`,version:1}));
  const bindings=characters.map((item,i)=>({subjectKind:"character",subjectId:item.profileId,characterVersionId:item.versionId,profileVersion:1,assetId:`asset-${i}`,role:"front",priority:0}));
  const result=resolveVersionedCharacterReferences({characters,bindings,policy:"block"});
  assert.equal(result.references.length,8);
  assert.equal(result.blocked,true);
  assert.equal(result.warnings[0].profileId,"person-8");
});
test("同じAssetを二人が参照しても人物別role/versionを失わない",()=>{
  const characters=[{profileId:"A",versionId:"A-v2",version:2},{profileId:"B",versionId:"B-v3",version:3}];
  const bindings=characters.map(item=>({subjectKind:"character",subjectId:item.profileId,characterVersionId:item.versionId,profileVersion:item.version,assetId:"shared",role:"front",priority:0}));
  const result=resolveVersionedCharacterReferences({characters,bindings,policy:"block"});
  assert.equal(result.blocked,false);
  assert.deepEqual(result.references.map(item=>[item.subjectId,item.profileVersion]),[["A",2],["B",3]]);
});
