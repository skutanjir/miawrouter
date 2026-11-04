import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadTranslations } from "../../src/i18n/runtime.js";

afterEach(() => vi.unstubAllGlobals());

describe("runtime translations on reused React text nodes", () => {
  it("keeps new route titles and live counts while preserving locale switching", async () => {
    const parent = { tagName: "H1", hasAttribute: () => false, parentElement: null };
    const title = { nodeValue: "CLI Tools", parentElement: parent };
    const count = { nodeValue: "10", parentElement: parent };
    const nodes = [title, count];
    const doc = {
      cookie: "locale=en",
      body: {},
      createTreeWalker: () => {
        let index = 0;
        return { nextNode: () => nodes[index++] || null };
      },
    };
    vi.stubGlobal("document", doc);
    vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ "MITM Proxy": "Proksi MITM" }) })));

    await reloadTranslations();
    title.nodeValue = "MITM Proxy";
    count.nodeValue = "12";
    await reloadTranslations();
    expect(title.nodeValue).toBe("MITM Proxy");
    expect(count.nodeValue).toBe("12");

    doc.cookie = "locale=id";
    await reloadTranslations();
    expect(title.nodeValue).toBe("Proksi MITM");
    await reloadTranslations();
    expect(title.nodeValue).toBe("Proksi MITM");
    doc.cookie = "locale=en";
    await reloadTranslations();
    expect(title.nodeValue).toBe("MITM Proxy");
    expect(count.nodeValue).toBe("12");
  });
});
