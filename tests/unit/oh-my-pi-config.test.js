import { describe, expect, it } from "vitest";
import { buildOhMyPiProvider, mergeOhMyPiModels } from "../../src/app/api/cli-tools/oh-my-pi-settings/config.js";

describe("Oh My Pi auto configuration", () => {
  it("adds MiawRouter without removing existing providers", () => {
    const existing = `providers:\n  anthropic:\n    api: anthropic\n`;
    const result = mergeOhMyPiModels(existing, buildOhMyPiProvider("http://localhost:21128/v1", "sk-test", "deepseek/deepseek-flash"));

    expect(result).toContain("anthropic:");
    expect(result).toContain("miawrouter:");
    expect(result).toContain('baseUrl: "http://localhost:21128/v1"');
    expect(result).toContain('id: "deepseek/deepseek-flash"');
  });

  it("replaces the previous MiawRouter provider instead of duplicating it", () => {
    const existing = `providers:\n  miawrouter:\n    api: openai-completions\n    models:\n      - id: "old/model"\n`;
    const result = mergeOhMyPiModels(existing, buildOhMyPiProvider("http://localhost:21128/v1", "sk-test", "new/model"));

    expect(result.match(/^[ ]{2}miawrouter:/gm)).toHaveLength(1);
    expect(result).not.toContain('id: "old/model"');
    expect(result).toContain('id: "new/model"');
  });
});
