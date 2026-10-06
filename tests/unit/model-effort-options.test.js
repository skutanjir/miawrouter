import { describe, it, expect } from "vitest";
import { expandModelEffortOptions } from "../../src/shared/utils/modelEffortOptions.js";

describe("combo model effort options", () => {
  const model = { id: "gpt-6-luna", name: "GPT 6 Luna", value: "cx/gpt-6-luna" };
  it("keeps Auto IDs unchanged", () => {
    expect(expandModelEffortOptions("codex", [model])).toEqual([model]);
  });
  it("uses Codex-supported suffixes and deduplicates existing presets", () => {
    const fixed = { ...model, id: `${model.id}(high)`, value: `${model.value}(high)` };
    const result = expandModelEffortOptions("codex", [model, fixed], "all");
    expect(result.filter((entry) => entry.value === "cx/gpt-6-luna(high)")).toHaveLength(1);
    expect(result.map((entry) => entry.value)).toContain("cx/gpt-6-luna(max)");
    expect(result.map((entry) => entry.value)).not.toContain("cx/gpt-6-luna(ultra)");
  });
  it("uses saved custom metadata with a compatible provider prefix", () => {
    const custom = { id: "private-reasoner", name: "Private", value: "team/private-reasoner", isCustom: true };
    expect(expandModelEffortOptions("openai-compatible-test", [custom], "high", [{ id: custom.id, reasoningLevels: ["low", "high"] }])[0].value).toBe("team/private-reasoner(high)");
    expect(expandModelEffortOptions("openai-compatible-test", [custom], "max", [{ id: custom.id, reasoningLevels: ["low", "high"] }])).toEqual([custom]);
  });
  it("preserves placeholders and typed models", () => {
    const entries = [{ ...model, kind: "image" }, { id: "__placeholder__", value: "x/model-id", isPlaceholder: true }];
    expect(expandModelEffortOptions("codex", entries, "all")).toEqual(entries);
  });
});
