const readline = require("readline");

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  reverse: "\x1b[7m",
  cyan: "\x1b[38;2;217;119;87m", // warm terracotta accent replacing bright cyan
  green: "\x1b[38;2;52;211;153m",
  yellow: "\x1b[38;2;245;158;11m",
  blue: "\x1b[38;2;217;119;87m",
  white: "\x1b[38;2;244;244;245m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  black: "\x1b[30m",
  terracotta: "\x1b[38;2;217;119;87m",
  bgTerracotta: "\x1b[48;2;217;119;87m",
  platinum: "\x1b[38;2;244;244;245m",
  muted: "\x1b[38;2;161;161;170m",
  subtle: "\x1b[38;2;113;113;122m",
  border: "\x1b[38;2;63;63;70m"
};

// Prime stdin once globally. Toggling raw mode between menus adds latency on
// macOS, so we keep raw mode on for the whole TUI session.
let rawPrimed = false;
function primeRawOnce() {
  if (rawPrimed || !process.stdin.isTTY) return;
  try {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    rawPrimed = true;
  } catch {}
}

function suspendRawFor(fn) {
  // Temporarily drop raw mode so readline.question can buffer line input.
  const wasPrimed = rawPrimed;
  if (wasPrimed && process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch {}
  }
  return fn().finally(() => {
    if (wasPrimed && process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
      process.stdin.resume();
    }
  });
}

async function prompt(question) {
  return suspendRawFor(() => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || "").trim());
    });
  }));
}

async function select(question, options) {
  console.log(question);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
  while (true) {
    const answer = await prompt("\nSelect option (number): ");
    const num = parseInt(answer, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) return num - 1;
    console.log(`Invalid selection. Please enter a number between 1 and ${options.length}`);
  }
}

async function confirm(question) {
  while (true) {
    const answer = await prompt(`${question} (y/n): `);
    const lower = answer.toLowerCase();
    if (lower === "y" || lower === "yes") return true;
    if (lower === "n" || lower === "no") return false;
    console.log("Please answer 'y' or 'n'");
  }
}

async function pause(message = "Press Enter to continue...") {
  return suspendRawFor(() => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => { rl.close(); resolve(); });
  }));
}

/**
 * MiawRouter arrow-key menu with a shared cat header and contextual help.
 */
async function selectMenu(title, items, defaultIndex = 0, subtitle = "", headerContent = "", breadcrumb = []) {
  return new Promise((resolve) => {
    let selectedIndex = defaultIndex;
    let isActive = true;

    primeRawOnce();
    if (!process.stdin.isTTY) { resolve(-1); return; }

    const renderMenu = () => {
      if (!isActive) return;
      process.stdout.write("\x1b[2J\x1b[H");
      const width = Math.max(1, Math.min((process.stdout.columns || 64) - 4, 60));
      const divider = "─".repeat(width);

      console.log(`\n  ${COLORS.terracotta}${COLORS.bright} /\\_/\\   ${COLORS.bright}${COLORS.platinum}MiawRouter${COLORS.reset}  ${COLORS.subtle}• local proxy${COLORS.reset}`);
      console.log(`  ${COLORS.terracotta}( o.o )${COLORS.reset}  ${COLORS.muted}Your AI, one cozy home.${COLORS.reset}`);
      console.log(`  ${COLORS.terracotta} > ^ <${COLORS.reset}`);
      console.log(`\n  ${COLORS.bright}${COLORS.platinum}${title}${COLORS.reset}`);
      if (subtitle) console.log(`  ${subtitle}`);
      console.log(`  ${COLORS.border}${divider}${COLORS.reset}`);
      if (breadcrumb.length > 0) console.log(`  ${COLORS.dim}${breadcrumb.join(" > ")}${COLORS.reset}`);
      console.log();
      if (headerContent) { console.log(headerContent); console.log(); }

      items.forEach((item, index) => {
        if (index === selectedIndex) {
          console.log(`  ${COLORS.terracotta}${COLORS.bright}> ${COLORS.reverse} ${item.label} ${COLORS.reset}`);
        } else {
          console.log(`    ${COLORS.muted}${item.label}${COLORS.reset}`);
        }
      });
      if (items[selectedIndex]?.description) {
        console.log(`\n  ${COLORS.terracotta}│${COLORS.reset}  ${COLORS.platinum}${items[selectedIndex].description}${COLORS.reset}`);
      }
      console.log(`\n  ${COLORS.border}${divider}${COLORS.reset}`);
      console.log(`  ${COLORS.subtle}Up/Down: move   Enter: select   Esc: back${COLORS.reset}`);
    };

    const cleanup = () => {
      if (!isActive) return;
      isActive = false;
      process.stdin.removeListener("keypress", onKeypress);
    };

    const move = (delta) => {
      selectedIndex = (selectedIndex + delta + items.length) % items.length;
      renderMenu();
    };

    const onKeypress = (_str, key) => {
      if (!isActive || !key) return;
      if (key.name === "up") return move(-1);
      if (key.name === "down") return move(1);
      if (key.name === "return") { cleanup(); resolve(selectedIndex); return; }
      if (key.name === "escape") { cleanup(); resolve(-1); return; }
      if (key.ctrl && key.name === "c") { cleanup(); process.exit(0); }
    };

    process.stdin.on("keypress", onKeypress);
    renderMenu();
  });
}

module.exports = {
  prompt,
  select,
  confirm,
  pause,
  selectMenu,
  COLORS
};
