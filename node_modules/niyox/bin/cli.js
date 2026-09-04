#!/usr/bin/env node
"use strict";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   D N U Z I   A I   —   C L I
//   Powered by DanuZz · @niyox
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

process.title = "niyox";

const path     = require("path");
const readline = require("readline");
const pkg      = require(path.join(__dirname, "..", "package.json"));

// ─── early-exit flags (before heavy deps load) ─────────────────────────────
{
  const args = process.argv.slice(2);
  if (args[0] === "--version" || args[0] === "-v") {
    console.log(pkg.version);
    process.exit(0);
  }
  if (args[0] === "--help" || args[0] === "-h") {
    // can't render the full banner yet — print a plain fallback and let the
    // full handler below run after deps load (same behaviour as before)
    // We do nothing here; the full handler at the bottom will fire.
  }
}

// ─── deps ──────────────────────────────────────────────────────────────────
const chalk          = require("chalk");
const gradient       = require("gradient-string");
const figlet         = require("figlet");
const { default: boxen } = require("boxen");
const ora            = require("ora");
const Table          = require("cli-table3");
const Conf           = require("conf");
const { NiyoXAI }   = require("../lib/index.cjs");

// ─── gradient themes ───────────────────────────────────────────────────────
const g = {
  title:    gradient(["#a044ff", "#00d2ff", "#00ffa3"]),
  accent:   gradient(["#00d2ff", "#a044ff"]),
  warm:     gradient(["#ff6b6b", "#ffd93d"]),
  cool:     gradient(["#4ecdc4", "#45b7d1"]),
  neon:     gradient(["#00ffa3", "#00d2ff"]),
};

// ─── symbol set ────────────────────────────────────────────────────────────
const S = {
  bullet:   "›",
  dot:      "·",
  bar:      "│",
  top:      "╭",
  bot:      "╰",
  dash:     "─",
  cross:    "×",
  check:    "✓",
  warn:     "◆",
  info:     "◈",
  arrow:    "→",
  prompt:   "❯",
  diamond:  "◇",
  star:     "✦",
  thin:     "▸",
  block:    "█",
  half:     "▓",
  light:    "░",
};

// ─── colour palette helpers ────────────────────────────────────────────────
const C = {
  primary:    (t) => chalk.hex("#a044ff")(t),
  secondary:  (t) => chalk.hex("#00d2ff")(t),
  success:    (t) => chalk.hex("#00ffa3")(t),
  warn:       (t) => chalk.hex("#ffd93d")(t),
  error:      (t) => chalk.hex("#ff6b6b")(t),
  muted:      (t) => chalk.hex("#555577")(t),
  white:      (t) => chalk.hex("#e0e0f0")(t),
  bright:     (t) => chalk.hex("#ffffff").bold(t),
  dim:        (t) => chalk.dim(t),
};

// ─── divider ───────────────────────────────────────────────────────────────
const DIV = (len = 58) => C.muted(S.dash.repeat(len));

// ─── conf ──────────────────────────────────────────────────────────────────
function getConf() {
  return new Conf({ projectName: "niyox", defaults: { userId: "cli_user", useMongo: false } });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BANNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function printBanner() {
  console.clear();

  const art = figlet.textSync("NIYOX", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted",
  });

  console.log();
  // print art line-by-line with gradient
  art.split("\n").forEach(line => {
    console.log("  " + g.title(line));
  });

  console.log(
    "  " + C.muted(S.dash.repeat(46)) + "\n" +
    "  " + C.muted("Powered by ") + C.primary("DanuZz") +
           C.muted("  " + S.dot + "  @niyox") +
           C.muted("  " + S.dot + "  v" + pkg.version) + "\n" +
    "  " + C.muted(S.dash.repeat(46))
  );

  const lines = [
    C.muted(S.dot + " " + S.dash.repeat(48) + " " + S.dot),
    "",
    "  " + C.secondary(S.star + " AI Chat") + "  " + C.muted("type your message and press Enter"),
    "",
    "  " + C.primary(S.diamond + " Commands"),
    "",
    fmtCmd("/help",       "show all commands"),
    fmtCmd("/new",        "fresh conversation thread"),
    fmtCmd("/history",    "in-memory chat log"),
    fmtCmd("/stats",      "usage stats  (MongoDB)"),
    fmtCmd("/convs",      "stored conversation list  (MongoDB)"),
    fmtCmd("/mongo",      "enable persistent storage"),
    fmtCmd("/user <id>",  "set your user ID"),
    fmtCmd("/clear",      "clear the screen"),
    fmtCmd("/exit",       "quit"),
    "",
    C.muted(S.dot + " " + S.dash.repeat(48) + " " + S.dot),
  ];

  console.log(
    "\n" +
    boxen(lines.join("\n"), {
      padding:        { top: 0, bottom: 0, left: 2, right: 2 },
      margin:         { top: 0, bottom: 1, left: 2 },
      borderStyle:    "round",
      borderColor:    "#a044ff",
    })
  );
}

