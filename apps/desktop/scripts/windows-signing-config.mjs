const nonEmpty = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const uniqueConfiguredValue = (env, names, label) => {
  const values = names.map((name) => nonEmpty(env[name])).filter(Boolean);
  if (new Set(values).size > 1)
    throw new Error(`${label}が複数の異なる値で設定されています。`);
  return values[0] ?? "";
};

export const resolveWindowsSigningConfig = (
  env = process.env,
  platform = process.platform,
) => {
  const certificateLink = uniqueConfiguredValue(
    env,
    ["WIN_CSC_LINK", "CSC_LINK"],
    "PFX証明書",
  );
  const certificatePassword = uniqueConfiguredValue(
    env,
    ["WIN_CSC_KEY_PASSWORD", "CSC_KEY_PASSWORD"],
    "PFX証明書のパスワード",
  );
  const certificateSha1 = nonEmpty(env.MANGAI_WIN_CERTIFICATE_SHA1);

  if (certificateLink && certificateSha1)
    throw new Error(
      "PFX方式とWindows証明書ストア方式を同時には使用できません。",
    );
  if (certificateLink || certificatePassword) {
    if (!certificateLink || !certificatePassword)
      throw new Error("PFX方式には証明書とパスワードの両方が必要です。");
    return { mode: "pfx", builderArguments: [] };
  }
  if (certificateSha1) {
    if (platform !== "win32")
      throw new Error(
        "Windows証明書ストア方式はWindowsビルド端末でのみ使用できます。",
      );
    if (!/^[0-9a-fA-F]{40}$/.test(certificateSha1))
      throw new Error(
        "MANGAI_WIN_CERTIFICATE_SHA1は40桁の16進数で指定してください。",
      );
    return {
      mode: "certificate-store",
      builderArguments: [
        `--config.win.signtoolOptions.certificateSha1=${certificateSha1.toUpperCase()}`,
      ],
    };
  }
  throw new Error(
    "署名証明書が未設定です。PFX方式またはWindows証明書ストア方式を設定してください。",
  );
};
