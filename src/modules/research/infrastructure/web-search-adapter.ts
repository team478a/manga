export type ResearchWebSearchAdapter<Input, Output> = {
  search(input: Input): Promise<Output>;
};
