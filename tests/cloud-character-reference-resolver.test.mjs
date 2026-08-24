import assert from "node:assert/strict";
import test from "node:test";
import { resolveVersionedCharacterReferences } from "../src/modules/manga/domain/panel-reference-policy.ts";
const profileId="10000000-0000-4000-8000-000000000001",versionId="20000000-0000-4000-8000-000000000001";
const asset=(suffix,role,priority=0,overrides={})=>({subjectKind:"character",subjectId:profileId,characterVersionId:versionId,profileVersion:2,assetId:`30000000-0000-4000-8000-00000000000${suffix}`,role,priority,...overrides});
test("current versionのbindingをrole優先で固定する",()=>{const result=resolveVersionedCharacterReferences({characters:[{profileId,versionId,version:2}],policy:"block",bindings:[asset(1,"expression",100),asset(2,"face",10),asset(3,"front",0)]});assert.equal(result.blocked,false);assert.deepEqual(result.references.map(item=>item.role),["front","face"]);assert.equal(result.resolverVersion,"character-reference-v1");});
test("別version bindingを拒否しblock方針では停止する",()=>{const result=resolveVersionedCharacterReferences({characters:[{profileId,versionId,version:2}],policy:"block",bindings:[asset(1,"front",0,{characterVersionId:"20000000-0000-4000-8000-000000000009"})]});assert.equal(result.blocked,true);assert.equal(result.references.length,0);});
test("warn方針では不足理由を残して続行できる",()=>{const result=resolveVersionedCharacterReferences({characters:[{profileId,versionId,version:2}],bindings:[],policy:"warn"});assert.equal(result.blocked,false);assert.equal(result.warnings[0].code,"major_character_identity_reference_missing");});
