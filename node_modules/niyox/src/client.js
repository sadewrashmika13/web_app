// src/client.js — NiyoX AI Core Client
"use strict";

const BASE_URL = "https://ai.dnuz.top/api/ai";

/**
 * NiyoXClient — the core wrapper around the NiyoX AI REST API.
 */
class NiyoXClient {
  constructor(options = {}) {
    this.sessionId       = options.sessionId       || "default";
    this.conversationId  = options.conversationId  || null;
    this.timeout         = options.timeout         || 30000;
    this.history         = [];          // in-memory chat history
  }

  /**
   * Send a message to NiyoX AI and get a response.
   * @param {string} message
   * @returns {Promise<{result: string, conversationId: string, responseTime: number}>}
   */
  async chat(message) {
    const params = new URLSearchParams({ q: message });
    if (this.conversationId) params.append("conversationId", this.conversationId);
    if (this.sessionId !== "default") params.append("sessionId", this.sessionId);

    const url = `${BASE_URL}?${params.toString()}`;

    // Dynamic import for ESM fetch polyfill compatibility
    const fetch = globalThis.fetch ?? (await import("node-fetch").then(m => m.default).catch(() => null));
    if (!fetch) throw new Error("No fetch available — install node-fetch or use Node 18+");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let data;
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }

    if (!data.success) throw new Error("API returned success=false");

    // Persist conversation ID for multi-turn conversations
    if (data.conversationId) this.conversationId = data.conversationId;

    // Store in in-memory history
    this.history.push({ role: "user",      content: message,     timestamp: new Date() });
    this.history.push({ role: "assistant", content: data.result, timestamp: new Date(), responseTime: data.responseTime });

    return {
      result:         data.result,
      conversationId: data.conversationId,
      sessionId:      data.sessionId,
      responseTime:   data.responseTime,
      attempts:       data.attempts,
    };
  }

  /** Alias for chat() */
  async ask(message) { return this.chat(message); }

  /** Clear in-memory history and start a fresh conversation */
  newConversation() {
    this.conversationId = null;
    this.history = [];
  }

  /** Get in-memory chat history */
  getHistory() { return [...this.history]; }
}

module.exports = { NiyoXClient, BASE_URL };
