import { createHash, randomBytes, webcrypto } from "node:crypto";

export const SECURE_REVIEW_TRANSFER_VERSION = "mangai-secure-review-transfer-v1";
export const SECURE_REVIEW_TRANSFER_ITERATIONS = 310_000;
export const SECURE_REVIEW_TRANSFER_AAD_PREFIX = "MANGAI secure human review transfer";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function decodePassphraseFile(text) {
  const passphrase = text.replace(/\r?\n$/, "");
  if (passphrase.includes("\n") || passphrase.includes("\r")) throw new Error("review_transfer_passphrase_multiline_forbidden");
  if (passphrase.length < 24) throw new Error("review_transfer_passphrase_too_short");
  if (passphrase.includes("\0")) throw new Error("review_transfer_passphrase_invalid");
  return passphrase;
}

export function buildAdditionalData(payloadSha256, payloadBytes) {
  return new TextEncoder().encode(`${SECURE_REVIEW_TRANSFER_AAD_PREFIX}\n${SECURE_REVIEW_TRANSFER_VERSION}\n${payloadSha256}\n${payloadBytes}`);
}

async function deriveKey(passphrase, salt, usages) {
  const material = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return webcrypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: SECURE_REVIEW_TRANSFER_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function encryptReviewPackage(packageBytes, passphrase, entropy = {}) {
  const salt = entropy.salt ?? randomBytes(16);
  const iv = entropy.iv ?? randomBytes(12);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("review_transfer_entropy_invalid");
  const payloadSha256 = sha256(packageBytes);
  const additionalData = buildAdditionalData(payloadSha256, packageBytes.length);
  const key = await deriveKey(passphrase, salt, ["encrypt"]);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData, tagLength: 128 },
    key,
    packageBytes,
  );
  return {
    version: SECURE_REVIEW_TRANSFER_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: SECURE_REVIEW_TRANSFER_ITERATIONS,
      salt_base64: Buffer.from(salt).toString("base64"),
    },
    cipher: {
      name: "AES-GCM",
      key_bits: 256,
      tag_bits: 128,
      iv_base64: Buffer.from(iv).toString("base64"),
    },
    payload: {
      mime_type: "application/zip",
      download_name: "mangai-review.zip",
      byte_length: packageBytes.length,
      sha256: payloadSha256,
      ciphertext_base64: Buffer.from(encrypted).toString("base64"),
    },
  };
}

export function validateEnvelopeShape(envelope) {
  if (!envelope || envelope.version !== SECURE_REVIEW_TRANSFER_VERSION) throw new Error("review_transfer_version_invalid");
  if (envelope.kdf?.name !== "PBKDF2" || envelope.kdf?.hash !== "SHA-256" || envelope.kdf?.iterations !== SECURE_REVIEW_TRANSFER_ITERATIONS)
    throw new Error("review_transfer_kdf_invalid");
  if (envelope.cipher?.name !== "AES-GCM" || envelope.cipher?.key_bits !== 256 || envelope.cipher?.tag_bits !== 128)
    throw new Error("review_transfer_cipher_invalid");
  if (envelope.payload?.mime_type !== "application/zip" || envelope.payload?.download_name !== "mangai-review.zip")
    throw new Error("review_transfer_payload_contract_invalid");
  if (!Number.isSafeInteger(envelope.payload.byte_length) || envelope.payload.byte_length <= 0)
    throw new Error("review_transfer_payload_length_invalid");
  if (!/^[a-f0-9]{64}$/.test(envelope.payload.sha256 ?? "")) throw new Error("review_transfer_payload_checksum_invalid");
  const salt = Buffer.from(envelope.kdf.salt_base64 ?? "", "base64");
  const iv = Buffer.from(envelope.cipher.iv_base64 ?? "", "base64");
  const ciphertext = Buffer.from(envelope.payload.ciphertext_base64 ?? "", "base64");
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length <= 16) throw new Error("review_transfer_envelope_encoding_invalid");
  return { salt, iv, ciphertext };
}