function fmtCmd(cmd, desc) {
  const padded = cmd.padEnd(16);
  return (
    "  " + C.secondary(S.bullet + " " + padded) +
    C.muted(S.arrow + "  ") +
    C.white(desc)
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELP TABLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function printHelp() {
  const t = new Table({
    head: [
      chalk.hex("#a044ff").bold("  Command"),
      chalk.hex("#00d2ff").bold("  Description"),
      chalk.hex("#00ffa3").bold("  Notes"),
    ],
    colWidths: [18, 36, 24],
    chars: {
      top: S.dash, "top-mid": "┬", "top-left": "╭", "top-right": "╮",
      bottom: S.dash, "bottom-mid": "┴", "bottom-left": "╰", "bottom-right": "╯",
      left: S.bar, right: S.bar, mid: S.dash, "mid-mid": "┼", middle: S.bar,
    },
    style: { head: [], border: ["dim"], "padding-left": 1, "padding-right": 1 },
  });

  const rows = [
    [C.secondary("/help"),       C.white("Show this reference"),          C.muted("any time")],
    [C.secondary("/new"),        C.white("Fresh conversation"),            C.muted("clears thread")],
    [C.secondary("/history"),    C.white("In-memory chat log"),            C.muted("current session")],
    [C.secondary("/convs"),      C.white("List saved conversations"),      C.muted("MongoDB required")],
    [C.secondary("/stats"),      C.white("Usage statistics"),              C.muted("MongoDB required")],
    [C.secondary("/mongo"),      C.white("Enable persistent storage"),     C.muted("opt-in")],
    [C.secondary("/user <id>"),  C.white("Set user ID"),                   C.muted("for MongoDB")],
    [C.secondary("/clear"),      C.white("Clear terminal"),                C.muted("")],
    [C.secondary("/version"),    C.white("Show version"),                  C.muted("")],
    [C.secondary("/exit"),       C.white("Quit"),                          C.muted("Ctrl+C also works")],
  ];

  rows.forEach(r => t.push(r));
  console.log("\n" + t.toString() + "\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AI RESPONSE RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderResponse(text, ms) {
  const lines = text.split("\n");
  let inCode  = false;
  const out   = [];

  for (const raw of lines) {
    const l = raw;

    // fenced code block toggle
    if (l.startsWith("```")) {
      inCode = !inCode;
      out.push(inCode
        ? chalk.hex("#1a1a2e").bgHex("#2a2a4a")(" " + (l.slice(3) || "code") + " ") + chalk.hex("#2a2a4a")("")
        : C.muted(S.dash.repeat(40)));
      continue;
    }

    if (inCode) {
      out.push(C.muted("  " + S.bar + " ") + chalk.hex("#a8ff78")(l));
      continue;
    }

    // markdown-ish headers
    if (l.startsWith("### ")) { out.push("\n  " + C.warn(S.thin + " " + l.slice(4))); continue; }
    if (l.startsWith("## "))  { out.push("\n  " + C.secondary(S.thin + " " + l.slice(3))); continue; }
    if (l.startsWith("# "))   { out.push("\n  " + g.accent(S.diamond + " " + l.slice(2))); continue; }

    // bold **text**
    const styled = l
      .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.hex("#ffffff").bold(m))
      .replace(/`(.+?)`/g,       (_, m) => chalk.hex("#a8ff78").bgHex("#1e2a1e")(" " + m + " "));

    // bullets
    if (/^[\-\*] /.test(l)) {
      out.push("  " + C.primary(S.bullet + " ") + C.white(styled.slice(2)));
      continue;
    }
    if (/^\d+\. /.test(l)) {
      out.push("  " + C.secondary(l.match(/^(\d+)\./)[1] + S.dot) + " " + C.white(styled.replace(/^\d+\. /, "")));
      continue;
    }

    out.push(l.trim() === "" ? "" : "  " + C.white(styled));
  }

  const body = out.join("\n").replace(/\n{3,}/g, "\n\n");

  const header =
    C.primary("  " + S.star + " NiyoX AI") +
    "  " + C.muted(S.dot) +
    "  " + C.muted(new Date().toLocaleTimeString());

  const footer =
    C.muted("  " + S.thin + " ") + C.muted("response time ") +
    C.secondary(ms + "ms");

  console.log(
    "\n" +
    boxen(
      header + "\n" + C.muted("  " + S.dash.repeat(50)) + "\n\n" +
      body + "\n\n" + footer,
      {
        padding:     { top: 0, bottom: 0, left: 1, right: 2 },
        margin:      { top: 0, bottom: 1, left: 1 },
        borderStyle: "round",
        borderColor: "#a044ff",
      }
    )
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HISTORY RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderHistory(history) {
  if (!history.length) {
    console.log("\n  " + C.muted(S.warn + "  No history in this session.\n"));
    return;
  }

  console.log(
    "\n  " + g.accent(" Session History ") + "\n  " + DIV(48)
  );

  history.forEach((h) => {
    const ts    = C.muted(new Date(h.timestamp).toLocaleTimeString());
    const isUser = h.role === "user";
    const label  = isUser
      ? "  " + C.success(S.diamond + " You      ") + ts
      : "  " + C.primary(S.star   + " NiyoX AI ") + ts;
    const body   = C.white(h.content.slice(0, 180) + (h.content.length > 180 ? C.muted(" [...]") : ""));
    console.log(label + "\n  " + C.muted(S.bar + " ") + body + "\n");
  });

  console.log("  " + DIV(48) + "\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STATS TABLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderStats(stats) {
  const t = new Table({
    chars: {
      top: S.dash, "top-mid": "┬", "top-left": "╭", "top-right": "╮",
      bottom: S.dash, "bottom-mid": "┴", "bottom-left": "╰", "bottom-right": "╯",
      left: S.bar, right: S.bar, mid: S.dash, "mid-mid": "┼", middle: S.bar,
    },
    style: { border: ["dim"], "padding-left": 2, "padding-right": 2 },
  });
  t.push(
    [C.muted("Total Messages"),       C.secondary(stats.totalMessages)],
    [C.muted("Conversations"),        C.secondary(stats.totalConversations)],
    [C.muted("Avg Response Time"),    C.secondary(stats.avgResponseTimeMs + " ms")],
  );
  console.log(
    "\n  " + g.cool(" Your Stats ") + "\n" +
    t.toString() + "\n"
  );
}

// ─── spinner ───────────────────────────────────────────────────────────────
function spin(text) {
  return ora({
    text:    chalk.hex("#00d2ff")(text),
    spinner: "dots12",
    color:   "magenta",
  }).start();
}

// ─── prompt line ───────────────────────────────────────────────────────────
function writePrompt(mongoOn) {
  const tag = mongoOn
    ? chalk.hex("#00ffa3")(S.block)
    : chalk.hex("#a044ff")(S.block);
  process.stdout.write("\n  " + tag + " " + chalk.hex("#a044ff").bold(S.prompt) + " ");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REPL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function repl() {
  const conf   = getConf();
  const ai     = new NiyoXAI({ userId: conf.get("userId") });
  let mongoOn  = false;

  if (conf.get("useMongo")) {
    const sp = spin("Reconnecting to MongoDB…");
    try {
      await ai.enableStorage();
      mongoOn = true;
      sp.succeed(C.success(S.check + "  MongoDB connected"));
    } catch {
      sp.fail(C.error(S.cross + "  MongoDB unavailable — running without storage"));
    }
  }

  printBanner();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "" });

  rl.on("line", async (raw) => {
    const input = raw.trim();
    if (!input) { writePrompt(mongoOn); return; }

    // ── built-in commands ─────────────────────────────────────────────────
    if (input === "/exit" || input === "/quit") {
      console.log("\n  " + C.primary(S.star) + "  " + g.title("See you next time.") + "\n");
      await ai.close();
      process.exit(0);
    }

    if (input === "/clear") { printBanner(); writePrompt(mongoOn); return; }

    if (input === "/version") {
      console.log("\n  " + C.secondary(S.info) + "  niyox " + C.primary("v" + pkg.version) + "\n");
      writePrompt(mongoOn); return;
    }

    if (input === "/help") { printHelp(); writePrompt(mongoOn); return; }

    if (input === "/new") {
      ai.newConversation();
      console.log("\n  " + C.success(S.check) + "  " + C.white("New conversation started.") + "\n");
      writePrompt(mongoOn); return;
    }

    if (input === "/history") {
      renderHistory(ai.getHistory());
      writePrompt(mongoOn); return;
    }

    if (input === "/mongo") {
      if (mongoOn) {
        console.log("\n  " + C.warn(S.warn) + "  " + C.white("MongoDB already active.") + "\n");
        writePrompt(mongoOn); return;
      }
      const sp = spin("Connecting to MongoDB…");
      try {
        await ai.enableStorage();
        mongoOn = true;
        conf.set("useMongo", true);
        sp.succeed(C.success(S.check + "  MongoDB enabled  " + C.muted("— chats will be saved")));
      } catch (e) {
        sp.fail(C.error(S.cross + "  " + e.message));
      }
      writePrompt(mongoOn); return;
    }

    if (input === "/stats") {
      if (!mongoOn) { console.log("\n  " + C.warn(S.warn) + "  " + C.muted("Run /mongo first.\n")); writePrompt(mongoOn); return; }
      const sp = spin("Fetching stats…");
      try {
        const stats = await ai.getStats();
        sp.stop();
        renderStats(stats);
      } catch (e) { sp.fail(C.error(S.cross + "  " + e.message)); }
      writePrompt(mongoOn); return;
    }

    if (input === "/convs") {
      if (!mongoOn) { console.log("\n  " + C.warn(S.warn) + "  " + C.muted("Run /mongo first.\n")); writePrompt(mongoOn); return; }
      const sp = spin("Loading conversations…");
      try {
        const convs = await ai.listConversations();
        sp.stop();
        if (!convs.length) {
          console.log("\n  " + C.muted(S.dot + "  No conversations stored.\n"));
        } else {
          console.log("\n  " + g.cool(" Stored Conversations ") + "\n  " + DIV(48));
          convs.forEach((id, i) => console.log("  " + C.muted((i + 1) + S.dot + " ") + C.white(id)));
          console.log();
        }
      } catch (e) { sp.fail(C.error(S.cross + "  " + e.message)); }
      writePrompt(mongoOn); return;
    }

    if (input.startsWith("/user ")) {
      const uid = input.slice(6).trim();
      if (!uid) { console.log("\n  " + C.error(S.cross) + "  " + C.white("Provide a user ID.\n")); writePrompt(mongoOn); return; }
      conf.set("userId", uid);
      ai.storage.userId = uid;
      console.log("\n  " + C.success(S.check) + "  " + C.white("User ID set to ") + C.primary(uid) + "\n");
      writePrompt(mongoOn); return;
    }

    // unknown command
    if (input.startsWith("/")) {
      console.log("\n  " + C.error(S.cross) + "  " + C.muted("Unknown command. Type ") + C.secondary("/help") + C.muted(" for a list.\n"));
      writePrompt(mongoOn); return;
    }

    // ── AI message ────────────────────────────────────────────────────────
    const sp = spin("Thinking…");
    try {
      const res = await ai.chat(input);
      sp.stop();
      renderResponse(res.result, res.responseTime);
    } catch (e) {
      sp.fail(C.error(S.cross + "  " + e.message));
    }

    writePrompt(mongoOn);
  });

  rl.on("close", async () => {
    console.log("\n  " + C.primary(S.star) + "  " + g.title("See you next time.") + "\n");
    await ai.close();
    process.exit(0);
  });

  writePrompt(mongoOn);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ARG HANDLING  (one-shot / --version / --help)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const args = process.argv.slice(2);

if (args[0] === "--version" || args[0] === "-v") {
  console.log(pkg.version);
  process.exit(0);
}

if (args[0] === "--help" || args[0] === "-h") {
  printBanner();
  printHelp();
  process.exit(0);
}

if (args.length > 0) {
  // one-shot:  niyox "what is gravity?"
  const question = args.join(" ");
  const ai       = new NiyoXAI();
  const sp       = spin("Thinking…");
  ai.chat(question)
    .then((res) => { sp.stop(); renderResponse(res.result, res.responseTime); process.exit(0); })
    .catch((e)  => { sp.fail(C.error(S.cross + "  " + e.message)); process.exit(1); });
} else {
  repl().catch((e) => { console.error(e); process.exit(1); });
}
