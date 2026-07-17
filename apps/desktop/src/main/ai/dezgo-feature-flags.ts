export type DezgoFeatureFlags = {
  dezgoProviderEnabled: boolean;
  dezgoDirectByokEnabled: boolean;
  dezgoDispatchEnabled: boolean;
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
  const developmentByokEnabled =
    developmentProviderEnabled &&
    enabled(environment.MANGAI_ENABLE_DEZGO_DIRECT_BYOK);
  return {
    dezgoProviderEnabled: developmentProviderEnabled,
    dezgoDirectByokEnabled: developmentByokEnabled,
    dezgoDispatchEnabled:
      developmentByokEnabled &&
      enabled(environment.MANGAI_ENABLE_DEZGO_DISPATCH),
    // These capabilities stay impossible to enable during Phase 1.
    dezgoAdultGenerationEnabled: false,
    dezgoBatchGenerationEnabled: false,
  };
}
