import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Playground & Basic Chat Layout Matching", () => {
  it("DashboardLayout applies chat container styling to both basic-chat and playground", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/shared/components/layouts/DashboardLayout.js"),
      "utf-8"
    );
    expect(layoutSource).toMatch(/\/dashboard\/playground/);
    expect(layoutSource).toMatch(/isChatPage|\/dashboard\/basic-chat.*\/dashboard\/playground|\/dashboard\/playground.*\/dashboard\/basic-chat/);
  });

  it("BasicChatPageClient root div does not have overflow-hidden that clips popups", () => {
    const chatSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/(dashboard)/dashboard/basic-chat/BasicChatPageClient.js"),
      "utf-8"
    );
    const outerWrapperMatch = chatSource.match(/return\s*\(\s*<div className="([^"]+)"/);
    expect(outerWrapperMatch).not.toBeNull();
    const classNames = outerWrapperMatch[1];
    expect(classNames).not.toContain("overflow-hidden");
  });
});
