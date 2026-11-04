import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("MITM development capture", () => {
  it("is opt-in and redacts credential headers and query strings", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "miaw-mitm-privacy-"));
    const configPath = path.resolve("src/mitm/config.js");
    const loggerPath = path.resolve("src/mitm/logger.js");
    const script = `const c=require(${JSON.stringify(configPath)}); const l=require(${JSON.stringify(loggerPath)}); const fs=require('fs'); let text=''; if(c.ENABLE_FILE_LOG){const file=l.dumpRequest({method:'POST',url:'/v1?key=sensitive-query',headers:{host:'example.com',authorization:'Bearer sensitive-header','content-type':'application/json'}},Buffer.from('{}'));text=fs.readFileSync(file,'utf8');} console.log(JSON.stringify({enabled:c.ENABLE_FILE_LOG,leaked:text.includes('sensitive-header')||text.includes('sensitive-query'),redacted:text.includes('[redacted]')}));`;
    const run = (capture) => spawnSync(process.execPath, ["-e", script], {
      encoding: "utf8", env: { ...process.env, DATA_DIR: dir, NODE_ENV: "development", MITM_DEBUG_CAPTURE: capture }, timeout: 10000,
    });
    try {
      const off = run("0");
      expect(off.status).toBe(0);
      expect(JSON.parse(off.stdout.trim()).enabled).toBe(false);
      const on = run("1");
      expect(on.status).toBe(0);
      expect(JSON.parse(on.stdout.trim())).toEqual({ enabled: true, leaked: false, redacted: true });
    } finally {
      const logs = path.join(dir, "logs", "mitm");
      if (fs.existsSync(logs)) {
        for (const file of fs.readdirSync(logs)) fs.unlinkSync(path.join(logs, file));
        fs.rmdirSync(logs);
        fs.rmdirSync(path.join(dir, "logs"));
      }
      fs.rmdirSync(dir);
    }
  });
});
