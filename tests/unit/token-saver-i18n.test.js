import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Token Saver Quick Presets i18n Localization", () => {
  it("TokenSaverClient has no hardcoded Indonesian preset names or descriptions", () => {
    const clientSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/(dashboard)/dashboard/token-saver/TokenSaverClient.js"),
      "utf-8"
    );

    // Verify old Indonesian literals are absent
    expect(clientSource).not.toContain('"Maksimal Hemat"');
    expect(clientSource).not.toContain('"Hemat Maksimal"');
    expect(clientSource).not.toContain('"Seimbang (Rekomendasi)"');
    expect(clientSource).not.toContain('"Stabil & Aman"');
    expect(clientSource).not.toContain('"Tanpa Filter"');
    expect(clientSource).not.toContain("Profil Penghematan Cepat (Quick Presets)");
    expect(clientSource).not.toContain("Terapkan Profil");

    // Verify canonical English equivalents are present
    expect(clientSource).toContain('"Maximum Savings"');
    expect(clientSource).toContain('"Balanced (Recommended)"');
    expect(clientSource).toContain('"Developer Pro"');
    expect(clientSource).toContain('"Passthrough (Off)"');
    expect(clientSource).toContain("Quick Presets (Token Saver Profiles)");
    expect(clientSource).toContain("Apply Profile");
  });

  it("public/i18n/literals/id.json contains entries for all new English strings", () => {
    const idJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../public/i18n/literals/id.json"), "utf-8")
    );

    const expectedKeys = [
      "Quick Presets (Token Saver Profiles)",
      "Choose a 1-click ready-to-use strategy for optimal performance and token savings without complex manual configuration.",
      "Current Profile:",
      "Maximum Savings",
      "Balanced (Recommended)",
      "Stable & Safe",
      "No Filters",
      "Active Profile",
      "Apply Profile",
      "Applied Successfully!",
      "Tool Compression (RTK)",
      "Trigger Threshold",
      "Immediate (0 tokens)",
    ];

    for (const key of expectedKeys) {
      expect(idJson[key], `Missing translation key: "${key}"`).toBeDefined();
      expect(typeof idJson[key]).toBe("string");
      expect(idJson[key].length).toBeGreaterThan(0);
    }
  });
});
