import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { MITM_TOOLS } from "../../src/shared/constants/cliTools.js";

const require = createRequire(import.meta.url);
const { TOOL_HOSTS } = require("../../src/shared/constants/mitmToolHosts.js");
const { TARGET_HOSTS, URL_PATTERNS, getToolForHost } = require("../../src/mitm/config.js");

// Every DNS-redirected host must resolve to a tool that also has a URL pattern
// and a UI card. A host whose getToolForHost() result lacks a handler entry in
// server.js crashes dispatch, so keep these four maps in lockstep.
describe("MITM tool host wiring", () => {
  it.each(Object.entries(TOOL_HOSTS))("wires %s consistently", (tool, hosts) => {
    expect(MITM_TOOLS[tool], `${tool} needs a MITM_TOOLS card`).toBeTruthy();
    expect(URL_PATTERNS[tool]?.length, `${tool} needs URL_PATTERNS`).toBeGreaterThan(0);
    for (const host of hosts) {
      expect(TARGET_HOSTS).toContain(host);
      expect(getToolForHost(host)).toBe(tool);
    }
  });

  it("keeps the generic JSON tools pointed at dedicated API hosts", () => {
    expect(getToolForHost("cli-chat-proxy.grok.com")).toBe("grok-cli");
    expect(getToolForHost("apis.iflow.cn")).toBe("iflow");
  });
});
