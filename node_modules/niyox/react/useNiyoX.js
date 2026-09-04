// react/useNiyoX.js — NiyoX AI React hook & context provider
// Works in React, Vite, Next.js (client components), Create React App
//
// Install:  npm install niyox
// Then copy this file into your project, or import from "niyox/react"

"use client"; // Next.js App Router — safe to include, ignored elsewhere

import { useState, useCallback, useRef, createContext, useContext } from "react";

// ── tiny browser-safe NiyoX client ──────────────────────────────────────────
const BASE_URL = "https://ai.dnuz.top/api/ai";

class NiyoXBrowserClient {
  constructor({ sessionId = "default" } = {}) {
    this.sessionId      = sessionId;
    this.conversationId = null;
    this.history        = [];
  }

  async chat(message) {
    const params = new URLSearchParams({ q: message });
    if (this.conversationId) params.set("conversationId", this.conversationId);
    if (this.sessionId !== "default") params.set("sessionId", this.sessionId);

    const res  = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) throw new Error("API returned success=false");

    if (data.conversationId) this.conversationId = data.conversationId;

    const ts = new Date();
    this.history.push({ role: "user",      content: message,     timestamp: ts });
    this.history.push({ role: "assistant", content: data.result, timestamp: ts,
                        responseTime: data.responseTime });
    return data;
  }

  newConversation() { this.conversationId = null; this.history = []; }
  getHistory()      { return [...this.history]; }
}

// ── useNiyoX hook ────────────────────────────────────────────────────────────
/**
 * useNiyoX — drop-in React hook for NiyoX AI chat.
 *
 * @param {object}  options
 * @param {string}  [options.sessionId="default"]
 * @param {boolean} [options.autoScroll=true]   reserved for future use
 *
 * @returns {{
 *   messages:        Array<{role, content, timestamp, responseTime?}>,
 *   input:           string,
 *   setInput:        Function,
 *   isLoading:       boolean,
 *   error:           string|null,
 *   sendMessage:     (text?: string) => Promise<void>,
 *   newConversation: () => void,
 *   conversationId:  string|null,
 * }}
 *
 * @example
 *   function Chat() {
 *     const { messages, input, setInput, sendMessage, isLoading } = useNiyoX();
 *
 *     return (
 *       <div>
 *         {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.content}</p>)}
 *         <input value={input} onChange={e => setInput(e.target.value)} />
 *         <button onClick={() => sendMessage()} disabled={isLoading}>Send</button>
 *       </div>
 *     );
 *   }
 */
export function useNiyoX(options = {}) {
  const clientRef = useRef(null);
  if (!clientRef.current) clientRef.current = new NiyoXBrowserClient(options);

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState(null);
  const [convId,    setConvId]    = useState(null);

  const sendMessage = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setError(null);
    setMessages(prev => [...prev, { role: "user", content: text, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const data = await clientRef.current.chat(text);
      setConvId(clientRef.current.conversationId);
      setMessages(prev => [...prev, {
        role:         "assistant",
        content:      data.result,
        timestamp:    new Date(),
        responseTime: data.responseTime,
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const newConversation = useCallback(() => {
    clientRef.current.newConversation();
    setMessages([]);
    setConvId(null);
    setError(null);
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    sendMessage,
    newConversation,
    conversationId: convId,
  };
}

// ── Context / Provider (share one AI session across components) ──────────────
const NiyoXContext = createContext(null);

/**
 * <NiyoXProvider> — wrap your app (or a subtree) to share a single AI session.
 *
 * @example
 *   // _app.jsx  or  layout.tsx (Next.js App Router)
 *   import { NiyoXProvider } from "./useNiyoX";
 *
 *   export default function RootLayout({ children }) {
 *     return <NiyoXProvider sessionId="global"><html><body>{children}</body></html></NiyoXProvider>;
 *   }
 *
 *   // Any child component:
 *   import { useNiyoXContext } from "./useNiyoX";
 *   const { sendMessage, messages } = useNiyoXContext();
 */
export function NiyoXProvider({ children, ...options }) {
  const value = useNiyoX(options);
  return (
    <NiyoXContext.Provider value={value}>
      {children}
    </NiyoXContext.Provider>
  );
}

/**
 * useNiyoXContext — consume the shared NiyoX session from <NiyoXProvider>.
 * Must be called inside a <NiyoXProvider> tree.
 */
export function useNiyoXContext() {
  const ctx = useContext(NiyoXContext);
  if (!ctx) throw new Error("useNiyoXContext must be used inside <NiyoXProvider>");
  return ctx;
}

// ── ready-made <NiyoXChat> component ─────────────────────────────────────────
/**
 * <NiyoXChat> — a fully functional, zero-dependency chat widget.
 *
 * @param {object}  props
 * @param {string}  [props.sessionId]
 * @param {string}  [props.placeholder="Ask anything…"]
 * @param {string}  [props.title="NiyoX AI"]
 * @param {object}  [props.style]        override container styles
 * @param {string}  [props.className]
 *
 * @example
 *   import { NiyoXChat } from "./useNiyoX";
 *   <NiyoXChat title="My AI Assistant" />
 */
export function NiyoXChat({ sessionId, placeholder = "Ask anything…", title = "NiyoX AI", style, className }) {
  const { messages, input, setInput, sendMessage, isLoading, error, newConversation } = useNiyoX({ sessionId });

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "system-ui, sans-serif", ...style }}>
      {/* header */}
      <div style={{ padding: "12px 16px", background: "linear-gradient(135deg,#2d1b69,#4a00c8)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "12px 12px 0 0" }}>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>✦ {title}</span>
        <button onClick={newConversation} title="New conversation" style={{ background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: ".8rem" }}>New</button>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#0d0d1a" }}>
        {messages.length === 0 && (
          <div style={{ color: "#555", fontSize: ".9rem", textAlign: "center", marginTop: 32 }}>Start a conversation!</div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            maxWidth: "80%", padding: "10px 14px", borderRadius: 14,
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            background: m.role === "user" ? "linear-gradient(135deg,#2d1b69,#4a00c8)" : "#1a1a2e",
            color: "#e0e0f0", fontSize: ".92rem", lineHeight: 1.5,
            border: m.role === "assistant" ? "1px solid #2a2a4a" : "none",
          }}>
            <div>{m.content}</div>
            {m.responseTime && <div style={{ fontSize: ".7rem", color: "#a044ff", marginTop: 4 }}>⚡ {m.responseTime}ms</div>}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: "flex-start", color: "#a044ff", fontSize: ".85rem", padding: "8px 14px" }}>
            NiyoX AI is thinking…
          </div>
        )}
        {error && (
          <div style={{ color: "#ff6b6b", fontSize: ".85rem", padding: "4px 0" }}>⚠ {error}</div>
        )}
      </div>

      {/* input */}
      <div style={{ display: "flex", gap: 8, padding: 12, background: "#0d0d1a", borderTop: "1px solid #1a1a2e", borderRadius: "0 0 12px 12px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={isLoading}
          style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2a2a4a", color: "#e0e0f0", padding: "10px 14px", borderRadius: 10, fontSize: ".95rem", outline: "none" }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          style={{ background: "linear-gradient(135deg,#00d2ff,#a044ff)", border: "none", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, cursor: "pointer", opacity: (isLoading || !input.trim()) ? 0.45 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default useNiyoX;
