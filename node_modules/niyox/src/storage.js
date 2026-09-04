// src/storage.js — Optional MongoDB persistence layer
"use strict";

const DEFAULT_MONGO_URI = "mongodb+srv://danuzdev_db_user:eUcIyqvRaNEKnAtA@niyoxai.tzrs4rg.mongodb.net/";
const DEFAULT_DB_NAME   = "niyox_npm";

// Per-URI connection cache so multiple NiyoXStorage instances
// pointing at the same DB share one MongoClient.
const _cache = new Map(); // uri → { client, db }

async function getDb(uri = DEFAULT_MONGO_URI, dbName = DEFAULT_DB_NAME) {
  const cacheKey = `${uri}::${dbName}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey).db;

  try {
    const { MongoClient } = require("mongodb");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db(dbName);
    _cache.set(cacheKey, { client, db });
    return db;
  } catch (err) {
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
}

async function closeDb(uri = DEFAULT_MONGO_URI, dbName = DEFAULT_DB_NAME) {
  const cacheKey = `${uri}::${dbName}`;
  const entry = _cache.get(cacheKey);
  if (entry) {
    await entry.client.close();
    _cache.delete(cacheKey);
  }
}

/** Close ALL open MongoDB connections (useful in tests / process exit) */
async function closeAllDb() {
  for (const [, entry] of _cache) await entry.client.close();
  _cache.clear();
}

/**
 * NiyoXStorage — handles optional persistent chat/session storage.
 *
 * @example  Default (NiyoX cloud DB):
 *   const store = new NiyoXStorage("alice");
 *   await store.connect();
 *
 * @example  Your own MongoDB:
 *   const store = new NiyoXStorage("alice", {
 *     mongoUri: "mongodb+srv://user:pass@cluster.mongodb.net/",
 *     dbName:   "my_app_db",
 *   });
 *   await store.connect();
 */
class NiyoXStorage {
  /**
   * @param {string} userId  - Identifies the user; stored with every message.
   * @param {object} options
   * @param {string} [options.mongoUri]  - Custom MongoDB connection string.
   * @param {string} [options.dbName]   - Database name (default: "niyox_npm").
   */
  constructor(userId = "anonymous", options = {}) {
    this.userId   = userId;
    this.mongoUri = options.mongoUri || DEFAULT_MONGO_URI;
    this.dbName   = options.dbName   || DEFAULT_DB_NAME;
    this.enabled  = false;
  }

  /** @private */
  _getDb() { return getDb(this.mongoUri, this.dbName); }

  /**
   * Connect to MongoDB and enable storage.
   * @param {string} [userId]         - Override the userId set in the constructor.
   * @param {string} [mongoUri]       - Override the connection string at connect-time.
   * @param {string} [dbName]         - Override the database name at connect-time.
   */
  async connect(userId, mongoUri, dbName) {
    if (userId)   this.userId   = userId;
    if (mongoUri) this.mongoUri = mongoUri;
    if (dbName)   this.dbName   = dbName;
    await this._getDb();   // throws if connection fails
    this.enabled = true;
    return this;
  }

  /** Save a single message turn */
  async saveMessage({ conversationId, role, content, responseTime = null }) {
    if (!this.enabled) return null;
    const db   = await this._getDb();
    const coll = db.collection("messages");
    const doc  = {
      userId:         this.userId,
      conversationId,
      role,
      content,
      responseTime,
      createdAt: new Date(),
    };
    const res = await coll.insertOne(doc);
    return res.insertedId;
  }

  /** Save a full chat turn (user + assistant) atomically */
  async saveTurn({ conversationId, userMessage, assistantMessage, responseTime }) {
    if (!this.enabled) return;
    await Promise.all([
      this.saveMessage({ conversationId, role: "user",      content: userMessage }),
      this.saveMessage({ conversationId, role: "assistant", content: assistantMessage, responseTime }),
    ]);
  }

  /** Retrieve all messages for a conversation */
  async getConversation(conversationId) {
    if (!this.enabled) return [];
    const db = await this._getDb();
    return db.collection("messages")
      .find({ conversationId, userId: this.userId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  /** List all conversation IDs for this user */
  async listConversations() {
    if (!this.enabled) return [];
    const db = await this._getDb();
    return db.collection("messages")
      .distinct("conversationId", { userId: this.userId });
  }

  /** Delete a conversation */
  async deleteConversation(conversationId) {
    if (!this.enabled) return 0;
    const db  = await this._getDb();
    const res = await db.collection("messages").deleteMany({ conversationId, userId: this.userId });
    return res.deletedCount;
  }

  /** Save arbitrary key/value user preference */
  async setPref(key, value) {
    if (!this.enabled) return;
    const db = await this._getDb();
    await db.collection("user_prefs").updateOne(
      { userId: this.userId, key },
      { $set: { value, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  /** Get a user preference */
  async getPref(key, defaultValue = null) {
    if (!this.enabled) return defaultValue;
    const db  = await this._getDb();
    const doc = await db.collection("user_prefs").findOne({ userId: this.userId, key });
    return doc ? doc.value : defaultValue;
  }

  /** Usage statistics for this user */
  async getStats() {
    if (!this.enabled) return null;
    const db   = await this._getDb();
    const coll = db.collection("messages");
    const [total, conversations, avgTime] = await Promise.all([
      coll.countDocuments({ userId: this.userId }),
      coll.distinct("conversationId", { userId: this.userId }),
      coll.aggregate([
        { $match: { userId: this.userId, role: "assistant", responseTime: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$responseTime" } } },
      ]).toArray(),
    ]);
    return {
      totalMessages:       total,
      totalConversations:  conversations.length,
      avgResponseTimeMs:   avgTime[0]?.avg?.toFixed(0) ?? "N/A",
    };
  }

  async disconnect() {
    await closeDb(this.mongoUri, this.dbName);
    this.enabled = false;
  }
}

module.exports = { NiyoXStorage, getDb, closeDb, closeAllDb };
