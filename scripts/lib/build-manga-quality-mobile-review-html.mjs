function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  })[character]);
}

export function buildMangaQualityMobileReviewHtml(input) {
  const data = safeJson(input);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>MANGAI 非公開Human Review</title>
  <style>
    :root{color-scheme:light;--ink:#172033;--muted:#667085;--line:#d0d5dd;--paper:#fff;--wash:#f4f3ff;--brand:#6941c6;--danger:#b42318;--ok:#067647}*{box-sizing:border-box}body{margin:0;background:#f7f7fa;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}button,input,select,textarea{font:inherit}button{min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:10px 14px;font-weight:700}.primary{background:var(--brand);border-color:var(--brand);color:#fff}.danger{color:var(--danger)}header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left))}.header-row,.nav,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.header-row{justify-content:space-between}h1{font-size:18px;margin:0}.progress{font-size:14px;color:var(--muted)}main{max-width:880px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-right)) calc(96px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}.notice,.card{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}.notice{background:var(--wash)}.notice p{margin:4px 0}.candidate{display:block;max-width:100%;max-height:72vh;margin:0 auto;border-radius:8px}.reference-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.reference-grid img{width:100%;border-radius:8px}.case-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.mode{color:var(--muted);font-size:13px}.field{display:grid;gap:7px;margin:14px 0}.field>label,.legend{font-weight:700}input[type=text],select,textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:9px;background:#fff;padding:10px}textarea{min-height:88px;resize:vertical}.verdicts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.verdicts label,.defect{border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}.verdicts label{display:flex;gap:7px;align-items:center;justify-content:center;font-weight:700}.defect{display:grid;gap:8px;margin:8px 0}.defect-head{display:flex;gap:8px;align-items:center}.defect-settings{display:grid;grid-template-columns:minmax(110px,160px) 1fr;gap:8px}pre{white-space:pre-wrap;word-break:break-word;background:#f8f9fb;padding:12px;border-radius:8px;font-size:12px}.nav{position:fixed;bottom:0;left:0;right:0;z-index:5;justify-content:center;background:rgba(255,255,255,.97);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom))}.nav button{min-width:112px}.error{color:var(--danger);font-weight:700}.success{color:var(--ok);font-weight:700}.output{min-height:220px;font-family:ui-monospace,monospace;font-size:12px}.hidden{display:none!important}@media(max-width:560px){.verdicts{grid-template-columns:1fr}.defect-settings{grid-template-columns:1fr}.candidate{max-height:62vh}.nav button{min-width:96px;flex:1}}
  </style>
</head>
<body>
  <header><div class="header-row"><h1>MANGAI 非公開Human Review</h1><span id="progress" class="progress"></span></div></header>
  <main>
    <section class="notice" aria-label="安全上の注意">
      <p><strong>端末内だけで動作します。</strong>ネットワーク送信機能はありません。</p>
      <p>Reviewer A/Bは互いの回答、正解ラベル、AI監査を見ずに独立評価してください。</p>
      <p>ZIPを展開してから、このファイルをブラウザで開いてください。最終回答は必ずCLI validatorで検証してください。</p>
    </section>
    <section class="card">
      <div class="field"><label for="reviewer-id">Reviewer ID（英小文字・数字・_・-、3文字以上）</label><input id="reviewer-id" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="human-reviewer-a"></div>
      <label><input id="independent" type="checkbox"> 他のReviewer回答・正解ラベル・AI判定を見ず、独立して評価しています</label>
    </section>
    <section id="case-card" class="card" aria-live="polite"></section>
    <section class="card">
      <div class="actions">
        <button id="save-json" class="primary" type="button">回答JSONを保存</button>
        <button id="show-json" type="button">JSONを画面表示</button>
        <label><span class="hidden">回答JSONを読み込む</span><input id="import-json" type="file" accept="application/json,.json" aria-label="回答JSONを読み込む"></label>
        <button id="clear-draft" class="danger" type="button">端末内の下書きを消去</button>
      </div>
      <p id="status" role="status"></p>
      <textarea id="json-output" class="output hidden" readonly aria-label="出力JSON"></textarea>
    </section>
  </main>
  <nav class="nav" aria-label="ケース移動"><button id="previous" type="button">前へ</button><button id="next" type="button">次へ</button></nav>
  <script id="mangai-review-data" type="application/json">${data}</script>
  <script>
    (() => {
      "use strict";
      const data = JSON.parse(document.getElementById("mangai-review-data").textContent);
      const storageKey = "mangai-review:" + data.manifest.package_id + ":" + data.manifest.slot;
      const categoryLabels = {
        character_identity_mismatch:"人物同一性の不一致",character_count_mismatch:"人物数の不一致",expression_mismatch:"表情の不一致",anatomy_hand_error:"手の破綻",anatomy_body_distortion:"人体の歪み",object_fusion:"物体の融合",unwanted_text:"不要文字・疑似文字",unwanted_ui:"不要UI",unwanted_logo:"不要ロゴ",composition_mismatch:"指定構図の不一致",crop_error:"不適切な切れ",orientation_error:"向きの異常",gravity_error:"重力の異常",background_mismatch:"背景の不一致",prop_missing:"小物の欠落",prop_mismatch:"小物の不一致",style_inconsistency:"画風の不一致",low_readability:"視認性不足",other:"その他"
      };
      const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
      const blankRecords = () => data.order.map((caseId) => ({case_id:caseId,verdict:null,confidence:null,defects:[],overall_comment:""}));
      let state = {reviewer_id:"",records:blankRecords()};
      let index = 0;
      try {
        const draft = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (draft && Array.isArray(draft.records) && draft.records.length === data.order.length) state = draft;
      } catch {}
      const byId = new Map(data.manifest.cases.map((item) => [item.case_id,item]));
      const record = () => state.records[index];
      const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} };
      const setStatus = (message, success=false) => { const node=document.getElementById("status"); node.textContent=message; node.className=success?"success":"error"; };
      function render() {
        const current = record();
        const item = byId.get(current.case_id);
        document.getElementById("progress").textContent = (index+1)+" / "+data.order.length+"・"+current.case_id;
        document.getElementById("reviewer-id").value = state.reviewer_id;
        const selected = new Map(current.defects.map((defect) => [defect.category,defect]));
        const references = item.references.length ? '<div class="field"><span class="legend">参照画像</span><div class="reference-grid">'+item.references.map((reference)=>'<figure><img src="'+escapeHtml(reference.file)+'" alt="'+escapeHtml(reference.role)+'"><figcaption>'+escapeHtml(reference.role)+'</figcaption></figure>').join("")+'</div></div>' : "";
        const intended = data.intended[current.case_id] ? '<div class="field"><span class="legend">Panel Specification</span><pre>'+escapeHtml(JSON.stringify(data.intended[current.case_id],null,2))+'</pre></div>' : "";
        const defects = item.allowed_defect_categories.map((category) => {
          const value=selected.get(category); return '<div class="defect"><label class="defect-head"><input class="defect-toggle" type="checkbox" data-category="'+escapeHtml(category)+'" '+(value?'checked':'')+'> '+escapeHtml(categoryLabels[category]||category)+'</label><div class="defect-settings '+(value?'':'hidden')+'" data-settings="'+escapeHtml(category)+'"><select class="severity" data-category="'+escapeHtml(category)+'"><option value="minor" '+(value?.severity==='minor'?'selected':'')+'>軽微</option><option value="major" '+(!value||value.severity==='major'?'selected':'')+'>重大</option><option value="critical" '+(value?.severity==='critical'?'selected':'')+'>致命的</option></select><input class="defect-comment" data-category="'+escapeHtml(category)+'" value="'+escapeHtml(value?.comment||"")+'" maxlength="1000" placeholder="根拠（任意）"></div></div>';
        }).join("");
        document.getElementById("case-card").innerHTML = '<div class="case-title"><h2>'+escapeHtml(current.case_id)+'</h2><span class="mode">'+escapeHtml(item.review_mode)+'</span></div><img class="candidate" src="'+escapeHtml(item.candidate_file)+'" alt="評価対象 '+escapeHtml(current.case_id)+'">'+references+intended+'<fieldset class="field"><legend class="legend">総合判定</legend><div class="verdicts">'+["good","borderline","bad"].map((value)=>'<label><input name="verdict" type="radio" value="'+value+'" '+(current.verdict===value?'checked':'')+'> '+({good:"良好",borderline:"境界",bad:"不良"})[value]+'</label>').join("")+'</div></fieldset><div class="field"><label for="confidence">確信度 1〜5</label><select id="confidence"><option value="">未選択</option>'+[1,2,3,4,5].map((value)=>'<option value="'+value+'" '+(current.confidence===value?'selected':'')+'>'+value+'</option>').join("")+'</select></div><fieldset class="field"><legend class="legend">欠陥（該当するものだけ）</legend>'+defects+'</fieldset><div class="field"><label for="overall-comment">総合コメント</label><textarea id="overall-comment" maxlength="2000">'+escapeHtml(current.overall_comment)+'</textarea></div>';
        bindCaseEvents();
        document.getElementById("previous").disabled=index===0;
        document.getElementById("next").disabled=index===data.order.length-1;
      }
      function findDefect(category) { return record().defects.find((item)=>item.category===category); }
      function bindCaseEvents() {
        document.querySelectorAll('input[name="verdict"]').forEach((node)=>node.addEventListener("change",()=>{record().verdict=node.value;if(node.value==="good")record().defects=[];persist();render();}));
        document.getElementById("confidence").addEventListener("change",(event)=>{record().confidence=event.target.value?Number(event.target.value):null;persist();});
        document.getElementById("overall-comment").addEventListener("input",(event)=>{record().overall_comment=event.target.value;persist();});
        document.querySelectorAll(".defect-toggle").forEach((node)=>node.addEventListener("change",()=>{const category=node.dataset.category;if(node.checked){if(!findDefect(category))record().defects.push({category,severity:"major",bbox:null,comment:""});if(record().verdict==="good")record().verdict=null;}else record().defects=record().defects.filter((item)=>item.category!==category);persist();render();}));
        document.querySelectorAll(".severity").forEach((node)=>node.addEventListener("change",()=>{const value=findDefect(node.dataset.category);if(value)value.severity=node.value;persist();}));
        document.querySelectorAll(".defect-comment").forEach((node)=>node.addEventListener("input",()=>{const value=findDefect(node.dataset.category);if(value)value.comment=node.value;persist();}));
      }
      function completedResponse() {
        const reviewerId=state.reviewer_id.trim();
        if(!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(reviewerId))throw new Error("Reviewer IDを正しい形式で入力してください。");
        if(!document.getElementById("independent").checked)throw new Error("独立レビューの確認が必要です。");
        for(const item of state.records){
          if(!["good","bad","borderline"].includes(item.verdict)||!Number.isInteger(item.confidence))throw new Error(item.case_id+"の判定または確信度が未入力です。");
          if(item.verdict==="good"&&item.defects.length)throw new Error(item.case_id+"のgoodには欠陥を付けられません。");
          if(item.verdict==="bad"&&!item.defects.length)throw new Error(item.case_id+"のbadには欠陥が必要です。");
          if(item.verdict==="borderline"&&!item.defects.length&&!item.overall_comment.trim())throw new Error(item.case_id+"のborderlineには欠陥またはコメントが必要です。");
        }
        return {template_version:"mangai-human-review-v2",slot:data.manifest.slot,reviewer_id:reviewerId,reviewer_kind:"human",independent:true,reviewed_at:new Date().toISOString(),records:state.records};
      }
      function outputJson(download) {
        try {
          const json=JSON.stringify(completedResponse(),null,2)+"\\n";
          const output=document.getElementById("json-output"); output.value=json; output.classList.remove("hidden");
          if(download){const blob=new Blob([json],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=data.manifest.slot+"-review-response.private.json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
          setStatus("回答JSONを作成しました。CLI validatorで最終検証してください。",true);
        } catch(error) { setStatus(error instanceof Error?error.message:"回答を作成できませんでした。"); }
      }
      document.getElementById("reviewer-id").addEventListener("input",(event)=>{state.reviewer_id=event.target.value;persist();});
      document.getElementById("previous").addEventListener("click",()=>{if(index>0){index-=1;render();scrollTo({top:0,behavior:"smooth"});}});
      document.getElementById("next").addEventListener("click",()=>{if(index<data.order.length-1){index+=1;render();scrollTo({top:0,behavior:"smooth"});}});
      document.getElementById("save-json").addEventListener("click",()=>outputJson(true));
      document.getElementById("show-json").addEventListener("click",()=>outputJson(false));
      document.getElementById("clear-draft").addEventListener("click",()=>{if(confirm("端末内の下書きを消去しますか？")){localStorage.removeItem(storageKey);state={reviewer_id:"",records:blankRecords()};index=0;render();setStatus("下書きを消去しました。",true);}});
      document.getElementById("import-json").addEventListener("change",(event)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const value=JSON.parse(String(reader.result));if(value.template_version!=="mangai-human-review-v2"||value.slot!==data.manifest.slot||value.reviewer_kind!=="human"||value.independent!==true)throw new Error();const ids=value.records?.map((item)=>item.case_id);if(JSON.stringify(ids)!==JSON.stringify(data.order))throw new Error();state={reviewer_id:value.reviewer_id||"",records:value.records};persist();render();setStatus("回答JSONを読み込みました。",true);}catch{setStatus("このパッケージ用の回答JSONではありません。");}};reader.readAsText(file);});
      render();
    })();
  </script>
</body>
</html>\n`;
}
