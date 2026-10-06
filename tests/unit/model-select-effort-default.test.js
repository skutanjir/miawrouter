import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import ModelSelectModal from "../../src/shared/components/ModelSelectModal.js";

globalThis.React = React;

describe("model picker initial effort options", () => {
  it("shows Codex Luna and Sol efforts immediately for single-selection subagents", () => {
    const html = renderToStaticMarkup(React.createElement(ModelSelectModal, {
      isOpen: true,
      onClose: () => {},
      onSelect: () => {},
      activeProviders: [{ provider: "codex" }, { provider: "opencode-go" }],
    }));
    expect(html).toContain('value="all" selected=""');
    expect(html).toContain("GPT 6 Luna (max)");
    expect(html).toContain("GPT 6 Sol (ultra)");
    expect(html.split("GPT 6 Luna (max)").length - 1).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("Changes are saved automatically");
  });
});
