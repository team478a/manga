export type DezgoFeatureFlags = {
  dezgoProviderEnabled: boolean;
  dezgoDirectByokEnabled: boolean;
  dezgoAdultGenerationEnabled: false;
  dezgoBatchGenerationEnabled: false;
};

const enabled = (value: string | undefined) => value === "true";

export function resolveDezgoFeatureFlags(input: {
  isPackaged: boolean;
  environment?: NodeJS.ProcessEnv;
}): DezgoFeatureFlags {
  const environment = input.environment ?? process.env;
  const developmentProviderEnabled =
    !input.isPackaged && enabled(environment.MANGAI_ENABLE_DEZGO_PROVIDER);
  return {
    dezgoProviderEnabled: developmentProviderEnabled,
    dezgoDirectByokEnabled:
      developmentProviderEnabled &&
      enabled(environment.MANGAI_ENABLE_DEZGO_DIRECT_BYOK),
    // These capabilities stay impossible to enable during Phase 1.
    dezgoAdultGenerationEnabled: false,
    dezgoBatchGenerationEnabled: false,
  };
}
