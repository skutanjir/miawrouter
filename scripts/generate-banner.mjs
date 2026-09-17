import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function generateBanner() {
  const mascotBase64 = fs.readFileSync(path.join(rootDir, "public/miawrouter-mascot-router.png")).toString("base64");
  const mascotDataUri = `data:image/png;base64,${mascotBase64}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    width: 1280px;
    height: 640px;
    overflow: hidden;
    background: #070c18;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #f1f5f9;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 64px;
  }

  /* Ambient light spots */
  .glow-top-left {
    position: absolute;
    top: -140px;
    left: -100px;
    width: 550px;
    height: 550px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(2, 132, 199, 0.08) 50%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
  }

  .glow-bottom-right {
    position: absolute;
    bottom: -150px;
    right: -80px;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(59, 130, 246, 0.1) 45%, transparent 70%);
    filter: blur(70px);
    pointer-events: none;
  }

  /* Subtle cybernetic grid */
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(ellipse at 50% 50%, black 50%, transparent 95%);
    pointer-events: none;
  }

  /* Outer fine border */
  .outer-frame {
    position: absolute;
    inset: 14px;
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 20px;
    pointer-events: none;
    z-index: 20;
  }

  /* Left Column */
  .left-col {
    position: relative;
    z-index: 10;
    max-width: 670px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .release-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(14, 165, 233, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 700;
    color: #38bdf8;
    letter-spacing: 0.4px;
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 10px #38bdf8;
  }

  .sub-tag {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.2px;
  }

  .brand-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .brand-name {
    font-size: 66px;
    font-weight: 800;
    line-height: 1.0;
    letter-spacing: -1.8px;
    color: #ffffff;
  }

  .brand-name .accent {
    background: linear-gradient(135deg, #38bdf8 0%, #00f0ff 55%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 30px rgba(56, 189, 248, 0.45));
  }

  .brand-tagline {
    font-size: 21px;
    font-weight: 600;
    color: #cbd5e1;
    letter-spacing: -0.2px;
  }

  .brand-desc {
    font-size: 15px;
    line-height: 1.55;
    color: #94a3b8;
    max-width: 610px;
  }

  .brand-desc strong {
    color: #e2e8f0;
    font-weight: 600;
  }

  /* Feature Grid */
  .feature-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 2px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 13px;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(56, 189, 248, 0.18);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .pill-icon {
    font-size: 14px;
  }

  /* Quick Install Box */
  .install-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 18px;
    background: rgba(10, 18, 36, 0.9);
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-radius: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13.5px;
    width: fit-content;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 20px rgba(56, 189, 248, 0.1);
    margin-top: 4px;
  }

  .install-prompt {
    color: #64748b;
    user-select: none;
    font-weight: 700;
  }

  .install-cmd {
    color: #38bdf8;
    font-weight: 600;
  }

  .install-arg {
    color: #f8fafc;
  }

  /* Right Column (Window Card) */
  .right-col {
    position: relative;
    z-index: 10;
    width: 440px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .device-window {
    width: 410px;
    background: #101726;
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 20px;
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.75),
      0 0 50px rgba(14, 165, 233, 0.22);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .window-header {
    height: 38px;
    background: #0b111e;
    border-bottom: 1px solid rgba(56, 189, 248, 0.15);
    display: flex;
    align-items: center;
    padding: 0 16px;
    justify-content: space-between;
  }

  .window-dots {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot-red { background: #f87171; }
  .dot-yellow { background: #fbbf24; }
  .dot-green { background: #34d399; }

  .window-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    color: #94a3b8;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .window-body {
    background: #131b26;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 20px 18px 20px;
    position: relative;
  }

  .mascot-display {
    width: 315px;
    height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .mascot-display img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 16px;
    border: 1px solid rgba(56, 189, 248, 0.28);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65), 0 0 40px rgba(56, 189, 248, 0.25);
  }

  .status-footer {
    width: 100%;
    margin-top: 14px;
    background: rgba(11, 17, 30, 0.85);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
  }

  .footer-live {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #34d399;
  }

  .green-ping {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
  }

  .footer-port {
    font-family: 'JetBrains Mono', monospace;
    color: #38bdf8;
    letter-spacing: 0.2px;
  }

  .footer-stats {
    color: #94a3b8;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="glow-top-left"></div>
  <div class="glow-bottom-right"></div>
  <div class="outer-frame"></div>

  <div class="left-col">
    <div class="badge-row">
      <div class="release-badge">
        <span class="pulse-dot"></span>
        <span>v1.1.0 • PRODUCTION RELEASE</span>
      </div>
      <span class="sub-tag">OPENAI &bull; CLAUDE &bull; GEMINI COMPAT</span>
    </div>

    <div class="brand-header">
      <h1 class="brand-name">Miaw<span class="accent">Router</span></h1>
      <p class="brand-tagline">Universal Local AI Routing Gateway</p>
    </div>

    <p class="brand-desc">
      One OpenAI-compatible endpoint (<code style="color:#38bdf8; font-family:'JetBrains Mono'">/v1/*</code>) for <strong>40+ LLMs</strong>, subscription OAuth session extraction, transparent <strong>IDE MITM interception</strong> (Antigravity, Cursor, Copilot), and fail-open <strong>L0–L3 caching</strong>. Runs 100% locally with zero key leakage.
    </p>

    <div class="feature-pills">
      <div class="pill">
        <span class="pill-icon">⚡</span>
        <span>40+ AI Providers</span>
      </div>
      <div class="pill">
        <span class="pill-icon">🔌</span>
        <span>OpenAI / Anthropic / Gemini Wire</span>
      </div>
      <div class="pill">
        <span class="pill-icon">🛡️</span>
        <span>Mode 0600 Zero-Leak Security</span>
      </div>
      <div class="pill">
        <span class="pill-icon">🎯</span>
        <span>IDE MITM Interceptor</span>
      </div>
      <div class="pill">
        <span class="pill-icon">💾</span>
        <span>L0–L3 Token Saver</span>
      </div>
      <div class="pill">
        <span class="pill-icon">🖥️</span>
        <span>Self-Hosted & Local Models</span>
      </div>
    </div>

    <div class="install-box">
      <span class="install-prompt">$</span>
      <span class="install-cmd">npm install -g</span>
      <span class="install-arg">miawrouter</span>
      <span class="install-prompt">&amp;&amp;</span>
      <span class="install-arg">miawrouter</span>
    </div>
  </div>

  <div class="right-col">
    <div class="device-window">
      <div class="window-header">
        <div class="window-dots">
          <span class="dot dot-red"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-green"></span>
        </div>
        <span class="window-title">miawrouter-gateway:21128</span>
        <div style="width: 32px"></div>
      </div>
      <div class="window-body">
        <div class="mascot-display">
          <img src="${mascotDataUri}" alt="MiawRouter Mascot">
        </div>
        <div class="status-footer">
          <div class="footer-live">
            <span class="green-ping"></span>
            <span>Gateway Ready</span>
          </div>
          <span class="footer-port">127.0.0.1:21128</span>
          <span class="footer-stats">~2ms &bull; 0600 OK</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  console.log("Launching Chromium to render updated banner...");
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 2, // 2x Retina sharpness (2560x1280)
  });

  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const outputPath = path.join(rootDir, "public/miawrouter-banner.png");
  await page.screenshot({
    path: outputPath,
    type: "png",
  });

  console.log(`✅ Banner generated successfully at: ${outputPath}`);

  const artifactDir = "/home/fajar/.gemini/antigravity-cli/brain/1fdf0d3c-3732-4655-bcee-1e65e8d76b63";
  if (fs.existsSync(artifactDir)) {
    const artifactPath = path.join(artifactDir, "miawrouter-banner.png");
    fs.copyFileSync(outputPath, artifactPath);
    console.log(`✅ Copied to artifact directory: ${artifactPath}`);
  }

  await browser.close();
}

generateBanner().catch((err) => {
  console.error("Error generating banner:", err);
  process.exit(1);
});
