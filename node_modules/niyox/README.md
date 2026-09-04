<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00d4ff,50:7c3aed,100:4000ff&height=200&section=header&text=NiyoX%20AI&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=By+DanuZz+Developer&descAlignY=56&descSize=17" width="100%"/>

<br/>

<img src="https://img.shields.io/badge/npm-niyox-a044ff?style=for-the-badge&labelColor=0d0d1a&logo=npm&logoColor=ff6b6b" alt="npm"/>
&nbsp;
<img src="https://img.shields.io/badge/version-0.0.3-000000?style=for-the-badge&labelColor=0d0d1a" alt="version"/>
&nbsp;
<img src="https://img.shields.io/badge/license-MIT-000000?style=for-the-badge&labelColor=0d0d1a" alt="license"/>
&nbsp;
<img src="https://img.shields.io/badge/node-%3E%3D18-000000?style=for-the-badge&labelColor=0d0d1a&logo=node.js&logoColor=ffd93d" alt="node"/>
&nbsp;
<img src="https://img.shields.io/badge/CI-passing-000000?style=for-the-badge&labelColor=0d0d1a&logo=github-actions&logoColor=00ffa3" alt="CI"/>

<br/>

[![npm downloads](https://img.shields.io/npm/dt/niyox?style=for-the-badge&label=total%20downloads&labelColor=0d0d1a&color=a044ff&logo=npm&logoColor=ff6b6b)](https://www.npmjs.com/package/niyox)

<br/><br/>

```
███╗   ██╗██╗██╗   ██╗ ██████╗ ██╗  ██╗
████╗  ██║██║╚██╗ ██╔╝██╔═══██╗╚██╗██╔╝
██╔██╗ ██║██║ ╚████╔╝ ██║   ██║ ╚███╔╝ 
██║╚██╗██║██║  ╚██╔╝  ██║   ██║ ██╔██╗ 
██║ ╚████║██║   ██║   ╚██████╔╝██╔╝ ██╗
╚═╝  ╚═══╝╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
```

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=2800&pause=800&color=A044FF&center=true&vCenter=true&width=600&height=45&lines=%F0%9F%A4%96+Intelligent+AI+SDK+%26+CLI;%F0%9F%9F%A6+Node.js+%7C+React+%7C+Next.js+%7C+Browser;%F0%9F%92%AC+Multi-turn+conversation+memory;%F0%9F%97%84%EF%B8%8F+Custom+MongoDB+%2B+NiyoX+cloud+DB;%E2%9A%A1+Powered+by+NiyoX+AI" alt="Typing animation"/>

<br/><br/>

[![Live API](https://img.shields.io/badge/%F0%9F%8C%90_Live_API-ai.dnuz.top-a044ff?style=for-the-badge&labelColor=0d0d1a)](https://ai.dnuz.top)
&nbsp;
[![GitHub](https://img.shields.io/badge/%E2%AD%90_Star_on_GitHub-niyox--ai-ffd93d?style=for-the-badge&labelColor=0d0d1a&logo=github&logoColor=ffd93d)](https://github.com/dnuzi/niyox)
&nbsp;
[![npm install](https://img.shields.io/badge/%F0%9F%93%A6_Install-npm_install_niyox-0d0d1a?style=for-the-badge&color=000000&labelColor=1a1a2e&logo=npm&logoColor=ff6b6b)](https://npmjs.com/package/niyox)

</div>

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## What is NiyoX AI?

**NiyoX** is a full-featured AI SDK and CLI that wraps the [NiyoX AI REST API](https://ai.dnuz.top/api/ai). Chat with AI from your terminal, Node.js server, React/Next.js/Vite app, or browser — with optional MongoDB persistence (your own database or the NiyoX cloud), multi-turn conversation memory, and a rich interactive CLI built in.

The package ships four layers you can use independently:

- **`NiyoXClient`** — thin HTTP wrapper, in-memory history
- **`NiyoXStorage`** — optional MongoDB layer (plug in your own URI)
- **`NiyoXAI`** — high-level class combining both
- **`useNiyoX` / `NiyoXChat`** — React hook + ready-made component

<div align="center">
<img src="https://skillicons.dev/icons?i=nodejs,js,ts,react,nextjs,mongodb,github,npm&theme=dark&perline=8" alt="Tech stack"/>
</div>

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## What's new in 0.0.3

| # | Change |
|---|---|
| 🗄️ | **Custom MongoDB** — pass your own `mongoUri` + `dbName` anywhere |
| ⚛️ | **React hook** — `useNiyoX()`, `<NiyoXChat>`, `<NiyoXProvider>` |
| 🔷 | **Next.js** — App Router example with Tailwind |
| ⚡ | **Vite** — vanilla JS example |
| 💻 | **CLI** — `/mongo <url>` and `/mongourl <url>` commands |
| 🗑️ | **Python SDK removed** — now maintained separately as `niyox-ai` on PyPI |

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Features

<div align="center">

| Feature | Status |
|---|:---:|
| 🖥️ Interactive REPL CLI | ✅ |
| ⚡ One-shot CLI queries | ✅ |
| 🔄 Multi-turn conversation memory | ✅ |
| 🗄️ Custom MongoDB URI (bring your own DB) | ✅ **new** |
| ⚛️ React hook + component | ✅ **new** |
| 🔷 Next.js App Router support | ✅ **new** |
| ⚡ Vite + vanilla JS example | ✅ **new** |
| 🌐 Browser / CDN support | ✅ |
| 📦 CommonJS + ESM dual package | ✅ |
| 🎨 Rich CLI output | ✅ |

</div>

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Contents

[Install](#-install) · [CLI](#-cli) · [Node.js](#-nodejs) · [React / Vite](#-react--vite) · [Next.js](#-nextjs) · [Custom MongoDB](#-custom-mongodb) · [Browser](#-browser) · [API Reference](#-api-reference) · [Development](#-development)

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Install

```bash
# Global — gives you the niyox command everywhere
npm install -g niyox

# Local — use in your project
npm install niyox
```

> Requires **Node.js ≥ 18**. On older Node, install `node-fetch` and it will be picked up automatically.

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## CLI

**Launch the interactive REPL:**

```bash
niyox
```

**One-shot question:**

```bash
niyox "what is the speed of light?"
niyox "explain async/await in JavaScript"
```

**Flags:**

```bash
niyox --version    # print version  (alias: -v)
niyox --help       # show banner + command reference  (alias: -h)
```

### Inside the REPL

```
  ╭──────────────────────────────────────────────────────────────╮
  │                                                              │
  │   ✦ NIYOX  AI       v0.0.2                                  │
  │                                                              │
  │   › /help             →  show all commands                   │
  │   › /new              →  fresh conversation thread           │
  │   › /history          →  in-memory chat log                  │
  │   › /stats            →  usage stats  (MongoDB)              │
  │   › /convs            →  stored conversation list            │
  │   › /mongo [url]      →  enable storage (custom URI opt.)    │
  │   › /mongourl <url>   →  update MongoDB URI                  │
  │   › /user <id>        →  set your user ID                    │
  │   › /clear            →  clear the screen                    │
  │   › /exit             →  quit                                │
  │                                                              │
  ╰──────────────────────────────────────────────────────────────╯
```

**Connect to your own MongoDB from the CLI:**

```
/mongo mongodb+srv://user:pass@cluster.mongodb.net/
```

Or update the URI without reconnecting (saved for next session):

```
/mongourl mongodb+srv://user:pass@cluster.mongodb.net/
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Node.js

### CommonJS

```js
const { NiyoXAI } = require("niyox");

const ai = new NiyoXAI();
const { result, responseTime } = await ai.chat("Tell me something interesting.");
console.log(result);
```

### ESM

```js
import { NiyoXAI } from "niyox";

const ai  = new NiyoXAI({ userId: "alice" });
const res = await ai.ask("Explain quantum entanglement.");
console.log(res.result);
```

### Multi-turn conversation

```js
const ai = new NiyoXAI();

await ai.chat("My name is Bob.");
const r = await ai.chat("What is my name?");
console.log(r.result);    // → "Bob"

ai.newConversation();     // reset thread + in-memory history
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Custom MongoDB

> Works everywhere — Node.js and CLI. Storage is **always optional**.

### Node.js / ESM

```js
import { NiyoXAI } from "niyox";

const ai = new NiyoXAI({
  userId:   "alice",
  mongoUri: "mongodb+srv://user:pass@cluster.mongodb.net/",
  dbName:   "my_app_db",   // optional — defaults to "niyox_npm"
});

await ai.enableStorage();              // connects and enables persistence
const res = await ai.chat("Hello!");   // automatically saved to YOUR DB
const msgs = await ai.getPersistentHistory(res.conversationId);

await ai.close();
```

### Storage-only (`NiyoXStorage`)

```js
const { NiyoXStorage } = require("niyox");

const store = new NiyoXStorage("bob", {
  mongoUri: "mongodb+srv://user:pass@cluster.mongodb.net/",
  dbName:   "my_db",
});
await store.connect();

await store.saveTurn({
  conversationId:   "abc-123",
  userMessage:      "Hi!",
  assistantMessage: "Hello, Bob!",
  responseTime:     412,
});

const turns = await store.getConversation("abc-123");
await store.disconnect();
```

You can also override the URI at connect-time:

```js
const store = new NiyoXStorage("bob");
await store.connect("bob", "mongodb://localhost:27017/", "dev_db");
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## React / Vite

### `useNiyoX` hook

```jsx
// src/Chat.jsx
import { useNiyoX } from "niyox/react";

export default function Chat() {
  const { messages, input, setInput, sendMessage, isLoading } = useNiyoX();

  return (
    <div>
      {messages.map((m, i) => (
        <p key={i}><b>{m.role}:</b> {m.content}</p>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && sendMessage()}
      />
      <button onClick={() => sendMessage()} disabled={isLoading}>Send</button>
    </div>
  );
}
```

### Ready-made `<NiyoXChat>` component (zero extra code)

```jsx
import { NiyoXChat } from "niyox/react";

export default function App() {
  return (
    <div style={{ height: "600px", width: "700px" }}>
      <NiyoXChat title="My AI Assistant" />
    </div>
  );
}
```

### Shared session with `<NiyoXProvider>`

```jsx
// main.jsx
import { NiyoXProvider } from "niyox/react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <NiyoXProvider sessionId="global">
    <App />
  </NiyoXProvider>
);

// Any child:
import { useNiyoXContext } from "niyox/react";
const { sendMessage, messages } = useNiyoXContext();
```

> Copy `react/useNiyoX.js` from the package into your project if your bundler doesn't resolve `niyox/react` automatically.

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Next.js

Works in both the **App Router** (Next.js 13+) and the **Pages Router**.

### App Router (`app/chat/page.tsx`)

```tsx
"use client";
import { useNiyoX } from "niyox/react";   // or copy react/useNiyoX.js → lib/

export default function ChatPage() {
  const { messages, input, setInput, sendMessage, isLoading } = useNiyoX();

  return (
    <main>
      {messages.map((m, i) => (
        <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
          {m.content}
        </div>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
             onKeyDown={e => e.key === "Enter" && sendMessage()} />
      <button onClick={() => sendMessage()} disabled={isLoading}>Send</button>
    </main>
  );
}
```

> The full styled example (Tailwind) is at `examples/nextjs/chat-page.tsx`.

### Server-side usage (Node.js API route)

```ts
// app/api/chat/route.ts
import { NiyoXAI } from "niyox";

const ai = new NiyoXAI();

export async function POST(req: Request) {
  const { message } = await req.json();
  const res = await ai.chat(message);
  return Response.json({ result: res.result });
}
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Browser

Zero-dependency browser client (no bundler needed):

```html
<script>
  const NiyoXAI = (() => {
    const BASE = "https://ai.dnuz.top/api/ai";
    class Client {
      constructor({ sessionId = "default" } = {}) {
        this.sessionId = sessionId;
        this.conversationId = null;
      }
      async chat(message) {
        const p = new URLSearchParams({ q: message });
        if (this.conversationId) p.set("conversationId", this.conversationId);
        const res  = await fetch(`${BASE}?${p}`);
        const data = await res.json();
        if (data.conversationId) this.conversationId = data.conversationId;
        return data;
      }
    }
    return { Client };
  })();

  const ai  = new NiyoXAI.Client();
  const res = await ai.chat("Hello!");
  console.log(res.result);
</script>
```

> Open `html/index.html` for a fully styled dark-theme chat UI — zero dependencies, zero bundler.

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## API Reference

### `new NiyoXAI(options?)` — Node.js

| Option | Type | Default | Description |
|---|---|---|---|
| `userId` | `string` | `"anonymous"` | MongoDB user identifier |
| `sessionId` | `string` | `"default"` | API session ID |
| `conversationId` | `string` | `null` | Resume an existing thread |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `mongoUri` | `string` | NiyoX cloud | **Custom** MongoDB connection string |
| `dbName` | `string` | `"niyox_npm"` | **Custom** database name |

### `NiyoXAI` methods

| Method | Returns | Description |
|---|---|---|
| `chat(message)` | `Promise<Response>` | Send a message; auto-persists if storage enabled |
| `ask(message)` | `Promise<Response>` | Alias for `chat()` |
| `enableStorage(userId?, mongoUri?, dbName?)` | `Promise<this>` | Connect to MongoDB |
| `newConversation()` | `void` | Reset thread + in-memory history |
| `getHistory()` | `Turn[]` | In-memory history copy |
| `getPersistentHistory(convId?)` | `Promise<Turn[]>` | Load from MongoDB |
| `listConversations()` | `Promise<string[]>` | All stored conversation IDs |
| `deleteConversation(id)` | `Promise<number>` | Delete a conversation |
| `getStats()` | `Promise<Stats\|null>` | Usage statistics |
| `setPref(key, value)` | `Promise<void>` | Persist a user preference |
| `getPref(key, default?)` | `Promise<any>` | Retrieve a user preference |
| `close()` | `Promise<void>` | Close MongoDB connection |

### `useNiyoX(options?)` hook

| Option | Type | Default |
|---|---|---|
| `sessionId` | `string` | `"default"` |

Returns `{ messages, input, setInput, isLoading, error, sendMessage, newConversation, conversationId }`.

### Response shape

```ts
{
  result:         string   // AI reply
  conversationId: string   // thread ID — reused automatically
  sessionId:      string
  responseTime:   number   // ms
  attempts:       number
}
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

## Development

```bash
git clone https://github.com/dnuzi/niyox
cd niyox
npm install

# Build lib/index.cjs and lib/index.mjs from src/
node scripts/build.js

# Run tests
npm test
```

**Project layout:**

```
niyox/
├── bin/
│   └── cli.js              # CLI — REPL, one-shot, /mongo <url>
├── src/
│   ├── client.js           # NiyoXClient — HTTP + in-memory history
│   └── storage.js          # NiyoXStorage — custom MongoDB support ✨
├── lib/                    # auto-generated by scripts/build.js
│   ├── index.cjs
│   └── index.mjs
├── react/
│   └── useNiyoX.js         # useNiyoX hook + NiyoXChat + NiyoXProvider ✨
├── html/
│   └── index.html          # browser chat UI
├── examples/
│   ├── react-cra/App.jsx   # Create React App / Vite + React ✨
│   ├── nextjs/             # Next.js App Router ✨
│   └── vite/main.js        # Vite vanilla JS ✨
├── test/
│   ├── client.test.js
│   ├── sdk.test.js
│   └── cli.test.js
└── scripts/
    └── build.js
```

---

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif" width="100%"/>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=120&section=footer&animation=twinkling" width="100%"/>

[![API](https://img.shields.io/badge/API_Endpoint-ai.dnuz.top-a044ff?style=for-the-badge&labelColor=0d0d1a)](https://ai.dnuz.top)
&nbsp;
[![GitHub](https://img.shields.io/badge/GitHub-dnuzi%2Fniyox-ffd93d?style=for-the-badge&labelColor=0d0d1a&logo=github&logoColor=ffd93d)](https://github.com/dnuzi/niyox)

<br/>

**⭐ If this project helped you, star it on GitHub!**

<img src="https://media.giphy.com/media/LnQjpWaON8nhr21vNW/giphy.gif" width="60"/> <em>Happy coding!</em>

</div>
