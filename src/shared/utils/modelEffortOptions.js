import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";

const effortSuffix = /\((none|minimal|low|medium|high|xhigh|max|ultra|thinking)\)$/;

export function expandModelEffortOptions(provider, models, mode = "auto", metadata = []) {
  if (mode === "auto") return models;
  const seen = new Set();
  const result = [];
  const append = (model) => {
    if (seen.has(model.value)) return;
    seen.add(model.value);
    result.push(model);
  };
  for (const model of models) {
    if (model.isPlaceholder || (model.kind && model.kind !== "llm")) {
      append(model);
      continue;
    }
    const fixed = model.id.match(effortSuffix);
    if (fixed) {
      if (mode === "all" || fixed[1] === mode) append(model);
      continue;
    }
    const declared = metadata.find((entry) => entry.id === model.id);
    const levels = getThinkingLevels(provider, model.id, declared || model);
    if (!levels?.length) {
      append(model);
      continue;
    }
    if (mode === "all") append(model);
    for (const level of levels) {
      if (mode !== "all" && level !== mode) continue;
      append({ ...model, id: `${model.id}(${level})`, value: `${model.value}(${level})`, name: `${model.name || model.id} (${level})` });
    }
    if (mode !== "all" && !levels.includes(mode)) append(model);
  }
  return result;
}