export async function decryptReviewPackage(envelope, passphrase) {
  const { salt, iv, ciphertext } = validateEnvelopeShape(envelope);
  const additionalData = buildAdditionalData(envelope.payload.sha256, envelope.payload.byte_length);
  const key = await deriveKey(passphrase, salt, ["decrypt"]);
  let decrypted;
  try {
    decrypted = await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: 128 },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("review_transfer_decryption_failed");
  }
  const bytes = Buffer.from(decrypted);
  if (bytes.length !== envelope.payload.byte_length || sha256(bytes) !== envelope.payload.sha256)
    throw new Error("review_transfer_payload_integrity_failed");
  return bytes;
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function buildSecureReviewTransferHtml(envelope) {
  validateEnvelopeShape(envelope);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
  <title>MANGAI 安全なレビューパッケージ</title>
  <style>
    :root{color-scheme:light;font-family:system-ui,-apple-system,sans-serif;background:#f5f3ff;color:#172033}
    *{box-sizing:border-box}body{margin:0;padding:24px 16px}.card{max-width:560px;margin:auto;background:#fff;border:1px solid #ddd6fe;border-radius:18px;padding:24px;box-shadow:0 12px 32px #312e8120}
    h1{font-size:1.35rem;margin:0 0 12px}.notice{background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:12px;line-height:1.6}label{display:block;font-weight:700;margin:20px 0 8px}
    input,button{width:100%;min-height:48px;border-radius:10px;font:inherit}input{border:1px solid #94a3b8;padding:10px 12px}button{border:0;background:#5b21b6;color:#fff;font-weight:700;margin-top:12px;padding:10px}
    button:disabled{opacity:.55}.status{min-height:3em;margin-top:16px;white-space:pre-wrap;line-height:1.6}.meta{font-size:.82rem;color:#64748b;overflow-wrap:anywhere;margin-top:16px}
  </style>
</head>
<body>
  <main class="card">
    <h1>レビューパッケージを開く</h1>
    <p class="notice">この画面は外部通信を行いません。送信者から別経路で受け取ったパスフレーズを入力してください。パスフレーズを同じメッセージや同じ共有先へ保存しないでください。</p>
    <label for="passphrase">パスフレーズ</label>
    <input id="passphrase" type="password" autocomplete="off" autocapitalize="none" spellcheck="false">
    <button id="unlock" type="button">復号してZIPを保存</button>
    <div id="status" class="status" role="status" aria-live="polite"></div>
    <div class="meta">復号後SHA-256: ${envelope.payload.sha256}</div>
  </main>
  <script id="mangai-secure-review-data" type="application/json">${safeJson(envelope)}</script>
  <script>
    const data=JSON.parse(document.getElementById("mangai-secure-review-data").textContent);
    const field=document.getElementById("passphrase"),button=document.getElementById("unlock"),status=document.getElementById("status");
    const b64=value=>{const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes};
    const hex=bytes=>[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
    const aad=()=>new TextEncoder().encode("${SECURE_REVIEW_TRANSFER_AAD_PREFIX}\\n${SECURE_REVIEW_TRANSFER_VERSION}\\n"+data.payload.sha256+"\\n"+data.payload.byte_length);
    if(!globalThis.crypto?.subtle){button.disabled=true;status.textContent="このブラウザでは安全な復号機能を利用できません。最新版のChrome、Edge、Safariでファイルを開いてください。"}
    button.addEventListener("click",async()=>{
      const passphrase=field.value;field.value="";if(passphrase.length<24){status.textContent="パスフレーズを確認してください。";return}
      button.disabled=true;status.textContent="復号と整合性確認を実行しています…";
      try{
        const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(passphrase),"PBKDF2",false,["deriveKey"]);
        const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:b64(data.kdf.salt_base64),iterations:data.kdf.iterations},material,{name:"AES-GCM",length:256},false,["decrypt"]);
        const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(data.cipher.iv_base64),additionalData:aad(),tagLength:128},key,b64(data.payload.ciphertext_base64));
        const digest=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",plain)));
        if(plain.byteLength!==data.payload.byte_length||digest!==data.payload.sha256)throw new Error("integrity");
        const url=URL.createObjectURL(new Blob([plain],{type:data.payload.mime_type}));const link=document.createElement("a");link.href=url;link.download=data.payload.download_name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
        status.textContent="整合性確認に成功しました。保存したZIPを展開して review.html を開いてください。回答回収後はZIPとこのHTMLを端末から削除してください。";
      }catch{status.textContent="復号できませんでした。パスフレーズまたはファイルの整合性を確認してください。"}
      finally{button.disabled=false}
    });
  </script>
</body>
</html>`;
}
