// Cancel superseded reads and ignore late responses, including page unmounts.
export function createLatestGenerationReader<T>(load: (signal: AbortSignal) => Promise<T>) {
  let active = true;
  let version = 0;
  let controller: AbortController | null = null;
  return {
    activate() { active = true; },
    dispose() { active = false; version++; controller?.abort(); },
    async read(): Promise<T | null> {
      if (!active) return null;
      const requestedVersion = ++version;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const value = await load(request.signal);
        return active && requestedVersion === version && !request.signal.aborted ? value : null;
      } catch (error) {
        if (!active || requestedVersion !== version || request.signal.aborted) return null;
        throw error;
      } finally {
        if (controller === request) controller = null;
      }
    },
  };
}
