export type CredentialProviderId = "dezgo";

type KeyringEntry = {
  setPassword(password: string, signal?: AbortSignal): Promise<void>;
  getPassword(signal?: AbortSignal): Promise<string | undefined>;
  deleteCredential(signal?: AbortSignal): Promise<boolean>;
};

type KeyringEntryFactory = (
  service: string,
  account: string,
) => Promise<KeyringEntry>;

const SERVICE = "MANGAI Desktop";
const accounts: Record<CredentialProviderId, string> = {
  dezgo: "image-provider.dezgo.api-key",
};

const defaultFactory: KeyringEntryFactory = async (service, account) => {
  const { AsyncEntry } = await import("@napi-rs/keyring");
  return new AsyncEntry(service, account);
};

export class ProviderCredentialError extends Error {
  constructor(
    public readonly code:
      | "CREDENTIAL_INVALID"
      | "CREDENTIAL_STORE_UNAVAILABLE"
      | "CREDENTIAL_READ_FAILED"
      | "CREDENTIAL_WRITE_FAILED"
      | "CREDENTIAL_DELETE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ProviderCredentialError";
  }
}

export class ProviderCredentialStore {
  constructor(private readonly createEntry = defaultFactory) {}

  private async entry(providerId: CredentialProviderId) {
    try {
      return await this.createEntry(SERVICE, accounts[providerId]);
    } catch {
      throw new ProviderCredentialError(
        "CREDENTIAL_STORE_UNAVAILABLE",
        "OSの資格情報ストアを利用できません。",
      );
    }
  }

  async set(
    providerId: CredentialProviderId,
    secret: string,
    signal?: AbortSignal,
  ) {
    const normalized = secret.trim();
    if (normalized.length < 8 || normalized.length > 4096)
      throw new ProviderCredentialError(
        "CREDENTIAL_INVALID",
        "APIキーの形式が正しくありません。",
      );
    const entry = await this.entry(providerId);
    try {
      await entry.setPassword(normalized, signal);
    } catch {
      throw new ProviderCredentialError(
        "CREDENTIAL_WRITE_FAILED",
        "APIキーをOSの資格情報ストアへ保存できませんでした。",
      );
    }
  }

  async get(providerId: CredentialProviderId, signal?: AbortSignal) {
    const entry = await this.entry(providerId);
    try {
      return (await entry.getPassword(signal)) ?? null;
    } catch {
      throw new ProviderCredentialError(
        "CREDENTIAL_READ_FAILED",
        "OSの資格情報ストアからAPIキーを読み取れませんでした。",
      );
    }
  }

  async has(providerId: CredentialProviderId, signal?: AbortSignal) {
    return Boolean(await this.get(providerId, signal));
  }

  async delete(providerId: CredentialProviderId, signal?: AbortSignal) {
    const entry = await this.entry(providerId);
    try {
      return await entry.deleteCredential(signal);
    } catch {
      throw new ProviderCredentialError(
        "CREDENTIAL_DELETE_FAILED",
        "OSの資格情報ストアからAPIキーを削除できませんでした。",
      );
    }
  }
}
