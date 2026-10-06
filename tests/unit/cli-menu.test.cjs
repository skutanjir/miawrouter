const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("MiawRouter branding and keyboard navigation", async () => {
  const stdin = new EventEmitter();
  Object.assign(stdin, { isTTY: true, setRawMode() {}, setEncoding() {}, resume() {} });
  const output = [];
  const context = {
    module: { exports: {} },
    require: () => ({ emitKeypressEvents() {} }),
    process: { stdin, stdout: { columns: 64, write() {} } },
    console: { log: (line = "") => output.push(line) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../cli/src/cli/utils/input.js"), "utf8"), context);
  const { selectMenu } = context.module.exports;
  const items = [
    { label: "Open dashboard", description: "Open your browser." },
    { label: "Enter terminal", description: "Stay in your terminal." }
  ];
  const selection = selectMenu("Welcome home / v1.2.1", items, 0, "Server  http://localhost:20128");
  const rendered = output.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  assert.ok(rendered.includes(" /\\_/\\   MiawRouter"));
  assert.ok(rendered.includes(">  Open dashboard "));
  assert.ok(rendered.includes("Server  http://localhost:20128"));
  assert.ok(rendered.includes("Up/Down: move   Enter: select   Esc: back"));
  assert.ok(rendered.includes("Open your browser."));
  stdin.emit("keypress", "", { name: "up" });
  assert.ok(output.join("\n").includes("Stay in your terminal."));
  stdin.emit("keypress", "", { name: "down" });
  stdin.emit("keypress", "", { name: "down" });
  stdin.emit("keypress", "", { name: "return" });
  assert.equal(await selection, 1);
  assert.equal(stdin.listenerCount("keypress"), 0);
  const cancelled = selectMenu("Providers", items);
  stdin.emit("keypress", "", { name: "escape" });
  assert.equal(await cancelled, -1);
  stdin.isTTY = false;
  assert.equal(await selectMenu("Providers", items), -1);
});