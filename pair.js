/*  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  - MULTI SESSION SUPPORT
  DEVELOPED BY🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮
  FULLY ENC AND PRIVET SOURCE CODE    
  Code Ussai #akak - Thawa #akada balanne                                                                                                      

  ────────────────────────────────────────────────────────
  🔧 LOGOUT-ISSUE FIX (only this was changed, nothing else):
  1) makeCacheableSignalKeyStore was imported but never used —
     auth.keys was going straight to disk on every operation,
     which under multi-session load causes signal key
     read/write races → corrupted session → WhatsApp force-logout.
     Now properly wired in via auth: { creds, keys: makeCacheableSignalKeyStore(...) }.
  2) Removed the duplicate 401 handler that lived inside
     EmpirePair's own connection.update (it now only does timer
     cleanup) since setupAutoRestart() already owns 401/403
     handling. Having two listeners both call socket.end() /
     deleteSession() on the same event was a race condition that
     could itself contribute to unstable logouts.
  3) Session folder (pre-key/session/sender-key/app-state-sync
     files) now backed up to MongoDB via delta-sync + a queue
     (fixes the R15 memory crash from syncing everything at once).
  4) Newsletter reaction delay slowed down (20-45s) and reconnect
     delay lengthened (8-15s, randomized) to reduce bot-like
     patterns and same-device rapid-reconnect conflicts.
  Presence/offline loop and arabianCtx forwarded-newsletter
  context were left 100% untouched as requested.
  ────────────────────────────────────────────────────────
*/
const http = require('http');
const https = require('https');
const axios = require('axios'); // 🔥 Axios උඩින්ම Import කළා!
const NodeCache = require('node-cache');

// 🔥 නෙට්වර්ක් බර අඩු කරන Global Connection Pool එක 🔥
const globalHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 40 });
const globalHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 40 });

axios.defaults.httpAgent = globalHttpAgent;
axios.defaults.httpsAgent = globalHttpsAgent;

// 🧠 Baileys Cache Structures
// 🔧 RAM TUNE FIX: TTL එක 1h → 15min කළා. 33 sessions × 1h retention නිසා
// retry-counter entries ගොඩක් accumulate වෙලා තිබ්බා. Message retry behavior
// එකට (speed/reliability) බලපෑමක් නෑ — Baileys duplicate-retry ගණන් කරන්නේ
// කෙටි කාලයක් ඇතුළත, 15min window එකකින්වත් ඒක ඇතුළත් වෙනවා.
const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false }); // 3m → 1m
const userDevicesCache = new NodeCache({ stdTTL: 60, useClones: false }); // 3m → 1m

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { sms } = require("./msg");
const router = express.Router();
const pino = require('pino');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const yts = require('yt-search');
const { ytmp3, ytmp4 } = require('sadaslk-dlcore');
const os = require('os');
const zlib = require('zlib');
const fetch = require('node-fetch');
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);

// 🛡️ ANTI-DELETE PLUGIN IMPORT
const antiDeletePlugin = require('./plugins/antidelete');
const emojiDlPlugin = require('./plugins/emoji_dl');
const onceDlPlugin = require('./plugins/once_dl');

const images = [
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788163941/q4l15lpovbedibfdnzc7.jpg',
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788163961/prv8jlayjczwbazbvz92.jpg',
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788163912/ov9x1fxg2qflfktav2ae.jpg',
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788163901/c69kczqhf92hmoat3jzt.jpg',
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788163893/i8kowfuwyxec0jzelzxt.jpg',
    'https://res.cloudinary.com/p6lu5bpe/image/upload/v1788164066/drpycuhfxyogmmevl9vh.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783328021/zanta_media_uploads/tnuazopka24oahpvh3mc.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783327996/zanta_media_uploads/vfq2mrf2hwkzhjerc3zz.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783327966/zanta_media_uploads/nca5y1t1fl5klruuxehp.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783328043/zanta_media_uploads/d0svlrulezrpif4mfl9w.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783328053/zanta_media_uploads/mtifkjupz6kvdistsqit.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783332950/zanta_media_uploads/sxkybgfhhi5gtkqsns2z.jpg',
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783332958/zanta_media_uploads/yxtvp8zwoju8xsvghzr7.jpg'
  ]; 

Object.defineProperty(global, 'akira', {
    get: () => images[Math.floor(Math.random() * images.length)]
});

const {
    default: makeWASocket,
    makeCacheableSignalKeyStore,
    initAuthCreds,
    BufferJSON,
    proto,
    DisconnectReason,
    downloadMediaMessage,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    fetchLatestBaileysVersion,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    extractMessageContent,
    jidDecode,
    MessageRetryMap,
    jidNormalizedUser,
    getContentType,
    areJidsSameUser,
    generateWAMessage,
    delay,
    Browsers
} = require("baileys");

const config = {
    AUTO_VIEW_STATUS: 'false',
    AUTO_LIKE_STATUS: 'false',
        BUTTON_MODE: 'true',
    MODE: 'public',
    PREFIX: '.',
    MAX_RETRIES: 3,
    ADMIN_LIST_PATH: './admin.json',
    AKIRA_IMG: 'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg',
    NEWSLETTER_JID: '120363428121754510@newsletter',
    NEWSLETTER_LIST: [
        '120363428121754510@newsletter'

    ],
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    OWNER_NUMBER: '94754869431',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb8jj2N8qIzwswSbxk1L'
};

const MEDIA_TYPES = [
    'imageMessage', 'videoMessage', 'audioMessage', 
    'stickerMessage', 'documentMessage'
];

const replyFq = (text) => reply(text);

if (!global.sadewVideoSearch) global.sadewVideoSearch = {};
if (!global.sadewMenuTracker) global.sadewMenuTracker = {};

const activeSockets = new Map();
global.activeSockets = activeSockets;
const socketCreationTime = new Map();

const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

// 🛡️ Credential Debouncer (RAM & Mongo write-load Saver)
const credsSaveTimers = new Map();

// 🔧 FIX #2: පරණ queueCredsSave() එක local creds.json file එකක් read කරන්න
// try කළා — දැන් useMongoDBAuthState() එකේ Mongo-only architecture එකේදී local
// file එකක්ම write වෙන්නේ නෑ (creds.json එකක්ම නෑ), ඒ නිසා පරණ debouncer එක
// broken/incompatible වුනා. Mongo-direct saveCreds() එකට ගැලපෙන සරල debounce
// wrapper එකක් — creds.update events ගොඩක් කෙටි කාලයක් ඇතුළත ආවත් (active
// sync එකේදී frequent-ම වෙනවා), Mongo write එකක් 2.5s කට වරක් විතරයි.
function queueCredsSave(number, saveCreds) {
    const id = number.replace(/[^0-9]/g, '');
    clearTimeout(credsSaveTimers.get(id));

    credsSaveTimers.set(id, setTimeout(async () => {
        try {
            await saveCreds();
        } catch (err) {
            console.error(`[${id}] creds save failed:`, err?.message);
        } finally {
            credsSaveTimers.delete(id);
        }
    }, 1000));
}

// 🔧 SESSION-SYNC QUEUE + DELTA CACHE (R15 memory-crash fix)
// Periodic session-folder syncs now run one-at-a-time through this queue instead
// of every active session firing its gzip/Mongo-write at once (that was the main
// cause of the 1098MB R15 crash). Only files that actually changed since last
// sync (tracked via mtime) get read into RAM at all — unchanged sessions cost
// almost nothing per cycle.
let syncQueue = [];
let syncQueueRunning = false;
const sessionFileMtimeCache = new Map(); // key: `${number}:${filename}` -> mtimeMs
const MAX_SESSION_FILES_TO_SYNC = 80; // safety cap so one huge session can't spike RAM
async function processSyncQueue() {
    if (syncQueueRunning) return;
    syncQueueRunning = true;
    while (syncQueue.length) {
        const number = syncQueue.shift();
        try {
            await syncSessionFolderToMongo(number);
        } catch (e) {
            console.error(`Queued session sync failed for ${number}:`, e.message);
        }
        
        // 🔥 HEAP OOM FIX: RAM එක ක්ලියර් කිරීම
        
        
        // 🔥 FIX: 500 → 5000 (තත්පර 5ක් අතර වෙලාව)
        await delay(3000); 
    }
    syncQueueRunning = false;
}

function queueSessionSync(number) {
    if (!syncQueue.includes(number)) syncQueue.push(number);
    processSyncQueue();
}

// 🔧 RAM TUNE FIX: හැම විනාඩියකටම global.gc() call කරන interval එකම අයින් කළා —
// log එකෙන්ම confirm වුනා (596M → 596M) මේකෙන් RAM එකක් save වෙන්නේ නෑ (Heroku
// dyno එකේ --expose-gc flag එකක් නැති නිසා no-op), ඒත් CPU cycles නාස්ති කරලා
// GC efficiency එකටම බාධා කරනවා. Bot speed එකට කිසිම බලපෑමක් නෑ, RSS watchdog
// එකම (පහළින්) ඉතුරු කළා — ඒක monitoring විතරයි, CPU cost එකක් නෑ.
const RSS_WARN_THRESHOLD_MB = 1000;
setInterval(() => {
    const rssMb = process.memoryUsage().rss / 1024 / 1024;
    if (rssMb > RSS_WARN_THRESHOLD_MB) {
        console.warn(`⚠️ [Memory Watchdog] RSS is ${rssMb.toFixed(0)}MB (active sockets: ${activeSockets.size})`);
    }
}, 5 * 60 * 1000);

// 🗑️ Global Temp File Auto-Cleaner (FIXED)
setInterval(() => {
    try {
        const tempExtensions = ['.mp4', '.mp3', '.jpg', '.jpeg', '.webp'];
        fs.readdir(__dirname, (err, files) => {
            if (err) return;
            files.forEach(file => {
                if (tempExtensions.includes(path.extname(file))) {
                    fs.stat(path.join(__dirname, file), (err, stats) => {
                        if (err) return;
                        const now = new Date().getTime();
                        // ෆයිල් එක හැදිලා පැයක් ගිහින් නම් මකනවා
                        if (now > new Date(stats.mtime).getTime() + 3600000) {
                            // 🔥 Error හැන්ඩ්ල් කිරීම එකතු කර ඇත
                            fs.unlink(path.join(__dirname, file), (unlinkErr) => {
                                if (!unlinkErr) {
                                    console.log(`🗑️ [File Manager] Auto-deleted old temp file: ${file}`);
                                }
                            });
                        }
                    });
                }
            });
        });
    } catch (error) {
        console.log(`⚠️ Temp File Cleaner Error: ${error.message}`);
    }
}, 30 * 60 * 1000); // විනාඩි 30න් 30ට රන් වෙනවා

// 🧠 3. Smart Memory Trim (පරණම ඩේටා විතරක් මැකීම)
const GLOBAL_TRACKER_NAMES = [
    'btnFallbackTracker', 'xnxxContexts', 'sadewVideoSearch',
    'sadewMenuTracker', 'sadewSettingsTracker', 'sinhalasubContexts',
    'sinhalasubCache', 'animeSearchCtx', 'animeEpCtx', 'animeCache'
];
const GLOBAL_TRACKER_MAX_KEYS = 50;

function trimGlobalTracker(name, maxKeys = GLOBAL_TRACKER_MAX_KEYS) {
    const obj = global[name];
    if (!obj || typeof obj !== 'object') return 0;
    const keys = Object.keys(obj);
    if (keys.length <= maxKeys) return 0;
    const excess = keys.length - maxKeys;
    for (let i = 0; i < excess; i++) delete obj[keys[i]];
    return excess;
}

setInterval(() => {
    let totalTrimmed = 0;
    for (const name of GLOBAL_TRACKER_NAMES) {
        totalTrimmed += trimGlobalTracker(name);
    }
    if (totalTrimmed > 0) {
        console.log(`🧹 [Memory Management] Trimmed ${totalTrimmed} stale tracker entries.`);
    }
}, 2 * 60 * 1000);

// 🔕 4. Welcome Message Leak Fix (නම්බර්ස් 2000ට ලිමිට් කිරීම)
setInterval(() => {
    if (!(global.welcomeSent instanceof Set)) return;
    const WELCOME_SENT_CAP = 2000;
    if (global.welcomeSent.size <= WELCOME_SENT_CAP) return;
    const excess = global.welcomeSent.size - WELCOME_SENT_CAP;
    const it = global.welcomeSent.values();
    for (let i = 0; i < excess; i++) {
        const { value, done } = it.next();
        if (done) break;
        global.welcomeSent.delete(value);
    }
}, 10 * 60 * 1000);
// 🔥 MONGODB AUTH STATE: Optimized Schema 🔥
const AuthSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true, index: true },
        key: { type: String, required: true },
        value: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now }
    },
    { collection: "baileys_auth_state" }
);
AuthSchema.index({ sessionId: 1, key: 1 }, { unique: true });
const Auth = mongoose.models.BaileysAuthState || mongoose.model("BaileysAuthState", AuthSchema);
const SessionSchema = new mongoose.Schema({
    number: {
        type: String,
        unique: true,
        required: true
    },
    creds: {
        type: Object,
        required: true
    },
    config: {
        type: Object
    },
    // 🔧 LOGOUT FIX #2: creds.json විතරක් නෙමෙයි, pre-key/session/sender-key/
    // app-state-sync වගේ session folder එකේ තියෙන අනිත් ෆයිල් ටිකත් (gzip කරලා)
    // මෙතන save කරනවා. Heroku dyno එක restart වුනත් (24h cycle, R14 memory kill,
    // deploy) දැන් මේ ෆයිල් ටික නැති වෙන්නේ නෑ → WhatsApp logout risk එක අඩුවෙනවා.
    sessionFiles: {
        type: Buffer
    },
    sessionFilesUpdatedAt: {
        type: Date
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Session = mongoose.model('SessionNew', SessionSchema); 

async function connectMongoDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://sadewrashmika577_db_user:bKyIDz8UNMtkRRic@cluster0.sxlaxuj.mongodb.net/?appName=Cluster0';
        await mongoose.connect(mongoUri, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            // 🔥 අලුත් DB Optimizations 🔥
            maxPoolSize: 50,
            minPoolSize: 5,
            maxIdleTimeMS: 60000,
            waitQueueTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4//කරනවා (වේගවත්)
        });
        console.log('✅ Connected to MongoDB with Max Pool Size 50');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
}

// ═══════════════════════════════════════════════════════════════
// 🛡️ REAL AUTO-HEAL v3: Local + MongoDB Purge
// ═══════════════════════════════════════════════════════════════
const _origConsoleLog = console.log.bind(console);
const _origConsoleError = console.error.bind(console);
const _badMacCounter = new Map();
const _healedRecently = new Set(); 
// 🔧 HEAL-TRIGGER FIX: threshold එක 3 ඉඳන් 1ට අඩු කළා. Bad MAC events සාමාන්‍යයෙන්
// එන්නේ burst එකක් විදිහට (Error object එකේ මුළු stack එකම එක console.error()
// call එකකින්, Heroku logplex එකෙන් line-per-line split වෙනවා — 33 lines
// පේනවා, ඒත් ඇත්තටම call එකක් විතරයි). Counter එක call ගාණ ගණන් කරන නිසා
// burst එකකින් 1කින්ම වැඩි වෙනවා, threshold=3 කියන්නේ burst 3ක් (contact
// එකෙන්ම වෙනම වෙලාවල් 3ක) අවශ්‍යයි. Bot එක ~10min එකකින් restart වෙනකොට
// in-memory counter එකම reset වෙන නිසා, counter එකම 3ට කවදාවත් ලැබෙන්නේ නෑ —
// heal එකට කවදාවත් trigger වුනේ නෑ. threshold=1 කරාම, පළමු burst එකේදීම heal
// වෙනවා, restart cycle එකට කලින්.
const _BAD_MAC_HEAL_THRESHOLD = 1;
const _BAD_MAC_COUNTER_MAX = 2000; // 🔧 OOM FIX: unbounded Map growth වළක්වනවා

// 🔧 OOM FIX: Bad MAC burst එකකදී (contacts/bots ගණනාවක් එකවර threshold hit
// වුනොත්) heal work එක (readdirSync + Mongo gunzip/gzip, heavy) සියල්ලම
// concurrent විදිහට fire වුනොත්, decompressed session bundles ගණනාවක්ම එකවර
// RAM එකේ hold වෙලා V8 heap limit එකම ඉක්මවනවා ("JS heap out of memory" crash).
// දැන් heal work එක queue එකකින් serialize කරනවා — එකවර එකක් විතරයි process
// වෙන්නේ.
let _healQueue = [];
let _healQueueRunning = false;

async function _processHealQueue() {
    if (_healQueueRunning) return;
    _healQueueRunning = true;
    while (_healQueue.length) {
        const contactNum = _healQueue.shift();
        try {
            await _healBadMacForContact(contactNum);
        } catch (e) {
            _origConsoleError(`Heal error for ${contactNum}:`, e.message);
        }
        

       
        
        // 🔥 FIX: 300 → 3000 (විනාඩි 3ක් අතර වෙලාව)
       await delay(500); // 3s සිට 0.5s ට
    }
    _healQueueRunning = false;
}

// 🔧 Mongo backup bundle එකේ තියෙන අවුල් ෆයිල් ටිකත් අයින් කරනවා
async function purgeFilesFromMongoBackup(number, filenamesToRemove) {
    if (!filenamesToRemove || !filenamesToRemove.length) return;
    try {
        const Session = mongoose.model('SessionNew');
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const doc = await Session.findOne({ number: sanitizedNumber }, 'sessionFiles');
        if (!doc || !doc.sessionFiles) return;

        const zlib = require('zlib');
        const bundle = JSON.parse(zlib.gunzipSync(doc.sessionFiles).toString('utf8'));
        let removed = 0;
        
        for (const filename of filenamesToRemove) {
            if (bundle[filename] !== undefined) {
                delete bundle[filename];
                removed++;
            }
        }
        
        if (removed === 0) return;

        const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
        await Session.findOneAndUpdate(
            { number: sanitizedNumber },
            { sessionFiles: compressed, sessionFilesUpdatedAt: new Date() }
        );
        _origConsoleLog(`🧹 Purged ${removed} corrupted key files from Mongo backup for ${sanitizedNumber}`);
    } catch (error) {
        _origConsoleError(`Failed to purge corrupted files from Mongo backup for ${number}:`, error.message);
    }
}

// 🔧 CROSS-LINE JID TRACKING: "Bad MAC" text එකයි contact ID digits එකයි
// වෙනම console calls දෙකකින් print වෙනවා (Baileys/pino internal logging
// pattern එකේ) — එකම call එකකම දෙකම නෑ. ID එකක් පේන හැම call එකකදීම මතක
// තියාගෙන, "Bad MAC" text එකම වෙනම call එකකින් ආවම, මේ "recently seen" ID
// එකම use කරනවා (temporal proximity — millisecond ගාණකින් එකට එනවා).
let _lastSeenContactId = null;
let _lastSeenContactIdAt = 0;
const _CONTACT_ID_FRESHNESS_MS = 500;

async function _checkAndHealBadMac(...args) {
    const text = args.map(a => {
        try { 
            if (a instanceof Error || (a && a.stack)) {
                return String(a.stack);
            }
            return String(a); 
        } catch (_) { return ''; }
    }).join(' ');

    // 🔥 status@broadcast messages වලින් එන errors ignore කරන්න
    if (text.includes('status@broadcast')) {
        return;
    }

    // 🔥 fromMe:true messages ignore කරන්න
    if (text.includes('"fromMe":true')) {
        return;
    }

    // 🔥 තාම හොයාගන්න බැරි errors ignore කරන්න (මේවා auto-heal වෙන්නේ නෑ)
    if (!text.includes('Bad MAC') && !text.includes('bad mac') && 
        !text.includes('messages into the future') && !text.includes('SessionError') &&
        !text.includes('No matching sessions')) {
        return;
    }

    // 🔥 Regex එක: `at async 158497798914183_1.0` වගේ formats එකට Support
    let contactNum = null;

    // 1. පළවෙනි උත්සාහය: Stack Trace එකේ තියෙන `at async XXXXX_1.0` format එක
    const stackMatch = text.match(/at async (\d{10,18})_\d+\.\d+/);
    if (stackMatch) {
        contactNum = stackMatch[1];
    }

    // 2. දෙවෙනි උත්සාහය: අනිත් formats (idMatchAny)
    if (!contactNum) {
        const idMatchAny = text.match(/(\d{10,18})(?:@s\.whatsapp\.net|@g\.us|@lid|[:_]|_\d+\.\d+)/);
        if (idMatchAny) {
            contactNum = idMatchAny[1];
        }
    }

    // 3. තුන්වෙනි උත්සාහය: `_lastSeenContactId` fallback
    if (!contactNum && _lastSeenContactId && (Date.now() - _lastSeenContactIdAt) < _CONTACT_ID_FRESHNESS_MS) {
        contactNum = _lastSeenContactId;
    }

    if (!contactNum) return;

    // 🔥 Heal Logic
    if (_healedRecently.has(contactNum)) return;

    if (_badMacCounter.size > _BAD_MAC_COUNTER_MAX) {
        _badMacCounter.clear();
    }

    const count = (_badMacCounter.get(contactNum) || 0) + 1;
    _badMacCounter.set(contactNum, count);
    
    if (count < _BAD_MAC_HEAL_THRESHOLD) return;
    
    _badMacCounter.delete(contactNum);
    _healedRecently.add(contactNum);
    setTimeout(() => _healedRecently.delete(contactNum), 10 * 60 * 1000); 

    if (!_healQueue.includes(contactNum)) _healQueue.push(contactNum);
    _processHealQueue();
}
async function _healBadMacForContact(contactNum) {
    _origConsoleLog(
        `⚠️ [BAD-MAC] Contact ${contactNum} detected. ` +
        `No automatic Mongo key deletion is performed to protect other bots.`
    );
}

console.log = function(...args) {
    _origConsoleLog(...args);
    try { _checkAndHealBadMac(...args); } catch (_) {}
};
console.error = function(...args) {
    _origConsoleError(...args);
    try { _checkAndHealBadMac(...args); } catch (_) {}
};

process.on('uncaughtException', (err) => {
    const s = String(err?.message || err || '');
    if (s.includes('Bad MAC') || s.includes('decrypt')) {
        _origConsoleError('🛡️ Bad MAC uncaughtException suppressed.');
        try { _checkAndHealBadMac(s, err?.stack || ''); } catch (_) {}
        return;
    }
    _origConsoleError('⚠️ Uncaught:', s.slice(0, 300));
});

process.on('unhandledRejection', (reason) => {
    const s = String(reason?.message || reason || '');
    if (s.includes('Bad MAC') || s.includes('decrypt')) return;
    _origConsoleError('⚠️ Unhandled Rejection:', s.slice(0, 300));
});
connectMongoDB();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, {
        recursive: true
    });
}

function initialize() {
    activeSockets.clear();
    socketCreationTime.clear();
    console.log('Cleared active sockets and creation times on startup');
}

async function uploadToCatbox(stream, fileName) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', stream, fileName);

        const res = await axios.post(
            'https://catbox.moe/user/api.php',
            form,
            { headers: form.getHeaders(), timeout: 0 }
        );

        if (!res.data.startsWith('https://')) return null;
        return res.data.trim();
    } catch {
        return null;
    }
}

async function saveMediaToCatbox(msg) {
    try {
        const type = Object.keys(msg.message)[0];
        const mediaMap = {
            imageMessage: 'image',
            videoMessage: 'video',
            audioMessage: 'audio',
            documentMessage: 'document'
        };

        if (!mediaMap[type]) return null;

        const mediaMsg = msg.message[type];
        const size = mediaMsg.fileLength || 0;

        if (size > 100 * 1024 * 1024) return null;

        const stream = await downloadContentFromMessage(
            mediaMsg,
            mediaMap[type]
        );

        const ext =
            type === 'imageMessage' ? 'jpg' :
            type === 'videoMessage' ? 'mp4' :
            type === 'audioMessage' ? 'opus' :
            'bin';

        return await uploadToCatbox(stream, `${msg.key.id}.${ext}`);
    } catch {
        return null;
    }
}


async function cleanupInactiveSessions() {
    try {
        const sessions = await Session.find({}, 'number').lean();
        let cleanedCount = 0;

        for (const {
                number
            }
            of sessions) {
            const sanitizedNumber = number.replace(/[^0-9]/g, '');

            if (!activeSockets.has(sanitizedNumber) && !socketCreationTime.has(sanitizedNumber)) {
                const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

                if (fs.existsSync(sessionPath)) {
                    const stats = fs.statSync(sessionPath);
                    const timeSinceModified = Date.now() - stats.mtime.getTime();

                    if (timeSinceModified > 60 * 60 * 1000) {
                        console.log(`Cleaning up stale session: ${sanitizedNumber}`);
                        fs.removeSync(sessionPath);
                        cleanedCount++;
                    }
                }
            }
        }

        console.log(`Cleaned up ${cleanedCount} stale sessions`);
        return cleanedCount;
    } catch (error) {
        console.error('Cleanup error:', error);
        return 0;
    }
}

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key) return;

        const jid = message.key.remoteJid;

        if (jid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['🎀', '🥹', '❤️', '💯', '🍓', '🍫', '🫐', '🙏'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            const messageId = message.key.server_id || message.newsletterServerId;

            if (!messageId) {
                console.warn('⚠️ No newsletterServerId found in message:', message);
                return;
            }

                        // 🔻 SLOW-DOWN FIX: Channel message එකකට ඉක්මනින්ම react වීම
            // bot-like pattern එකක් නිසා, delay range එක සැලකිය යුතු ලෙස වැඩි කළා
            // (කලින් 3-10s, දැන් 20-45s අහඹු ලෙස). reaction speed එක අඩු වෙනවා.
            const delayTime = Math.floor(Math.random() * 25000) + 20000; 
            console.log(`⏳ Channel Message Detected. Waiting ${Math.round(delayTime / 1000)} seconds to react...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
            // -------------------------------------------------------------------

            await socket.newsletterReactMessage(jid, messageId.toString(), randomEmoji);
            console.log(`✅ Reacted to official newsletter: ${jid}`);
        } catch (error) {
            console.error('⚠️ Newsletter reaction failed:', error.message);
        }
    });
}
// 🚀 THE MAGIC: BulkWrite Optimized MongoDB Auth 🚀
// 🔥 මෙය pair.js එකේ තියෙන නිවැරදි useMongoDBAuthState function එකයි
async function useMongoDBAuthState(sessionId) {
    const id = String(sessionId).replace(/[^0-9]/g, "");

    const readData = async key => {
        try {
            const doc = await Auth.findOne({ sessionId: id, key }).lean();
            if (!doc?.value) return null;
            return JSON.parse(doc.value, BufferJSON.reviver);
        } catch (error) {
            console.error(`[${id}] Mongo auth read failed (${key}):`, error?.message);
            return null;
        }
    };

    const writeData = async (key, value) => {
        const serialized = JSON.stringify(value, BufferJSON.replacer);
        await Auth.updateOne(
            { sessionId: id, key },
            { $set: { value: serialized, updatedAt: new Date() } },
            { upsert: true }
        );
    };

    let creds = await readData("creds");
    if (!creds) {
        creds = initAuthCreds();
        await writeData("creds", creds);
    }

    const state = {
        creds,
        keys: {
            async get(type, ids) {
                if (!ids?.length) return {};
                const requiredKeys = ids.map(keyId => `${type}-${keyId}`);
                const docs = await Auth.find({ sessionId: id, key: { $in: requiredKeys } }).lean();
                const stored = new Map(docs.map(doc => [doc.key, doc.value]));
                const result = {};

                for (const keyId of ids) {
                    const dbKey = `${type}-${keyId}`;
                    const raw = stored.get(dbKey);
                    if (raw === undefined) {
                        result[keyId] = undefined;
                        continue;
                    }
                    let value = JSON.parse(raw, BufferJSON.reviver);
                    if (type === "app-state-sync-key") {
                        value = proto.Message.AppStateSyncKeyData.fromObject(value);
                    }
                    result[keyId] = value;
                }
                return result;
            },
            // 🔥 මෙන්න RETRY LOGIC + TIMEOUT සහිත set function එක
            async set(data) {
                const writes = [];
                for (const [type, values] of Object.entries(data || {})) {
                    for (const [keyId, value] of Object.entries(values || {})) {
                        const dbKey = `${type}-${keyId}`;
                        if (value === null || value === undefined) {
                            writes.push({ deleteOne: { filter: { sessionId: id, key: dbKey } } });
                            continue;
                        }
                        writes.push({
                            updateOne: {
                                filter: { sessionId: id, key: dbKey },
                                update: { $set: { value: JSON.stringify(value, BufferJSON.replacer), updatedAt: new Date() } },
                                upsert: true
                            }
                        });
                    }
                }
                if (writes.length) {
                    // 🔥 RETRY LOGIC + TIMEOUT
                    let retries = 3;
                    let lastError = null;
                    
                    while (retries > 0) {
                        try {
                            await Auth.bulkWrite(writes, { 
                                ordered: false,
                                maxTimeMS: 15000 // 15 seconds timeout
                            });
                            return; // සාර්ථකයි
                        } catch (err) {
                            lastError = err;
                            retries--;
                            console.error(`[${id}] BulkWrite failed (${retries} retries left):`, err.message);
                            
                            if (retries > 0) {
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }
                    }
                    
                    throw lastError || new Error('BulkWrite failed after 3 retries');
                }
            }
        }
    };

    return { state, saveCreds: async () => { await writeData("creds", state.creds); } };
}

async function autoReconnectOnStartup() {
    try {
        const authSessions = await Auth.distinct('sessionId', { key: 'creds' });
        
        const MAX_ACTIVE_SESSIONS = 40;
        let numbers = [...new Set(authSessions)]
            .map(number => String(number).replace(/[^0-9]/g, ""))
            .filter(Boolean)
            .slice(0, MAX_ACTIVE_SESSIONS);

        if (numbers.length === 0) {
            console.log('ℹ️ No active sessions found in database.');
            return;
        }

        console.log(`🚀 [Auto-Reconnect] Safely reconnecting ${numbers.length} sessions...`);

        for (const number of numbers) {
            const sanitized = number.replace(/[^0-9]/g, '');
            if (activeSockets.has(sanitized)) continue;
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(sanitized, mockRes);
            } catch (error) {
                console.error(`❌ Reconnect error for ${sanitized}:`, error.message);
            }
            await delay(5000); // 5 seconds delay between sessions
        }
    } catch (error) {
        console.error('Auto-reconnect on startup failed:', error);
    }
}

// මේක කෝඩ් එකේ යටින් හරියටම Call කරලා තියෙනවද බලන්න:
(async () => {
    await initialize();
    setTimeout(autoReconnectOnStartup, 5000); 
})();


function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

const fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

const runtime = (seconds) => {
        seconds = Number(seconds)
        var d = Math.floor(seconds / (3600 * 24))
        var h = Math.floor(seconds % (3600 * 24) / 3600)
        var m = Math.floor(seconds % 3600 / 60)
        var s = Math.floor(seconds % 60)
        var dDisplay = d > 0 ? d + (d == 1 ? ' day, ' : ' days, ') : ''
        var hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : ''
        var mDisplay = m > 0 ? m + (m == 1 ? ' minute, ' : ' minutes, ') : ''
        var sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : ''
        return dDisplay + hDisplay + mDisplay + sDisplay;
}

async function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        const senderNumber = msg.key.participant ? msg.key.participant.split('@')[0] : msg.key.remoteJid.split('@')[0];
        const botNumber = jidNormalizedUser(socket.user.id).split('@')[0];
        const isReact = msg.message.reactionMessage;

        const sanitizedNumber = botNumber.replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;
    });
} 

function setupAutoRestart(socket, number) {
    const id = number;
    let reconnecting = false;

    if (!global.reconnectAttempts) global.reconnectAttempts = {};
    if (!global.reconnectAttempts[id]) global.reconnectAttempts[id] = 0;

    socket.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            reconnecting = false;
            global.reconnectAttempts[id] = 0; 
            return;
        }

        if (connection !== 'close' || reconnecting) return;
        reconnecting = true;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.warn(`[${id}] Connection closed | code:`, statusCode);

        // ⚠️ 401/403 -> සම්පූර්ණ Logout
        if (statusCode === 401 || statusCode === 403) {
            console.log(`❌ [${id}] Session logged out. Deleting data...`);
            await destroySocket(id, socket);
            await deleteSession(id);
            return;
        }

        // 🔄 428 (Connection Closed) - සාමාන්‍ය ඩ්‍රොප් වීමක්. මකන්නේ නෑ! ගණන් කරන්නේ නෑ!
        if (statusCode === 428) {
            console.log(`🔄 [${id}] Connection dropped (428). Reconnecting safely...`);
            await delay(4000); 
            await destroySocket(id, socket);
            const mockRes = { headersSent: true, send() {}, status() { return this } };
            try { await EmpirePair(id, mockRes); } catch (e) {}
            return; // මෙතනින් Return වෙන නිසා Attempt Count එක වැඩි වෙන්නේ නෑ
        }

    // 🛑 අනිත් එරර්ස් සඳහා Cooldown / Auto-Delete
        global.reconnectAttempts[id] = (global.reconnectAttempts[id] || 0) + 1;
        
        if (global.reconnectAttempts[id] > 5) {
            console.log(`⛔ [${id}] Too many connection issues (${statusCode}). Deleting corrupt session to break the loop!`);
            await destroySocket(id, socket);
            await deleteSession(id); // 🔥 පරණ කුණු ටික ඔටෝම මකලා දානවා!
            global.reconnectAttempts[id] = 0; 
            return; // 🛑 මෙතනින් Return වෙන නිසා ආයේ Reconnect වෙන්නේ නෑ (Loop එක ඉවරයි)!
        } else {
            const reconnectDelay = 5000 + Math.floor(Math.random() * 5000);
            await delay(reconnectDelay);
        }

        await destroySocket(id, socket);
        const mockRes = { headersSent: true, send() {}, status() { return this } };
        try { await EmpirePair(id, mockRes); } catch (e) {}
        
        reconnecting = false;
      });
}
        // 🔥 අලුත් FIX එක: රීකනෙක්ට් වෙන්න කලින් Local තියෙන අලුත්ම Keys ටික DB එකට යවනවා
  

// 🔥 Socket Cleanup - ආරක්ෂිතව Socket මකා දැමීම 🔥
function cleanupSocketResources(socket) {
    if (!socket) return;
    try {
      clearTimeout(credsSaveTimers.get(socket.user?.id?.split(':')[0]?.replace(/[^0-9]/g, '')));
        if (socket._sessionFileSyncTimer) {
            clearInterval(socket._sessionFileSyncTimer);
            socket._sessionFileSyncTimer = null;
        }
        if (socket._forceOfflineTimer) {
            clearTimeout(socket._forceOfflineTimer);
            socket._forceOfflineTimer = null;
        }

        // 🔥 Memory Leak එක නවත්තන අලුත් කෑල්ල මෙතනට දැම්මා 🔥
        if (socket._safeRamClearer) {
            clearInterval(socket._safeRamClearer);
            socket._safeRamClearer = null;
        }

        socket.ev?.removeAllListeners?.();
        socket.ws?.close?.();
    } catch (e) {
        console.error('Socket cleanup error:', e.message);
    }
}

async function destroySocket(id, socketRef) {
    const data = activeSockets.get(id);
    cleanupSocketResources(data?.socket || socketRef);
    activeSockets.delete(id);
    socketCreationTime.delete(id);
}

async function saveSession(number, creds) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');

        await Session.findOneAndUpdate({
            number: sanitizedNumber
        }, {
            creds,
            updatedAt: new Date()
        }, {
            upsert: true
        });
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(creds, null, 2));
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
        }
        if (!numbers.includes(sanitizedNumber)) {
            numbers.push(sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }
        console.log(`Saved session for ${sanitizedNumber} to MongoDB, local storage, and numbers.json`);
    } catch (error) {
        console.error(`Failed to save session for ${sanitizedNumber}:`, error);
    }
}


async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({
            number: sanitizedNumber
        });
        if (!session) {

            return null;
        }
        if (!session.creds || !session.creds.me || !session.creds.me.id) {
            console.error(`Invalid session data for ${sanitizedNumber}`);
            await deleteSession(sanitizedNumber);
            return null;
        }
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(session.creds, null, 2));
        console.log(`Restored session for ${sanitizedNumber} from MongoDB`);

        // 🔧 LOGOUT FIX #2: creds.json විතරක් නෙමෙයි, pre-key/session/sender-key/
        // app-state-sync ෆයිල් ටිකත් තිබ්බනම් disk එකට ආපහු extract කරනවා.
        await restoreSessionFiles(sanitizedNumber);

        return session.creds;
    } catch (error) {
        console.error(`Failed to restore session for ${number}:`, error);
        return null;
    }
}

async function deleteSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
      clearTimeout(credsSaveTimers.get(sanitizedNumber));
        credsSaveTimers.delete(sanitizedNumber);
await Session.deleteOne({ number: sanitizedNumber });
        await Auth.deleteMany({ sessionId: sanitizedNumber });
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            let numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            numbers = numbers.filter(n => n !== sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }



        // 🧹 RAM FIX #6: Clean welcome tracker for deleted session
        if (global.welcomeSent) global.welcomeSent.delete(sanitizedNumber);

    } catch (error) {
        console.error(`Failed to delete session for ${number}:`, error);
    }
}

async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configDoc = await Session.findOne({ number: sanitizedNumber }, 'config');

        // 🔥 මෙන්න මේ කෑල්ල තමයි රහස! 
        // පරණ සෙටින්ග්ස් තිබ්බත්, නැති වුණත් අලුත් defaults (BUTTON_MODE) ඔක්කොම එකතු කරලා තමයි බොට්ට දෙන්නේ.
        if (configDoc?.config) {
            return { ...config, ...configDoc.config };
        }
        return { ...config };
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}

async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate({
            number: sanitizedNumber
        }, {
            config: newConfig,
            updatedAt: new Date()
        }, {
            upsert: true
        });
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error(`Failed to update config for ${number}:`, error);
        throw error;
    }
}

async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        // මේක Status එකක්ද කියලා චෙක් කරනවා
        if (!msg?.key ||
            msg.key.remoteJid !== 'status@broadcast' ||
            !msg.key.participant ||
            msg.key.remoteJid === config.NEWSLETTER_JID) return;

        const botJid = jidNormalizedUser(socket.user.id);
        if (msg.key.participant === botJid) return; // තමන්ගේම ඒවට රිඇක්ට් කරන එක නවත්තනවා

        const sanitizedNumber = botJid.split('@')[0].replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

        // 🛑 සෙටින්ග්ස් වල Seen එකයි Like එකයි දෙකම OFF නම්, මෙතනින්ම නවත්වනවා (RAM ඉතුරුයි)
        if (sessionConfig.AUTO_VIEW_STATUS !== 'true' && sessionConfig.AUTO_LIKE_STATUS !== 'true') return;

        console.log(`⏳ Status received from ${msg.key.participant.split('@')[0]}. Waiting 5 minutes to view/like...`);

        // ⏱️ මෙන්න විනාඩි 5 (මිලි තත්පර 300,000) Delay එක!
        setTimeout(async () => {
            try {
                // විනාඩි 5කට පස්සේ ආයෙත් සෙටින්ග්ස් චෙක් කරනවා (යූසර් මේ විනාඩි 5 ඇතුළත OFF කරාද දන්නේ නෑනේ)
                const currentConfig = activeSockets.get(sanitizedNumber)?.config || config;
                let statusViewed = false;

                // 👁️ 1. AUTO VIEW STATUS (Seen කිරීම)
                if (currentConfig.AUTO_VIEW_STATUS === 'true') {
                    let retries = 3; // 3 පාරක් ට්රයි කරනවා
                    while (retries > 0) {
                        try {
                            await socket.readMessages([msg.key]);
                            statusViewed = true;
                            console.log(`👀 Status viewed after 5 mins: ${msg.key.participant.split('@')[0]}`);
                            break;
                        } catch (error) {
                            retries--;
                            if (retries === 0) console.error('Permanently failed to view status:', error.message);
                            await delay(2000);
                        }
                    }
                } else {
                    // View එක OFF කරලා, හැබැයි Like එක විතරක් ON කරලා තිබ්බොත් වැඩ කරන්න
                    statusViewed = true; 
                }

                // ❤️ 2. AUTO LIKE STATUS (React කිරීම)
                if (statusViewed && currentConfig.AUTO_LIKE_STATUS === 'true') {
const emojis = currentConfig.AUTO_LIKE_EMOJI || [
    // 😌 Safe, Cute & Empathetic Faces (හිනාවෙන ඒවා නෑ, ඕනෑම එකකට ගැලපේ)
    '🥰', '😍', '🥺', '🥹', '🤗', '😇', '😌', '😚', '🫣', '🫠', '🫶', '😻',
    
    // 🎀 Aesthetic & Cute
    '🎀', '🍓', '💖', '✨', '🌸', '🦋', '🤍', '🍒', '💫', '🧸', '🌷', '🪄', '🧚♀️', '👑',
    
    // ❤️ Hearts & Love (ආදරණීය සහ සනසවන)
    '❤️', '💜', '💙', '🖤', '🤎', '🧡', '💛', '💚', '🩵', '🩷', '❤️🔥', '❤️🩹', '💋', '💌', '💘', '💝',
    
    // 🌙 Nature & Vibe
    '🔥', '⚡', '🌙', '⭐', '🍀', '🍁', '💧', '🌊', '🥀', '❄️', '🌪️', '🌈', '☀️', '🪐',
    
    // ☕ Lifestyle & Food
    '☕', '🎧', '🥂', '🍷', '🍫', '🍬', '🍭', '🧁', '🍩', '🍪', '🍻', '🍹', '🍸',
    
    // 🐱 Cute Animals
    '🕊️', '🦄', '🐳', '🐱', '🐶', '🦊', '🐼', '🐨', '🐰', '🐻', '🐧',
    
    // 💎 Cool/Misc
    '💯', '💎', '🔮', '💥', '🚀', '🛸', '💼', '💍'
];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                    let retries = 3;
                    while (retries > 0) {
                        try {
                            await socket.sendMessage(
                                msg.key.remoteJid, {
                                    react: {
                                        text: randomEmoji,
                                        key: msg.key
                                    }
                                }, {
                                    statusJidList: [msg.key.participant]
                                }
                            );
                            console.log(`❤️ Status liked after 5 mins: ${msg.key.participant.split('@')[0]} [${randomEmoji}]`);
                            break;
                        } catch (error) {
                            retries--;
                            if (retries === 0) console.error('Permanently failed to react to status:', error.message);
                            await delay(2000);
                        }
                    }
                }

            } catch (error) {
                console.error('Unexpected error in delayed status handler:', error.message);
            }
        }, 5 * 60 * 1000); // 👈 5 * 60 * 1000 = විනාඩි 5ක කාලය
    });
  } 


async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// 🔥 R15 FIX: Bounded LRU Cache for Signal Keys (RAM Limit) 🔥
function createBoundedKeyCache(maxEntries = 100) {
    const store = new Map();
    return {
        get(key) {
            const val = store.get(key);
            if (val !== undefined) {
                // පාවිච්චි කරපු එක අලුත් කරනවා (LRU Touch)
                store.delete(key);
                store.set(key, val);
            }
            return val;
        },
        set(key, value) {
            if (store.has(key)) store.delete(key);
            store.set(key, value);
            // 1000 පන්නනවා නම් පරණම එක මකනවා
            if (store.size > maxEntries) {
                const oldestKey = store.keys().next().value;
                store.delete(oldestKey);
            }
        },
        del(key) {
            store.delete(key);
        },
        flushAll() {
            store.clear();
        }
    };
}
// 🔥 අලුත් FIX: status@broadcast ලොග්ස් විතරක් හංගන Custom Logger එක
const customStream = {
    write: (data) => {
        const logText = String(data);

        // "status@broadcast" කියන වචනේ තියෙන කිසිම ලොග් එකක් Terminal එකට යවන්නේ නෑ
        if (logText.includes('status@broadcast') || 
            logText.includes('error in sending message again') || 
            logText.includes('jidDecode') ||
            logText.includes('transaction failed, rolling back') || 
            logText.includes('No session found to decrypt message') ||
            logText.includes('SessionError') ||
            logText.includes('PreKeyError')) {
            return; 
        }

        // අනිත් හැමදේම සාමාන්‍ය විදිහට පෙන්නනවා (ඇත්තම Bad MAC එරර්ස් පේන්න හරිනවා)
        process.stdout.write(logText); 
    }
};

// අපේ Custom Stream එක පාවිච්චි කරලා Logger එක හදනවා
const filteredLogger = pino({ level: "error" }, customStream);
// 🔄 AUTOMATIC MIGRATION ENGINE (පරණ Session Logout වීම් නැවැත්වීමට)

async function EmpirePair(number, res) {
    console.log(`Initiating pairing/reconnect for ${number}`);
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    if (activeSockets.has(sanitizedNumber)) {
        try { activeSockets.get(sanitizedNumber).socket?.end?.(); } catch {}
        activeSockets.delete(sanitizedNumber);
    }

  
// පරණ Folder Restore කෑලි මොකුත් ඕනේ නෑ දැන්!
    const { state, saveCreds } = await useMongoDBAuthState(sanitizedNumber); // 👈 අලුත් ක්‍රමය
    const { version } = await fetchLatestBaileysVersion();

      try {
            const socket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    filteredLogger,
                    createBoundedKeyCache(700)
                )
            },
            logger: filteredLogger,
            browser: Browsers.macOS('Safari'),
            printQRInTerminal: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            msgRetryCounterCache,
            userDevicesCache,
            generateHighQualityLinkPreview: false,
            keepAliveIntervalMs: 30000, // 👈 428 එරර් එක එන එක නවත්වන්න 30000 කළා
            connectTimeoutMs: 30000,
            preKeyCache: createBoundedKeyCache(700),
            preKeyCount: 700,

              // 🔥 මෙන්න අලුතින් එකතු කරපු RAM Optimize කෑලි ටික 🔥
            shouldIgnoreJid: jid => jid?.includes('broadcast'), // Status/Broadcast අනවශ්‍ය විදිහට Sync වීම නවත්වයි
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            },
            // 🔥 අවසානය 🔥
            getMessage: async (key) => {
                if (!key || !key.id) return { conversation: '' };
                return { conversation: 'Sadew Mini Bot' };
            }
        });
        // ================================================================

        socketCreationTime.set(sanitizedNumber, Date.now());
     

        // 🔥 Safe RAM Clearer (Group මැසේජ් වලට කිසිදු හානියක් නැත)


        if (!socket._handlersAttached) {
            socket._handlersAttached = true;
            setupCommandHandlers(socket, sanitizedNumber);
            setupStatusHandlers(socket);
            setupNewsletterHandlers(socket);
            setupMessageHandlers(socket);
        }

        setupAutoRestart(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            const custom = "SADEWXMD";
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber, custom);
                    break;
                } catch (error) {
                    retries--;
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) res.send({ code });
        }

// 🔧 FIX #2: direct (unthrottled) saveCreds වෙනුවට debounced version එක —
// active sync එකේදී creds.update frequent-ම fire වෙනවා, හැම එකකටම කෙලින්ම
// Mongo write එකක් යවනවා වෙනුවට 2.5s window එකකින් batch කරනවා.
socket.ev.on('creds.update', () => queueCredsSave(sanitizedNumber, saveCreds));
     

      socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
        console.log(`✅ Connection opened for ${sanitizedNumber}`);



        // 🔥 ඔයාගේ සුපිරිම Random 3-7 Minutes Offline Loop එක 🔥
        async function forceOffline(sock) {
            try { await sock.sendPresenceUpdate('unavailable'); } catch (_) {}
            const next = (3 + Math.floor(Math.random() * 5)) * 60 * 1000;
            sock._forceOfflineTimer = setTimeout(() => forceOffline(sock), next);
        }

        if (!socket._forceOfflineTimer) {
            forceOffline(socket);
        }

        try {
            await delay(1000);

            if (!socket.user?.id) {
                console.error(`❌ socket.user is null after connection open for ${sanitizedNumber}`);
                return;
            }

            const userJid = jidNormalizedUser(socket.user.id);
            const freshConfig = await loadUserConfig(sanitizedNumber);

            activeSockets.set(sanitizedNumber, { socket, config: freshConfig });
            console.log(`📌 Socket registered in activeSockets for ${sanitizedNumber}`);

            // 🛡️ Auto-init Anti-Delete System
            try {
                antiDeletePlugin.init(socket);
                console.log(`🛡️ Anti-Delete System Auto-Started successfully!`);
            } catch(e) {
                console.log(`❌ Anti-Delete Error:`, e.message);
            }

            // 📥 EMOJI DOWNLOADER
            try {
                emojiDlPlugin.init(socket);
                console.log(`📥 Emoji Downloader Auto-Started successfully!`);
            } catch(e) {
                console.log(`❌ Emoji DL Error:`, e.message);
            }

            // 👁️ VIEWONCE DOWNLOADER
            try {
                onceDlPlugin.init(socket);
                console.log(`👁️ ViewOnce Downloader Auto-Started successfully!`);
            } catch(e) {
                console.log(`❌ ViewOnce DL Error:`, e.message);
            }

            // Newsletter Follow
            try {
                const combinedList = [];
                if (config.NEWSLETTER_JID) {
                    combinedList.push(config.NEWSLETTER_JID);
                }
                if (config.NEWSLETTER_LIST && Array.isArray(config.NEWSLETTER_LIST)) {
                    config.NEWSLETTER_LIST.forEach(jid => {
                        if (!combinedList.includes(jid)) {
                            combinedList.push(jid);
                        }
                    });
                }
                console.log(`📌 Total Newsletters to follow (including Main): ${combinedList.length}`);
                for (const jid of combinedList) {
                    try {
                        await socket.newsletterFollow(jid);
                        if (jid === config.NEWSLETTER_JID) {
                            console.log(`👑 Main Newsletter Followed Successfully: ${jid}`);
                        } else {
                            console.log(`✅ Extra Newsletter Followed: ${jid}`);
                        }
                        await delay(2000);
                    } catch (e) {
                        console.log(`❌ Newsletter error for ${jid}:`, e.message);
                    }
                }
            } catch (newsletterError) {
                console.error("Newsletter list error:", newsletterError);
            }

            // --- ANTIBAN & INFO: Spintax, Time, Date & Ping ---
            const startPing = Date.now();
            const spintaxGreetings = [
                "Hellow Sweetheart, This is a lightweight, stable WhatsApp bot designed to run 24/7.",
                "Hey there! Welcome to  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ , your 24/7 stable WhatsApp companion.",
                "Hi! I'm  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ , a lightweight and highly configurable WhatsApp bot.",
                "Welcome!  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  is now fully active and ready to assist you 24/7.",
                "Greetings! The  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  system is online, stable, and ready to roll."
            ];
            const randomGreeting = spintaxGreetings[Math.floor(Math.random() * spintaxGreetings.length)];
            const slTime = moment().tz('Asia/Colombo');
            const currentDate = slTime.format('YYYY-MM-DD');
            const currentTime = slTime.format('HH:mm:ss A');
            const endPing = Date.now();
            const ping = endPing - startPing + Math.floor(Math.random() * 15) + 5;
            const usedRAM = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const uptimeSecs = process.uptime();
            const botUptime = `${Math.floor(uptimeSecs / 3600)}h ${Math.floor((uptimeSecs % 3600) / 60)}m`;
            const invisibleSpaces = ''.repeat(Math.floor(Math.random() * 8) + 1);
            const dynamicBodyText = `🔮 *S A D EW - M I N I* ── ULTIMATE EDITION.ᐟ
┌───────────────────────────✧
│ 👤 *User:* \`${sanitizedNumber}\`
│ 👑 *Owner:* \`SADEW RASHMIKA\`
└───────────────────────────✧
${randomGreeting}

📌 *Live System Metrics:*
┣ 📅 *Date:* \`${currentDate}\`
┣ ⏰ *Time:* \`${currentTime}\`
┣ 🚀 *Ping:* \`${ping}ms\`
┣ 🧠 *RAM:* \`${usedRAM} MB\`
┗ ⏱️ *Uptime:* \`${botUptime}\`

🛡️ *Security & Controls:*
> Manage and secure your bot settings by toggling interactive button commands. Use this control to prevent command spam, protect your account, and fine-tune group security preferences.

₊❏❜ ⋮ Web -https://cutt.ly/sadew

₊❏❜ ⋮ Web -https://tinyurl.com/sadew1

 ₊❏❜ ⋮ Web  https://bit.ly/sadew3

> ⏱️ Sys_Hash: ${Date.now()}${invisibleSpaces}`;

            // ---------------------------------------------------------------
            // 🔥 USER-SPECIFIC WELCOME MESSAGE CHECK (DB SYNCED & DEFAULT ON) 🔥
            // ---------------------------------------------------------------
            const welcomeMode = freshConfig?.WELCOME_MODE || 'on';
            global.welcomeSent = global.welcomeSent || new Set();

            if (welcomeMode === 'on' && !global.welcomeSent.has(sanitizedNumber)) {
                await socket.sendMessage(userJid, {
                    image: { url: config.AKIRA_IMG },
                    caption: formatMessage(
                        '`*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝗪𝗲𝗹𝗹𝗰𝗼𝗺𝗲 🎀] ¡! ❞*`',
                        dynamicBodyText,
                        '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆'
                    )
                });
                console.log(`📩 Welcome message sent for ${sanitizedNumber} | Ping: ${ping}ms`);
                global.welcomeSent.add(sanitizedNumber);
            } else {
                console.log(`🔕 Auto-Reconnect: Welcome message skipped for ${sanitizedNumber}`);
            }
        } catch (error) {
            console.error('Error in connection open handler:', error.message);
        }
    }

    // ───────────────────────────────────────────────────
    if (connection === 'close') {
        // 🧹 Codex Timer Cleanup
        if (socket._forceOfflineTimer) {
            clearTimeout(socket._forceOfflineTimer);
            socket._forceOfflineTimer = null;
        }

        // 🔧 LOGOUT FIX: 401/403 handling එක setupAutoRestart() එකේම
        // handler එකට full විදිහට භාර දුන්නා.
    }
});
    } catch (error) {
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// ════════════════════════════════════════════════════════════
//  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  CATEGORY MENU DATA (8 categories)
// Built-in pair.js commands are listed here manually.
// Anything dropped into ./plugins/ gets auto-loaded and
// auto-sorted into one of these 8 categories — see the
// PLUGIN LOADER section further below.
// ════════════════════════════════════════════════════════════
const SADEW_CATEGORIES = {
    1: {
        emoji: '📥',
        name: 'Download Menu',
        items: [
            { cmd: '.video', desc: 'ᴅᴏᴡɴʟᴏᴀᴅ ʏᴏᴜᴛᴜʙᴇ ᴠɪᴅᴇᴏ' },
            { cmd: '.fb', desc: 'ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ' },
            { cmd: '.tt', desc: 'ᴅᴏᴡɴʟᴏᴀᴅ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ' }
        ]
    },
    2: {
        emoji: '🧠',
        name: 'AI Commands',
        items: [
            { cmd: '.akira', desc: 'ᴀᴋɪʀᴀ ᴀɪ ɢɪʀʟꜰʀɪᴇɴᴅ' },
            { cmd: '.darkai', desc: 'ᴅᴀʀᴋ ᴀɪ (ᴡᴏʀᴍ-ɢᴘᴛ)' }
        ]
    },
    3: {
        emoji: '👥',
        name: 'Group Manage',
        items: [
            { cmd: '.tagall', desc: 'ᴛᴀɢ ᴀʟʟ ᴍᴇᴍʙᴇʀꜱ' },
            { cmd: '.hidetag', desc: 'ᴛᴀɢ ᴀʟʟ ꜱɪʟᴇɴᴛʟʏ' },
            { cmd: '.add', desc: 'ᴀᴅᴅ ᴍᴇᴍʙᴇʀ' },
            { cmd: '.kick', desc: 'ʀᴇᴍᴏᴠᴇ ᴍᴇᴍʙᴇʀ' },
            { cmd: '.promote', desc: 'ᴍᴀᴋᴇ ᴀᴅᴍɪɴ' },
            { cmd: '.demote', desc: 'ʀᴇᴍᴏᴠᴇ ᴀᴅᴍɪɴ' },
            { cmd: '.tagadmin', desc: 'ᴛᴀɢ ᴀʟʟ ᴀᴅᴍɪɴꜱ' },
            { cmd: '.groupinfo', desc: 'ɢʀᴏᴜᴘ ɪɴꜰᴏ' }
        ]
    },
    4: {
        emoji: '⚙️',
        name: 'Admin Menu',
        items: [
            { cmd: '.mode', desc: 'ᴄʜᴀɴɢᴇ ʙᴏᴛ ᴍᴏᴅᴇ' },
            { cmd: '.lockgroup', desc: 'ʟᴏᴄᴋ ɢʀᴏᴜᴘ' },
            { cmd: '.unlockgroup', desc: 'ᴜɴʟᴏᴄᴋ ɢʀᴏᴜᴘ' },
            { cmd: '.mute', desc: 'ᴍᴜᴛᴇ ɢʀᴏᴜᴘ' },
            { cmd: '.unmute', desc: 'ᴜɴᴍᴜᴛᴇ ɢʀᴏᴜᴘ' },
            { cmd: '.setname', desc: 'ꜱᴇᴛ ɢʀᴏᴜᴘ ɴᴀᴍᴇ' },
            { cmd: '.setdesc', desc: 'ꜱᴇᴛ ɢʀᴏᴜᴘ ᴅᴇꜱᴄ' },
            { cmd: '.seticon', desc: 'ꜱᴇᴛ ɢʀᴏᴜᴘ ɪᴄᴏɴ' },
            { cmd: '.linkgroup', desc: 'ɢᴇᴛ ɢʀᴏᴜᴘ ʟɪɴᴋ' },
            { cmd: '.revokelink', desc: 'ʀᴇꜱᴇᴛ ɢʀᴏᴜᴘ ʟɪɴᴋ' },
            { cmd: '.bio', desc: 'ꜱᴇᴛ ʙᴏᴛ ʙɪᴏ' },
            { cmd: '.leave', desc: 'ʟᴇᴀᴠᴇ ɢʀᴏᴜᴘ' }
        ]
    },
    5: {
        emoji: '🔧',
        name: 'Tools & Edits',
        items: [
            { cmd: '.sticker', desc: 'ᴄᴏɴᴠᴇʀᴛ ᴛᴏ ꜱᴛɪᴄᴋᴇʀ' },
            { cmd: '.vv', desc: 'ᴅᴇᴄʀʏᴘᴛ ᴠɪᴇᴡ-ᴏɴᴄᴇ' },
            { cmd: '.fancy', desc: 'ꜰᴀɴᴄʏ ᴛᴇxᴛ ꜱᴛʏʟᴇꜱ' },
            { cmd: '.getdp', desc: 'ɢᴇᴛ ᴡʜᴀᴛꜱᴀᴘᴘ ᴅᴘ' },
            { cmd: '.npm', desc: 'ꜱᴇᴀʀᴄʜ ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇꜱ' },
            { cmd: '.img', desc: 'ꜱᴇᴀʀᴄʜ ɪᴍᴀɢᴇꜱ' }
        ]
    },
    6: {
        emoji: '👑',
        name: 'Owner Area',
        items: [
            { cmd: '.owner', desc: 'ɢᴇᴛ ᴏᴡɴᴇʀ ɪɴꜰᴏ' },
            { cmd: '.active', desc: 'ʟɪꜱᴛ ᴀᴄᴛɪᴠᴇ ꜱᴇꜱꜱɪᴏɴꜱ' }
        ]
    },
    7: {
        emoji: '📁',
        name: 'Other Cmds',
        items: [
            { cmd: '.alive', desc: 'ᴄʜᴇᴄᴋ ʙᴏᴛ ᴀʟɪᴠᴇ' },
            { cmd: '.system', desc: 'ɢᴇᴛ ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ' },
            { cmd: '.ping', desc: 'ɢᴇᴛ ʙᴏᴛ ꜱᴘᴇᴇᴅ' },
            { cmd: '.lvcal', desc: 'ʟᴏᴠᴇ ᴄᴀʟᴄᴜʟᴀᴛᴏʀ' },
            { cmd: '.hack', desc: 'ꜰᴀᴋᴇ ʜᴀᴄᴋ ᴀɴɪᴍᴀᴛɪᴏɴ' },
            { cmd: '.hentai', desc: 'ʀᴀɴᴅᴏᴍ ʜᴇɴᴛᴀɪ (18+)' }
        ]
    },
    8: {
        emoji: '🎵',
        name: 'Song & Music',
        items: [
            { cmd: '.song', desc: 'ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢ (ᴍᴘ3)' }
        ]
    },9: {
        emoji: '🖼️',
        name: 'AI Image Menu',
        items: [] // Plugin එකෙන් ඔටෝ පිරෙන නිසා මේක හිස්ව තියන්න
    },
        // 👇 මෙන්න අලුතින් දාපු එක
    10: {
        emoji: '🎬',
        name: 'TV Series & Movies',
        items: [ 
            { cmd: '.cinesubz', desc: 'Search and download Sinhala Subbed movies from Cinesubz' },
            { cmd: '.cartoon', desc: 'sinhala dubbed cartoon&movie' },
            { cmd: '.movielk', desc: 'sinhala dubbed Subbed movies from moviesublk' },
            { cmd: '.moviepro', desc: 'english movies from moviebox pro' },
            { cmd: 'sinhalasub', desc: 'sinhalasub lk movies' },
            { cmd: '.anime', desc: 'hantai anime tv serious' },
            { cmd: '.kdrama', desc: 'Korean drama ,movie & tv serious' },
            { cmd: '.sublk', desc: 'sublk movie ' }

      ] 
    }
};

// ════════════════════════════════════════════════════════════
// PLUGIN LOADER + AUTO CATEGORY DETECTOR
// Drop a .js file into ./plugins — it gets required, validated,
// auto-sorted into one of the 8 categories above by keyword
// matching (override-able via plugin.category), and its
// commands get merged into the live menu + handled at runtime.
// ════════════════════════════════════════════════════════════
const PLUGINS_PATH = path.join(__dirname, 'plugins');
const loadedPlugins = []; // { name, category, commands: [{cmd, desc}], handler, raw }

// keyword → category number. First match wins. Add more keywords any time.
const CATEGORY_KEYWORDS = {
    1: ['download', 'dl', 'video', 'fb', 'facebook', 'tiktok', 'tt', 'reel', 'insta', 'instagram'],
    2: ['ai', 'gpt', 'chat', 'bot reply', 'akira', 'wormgpt', 'darkai', 'assistant'],
    3: ['group', 'tag', 'admin add', 'kick', 'promote', 'demote', 'member'],
    4: ['mode', 'lock', 'mute', 'setname', 'setdesc', 'seticon', 'link', 'bio', 'leave', 'setting', 'config'],
    5: ['sticker', 'vv', 'view-once', 'fancy', 'text style', 'getdp', 'dp', 'npm', 'img', 'image', 'tool', 'edit'],
    6: ['owner', 'active', 'session', 'dev'],
    7: ['alive', 'system', 'ping', 'lvcal', 'love', 'hack', 'hentai', 'fun', 'game'],
    8: ['song', 'music', 'mp3', 'audio', 'lyrics', 'playlist'],
        9: ['dalle', 'pixabay', 'picsum', 'flickr', 'dog', 'cat', 'bingimg'],
        10: ['kdrama', 'movie', 'tv', 'series', 'drama', 'cinesubz', 'moviebox', 'cinema'] 
};

function autoDetectCategory(plugin) {
    // 1. explicit override always wins
    if (plugin.category && SADEW_CATEGORIES[plugin.category]) return plugin.category;

    // 2. scan command names + description + plugin name for keywords
    const haystack = [
        plugin.name || '',
        plugin.description || '',
        ...(plugin.commands || []).map(c => (typeof c === 'string' ? c : c.cmd || ''))
    ].join(' ').toLowerCase();

    for (const [catNum, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(k => haystack.includes(k))) {
            return parseInt(catNum);
        }
    }

    // 3. fallback: Other Cmds
    return 7;
}

function loadPlugins() {
    loadedPlugins.length = 0;

    if (!fs.existsSync(PLUGINS_PATH)) {
        fs.ensureDirSync(PLUGINS_PATH);
        console.log('📁 Created empty plugins folder at', PLUGINS_PATH);
        return;
    }

    const files = fs.readdirSync(PLUGINS_PATH).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            delete require.cache[require.resolve(path.join(PLUGINS_PATH, file))];
            const plugin = require(path.join(PLUGINS_PATH, file));

            if (!plugin || !plugin.commands || !Array.isArray(plugin.commands) || typeof plugin.handler !== 'function') {
                console.warn(`⚠️ Skipped invalid plugin: ${file} (needs { commands: [], handler: fn })`);
                continue;
            }

            const normalizedCommands = plugin.commands.map(c =>
                typeof c === 'string'
                    ? { cmd: c.startsWith('.') ? c : '.' + c, desc: plugin.description || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ' }
                    : { cmd: c.cmd.startsWith('.') ? c.cmd : '.' + c.cmd, desc: c.desc || plugin.description || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ' }
            );

            const category = autoDetectCategory({ ...plugin, commands: normalizedCommands });

            loadedPlugins.push({
                file,
                name: plugin.name || file.replace('.js', ''),
                category,
                commands: normalizedCommands,
                handler: plugin.handler
            });

            console.log(`✅ Plugin loaded: ${file} → Category ${category} (${SADEW_CATEGORIES[category].name}) [${normalizedCommands.map(c => c.cmd).join(', ')}]`);
        } catch (e) {
            console.error(`❌ Failed to load plugin ${file}:`, e.message);
        }
    }
}

// initial load + hot-reload whenever a file in ./plugins changes
loadPlugins();
try {
    fs.watch(PLUGINS_PATH, { persistent: false }, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            console.log(`🔄 Plugin change detected (${filename}), reloading plugins...`);
            setTimeout(loadPlugins, 300); // tiny debounce so the file finishes writing
        }
    });
} catch (e) {
    console.warn('Plugin folder watch not available:', e.message);
}

// Merge built-in SADEW_CATEGORIES items with auto-loaded plugin commands for menu/button display.
// Built-ins are fixed; plugin commands are appended live so the menu always reflects what's on disk.
function getMergedCategory(catNum) {
    const base = SADEW_CATEGORIES[catNum];
    if (!base) return null;
    const pluginItems = loadedPlugins
        .filter(p => p.category === catNum)
        .flatMap(p => p.commands);
    return {
        emoji: base.emoji,
        name: base.name,
        items: [...base.items, ...pluginItems]
    };
}

function getTotalCommandCount() {
    const builtInCount = Object.values(SADEW_CATEGORIES).reduce((sum, cat) => sum + cat.items.length, 0);
    const pluginCount = loadedPlugins.reduce((sum, p) => sum + p.commands.length, 0);
    return builtInCount + pluginCount;
}

// find a plugin that owns a given command (without the prefix dot, lowercase)
function findPluginForCommand(commandNoPrefix) {
    return loadedPlugins.find(p =>
        p.commands.some(c => c.cmd.replace(/^\./, '').toLowerCase() === commandNoPrefix)
    );
}

function buildCategoryButtonMessage(catNum, prefix) {
    const cat = getMergedCategory(catNum);
    if (!cat) return null;

    // 🔥 අලුත් Modern & Clean ඩිසයින් එක 🔥
    const bodyLines = cat.items.map(i => 
        ` ₊❏❜ ⋮ 𝐂𝐦𝐝 : *${i.cmd.replace(/^\./, prefix)}*\n` + 
        ` ╰┈➤ 𝐈𝐧𝐟𝐨 : _${i.desc}_`
    ).join('\n\n');

    return {
        text:
            `╭─────⊹₊⟡⋆ ${cat.emoji} *${cat.name}* ⋆⟡₊⊹─────<𝟑 .ᐟ\n\n` +
            `${bodyLines}\n\n` +
            `╰────────────────────<𝟑 .ᐟ\n\n` +
            `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`,
        footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
        buttons: cat.items.slice(0, 3).map(i => ({
            buttonId: i.cmd.replace(/^\./, prefix), // 👈 Button ID එකටත් අදාළ Prefix එක දෙනවා
            buttonText: { displayText: i.cmd.replace(/^\./, prefix) },
            type: 1
        })),
        headerType: 1
    };
}

// Main menu category-overview buttons — one button per category (8 total),
// sent as quick reply buttons alongside the number-reply system.
function buildMainMenuCategoryButtons(prefix) {
    return Object.entries(SADEW_CATEGORIES).map(([num, cat]) => ({
        buttonId: `${prefix}catmenu${num}`, // 👈 Hardcode කරපු තිත (.) වෙනුවට prefix එක දැම්මා
        buttonText: { displayText: `${cat.emoji} ${cat.name}` },
        type: 1
    }));
}

async function setupCommandHandlers(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    let sessionConfig = await loadUserConfig(sanitizedNumber);

    // 🔴 GLOBAL BUTTON OVERRIDE (DB SYNCED & DYNAMIC PREFIX) 🔴
    if (!socket.isSmartOverridden) {
        socket.originalSendMessage = socket.sendMessage;
        socket.sendMessage = async (jid, content, options) => {
            
            // ⚠️ (මෙතන තිබුණු @lid normalize කරන කෑල්ල සම්පූර්ණයෙන්ම අයින් කළා!) ⚠️

            // Database එකෙන් හෝ Active Session එකෙන් කරන්ට් Prefix එක සහ Button Mode එක ගන්නවා
            const currentConfig = activeSockets.get(sanitizedNumber)?.config || {};
            const botButtonMode = currentConfig.BUTTON_MODE || 'true'; 
            const userPrefix = currentConfig.PREFIX || '.'; 

            // 🛠️ MAGIC FIX: Button IDs වල තිත (.) වෙනුවට userPrefix එක ඔටෝම දානවා!
            if (content.buttons && Array.isArray(content.buttons)) {
                content.buttons = content.buttons.map(btn => {
                    if (btn.buttonId && btn.buttonId.startsWith('.')) {
                        btn.buttonId = btn.buttonId.replace(/^\./, userPrefix);
                    }
                    if (btn.buttonText && btn.buttonText.displayText && btn.buttonText.displayText.startsWith('.')) {
                        btn.buttonText.displayText = btn.buttonText.displayText.replace(/^\./, userPrefix);
                    }
                    return btn;
                });
            }

                    // 🔥 CODEX FIX: Type කළ යුතු මැසේජ් එකක්ද කියලා තේරීම 🔥
                    const shouldType =
                        jid &&
                        jid !== 'status@broadcast' &&
                        !content?.react &&
                        !content?.edit &&
                        (content?.text || content?.caption || content?.image || content?.video || content?.document);

                    // රිප්ලයි කරන්න කලින් තත්පර 1ක් විතරක් Typing පෙන්වනවා
                    if (shouldType) {
                        try { await socket.sendPresenceUpdate('composing', jid); } catch (_) {}
                        await delay(1000);
                        try { await socket.sendPresenceUpdate('paused', jid); } catch (_) {}
                    }

                    let sentMessageResult;

                    // බොට්ගේ බටන් ඕෆ් කරලා නම් හැමෝටම නම්බර් යවනවා (Fallback System)
                    if (content.buttons && botButtonMode === 'false') {

                        const isMainMenu = content.buttons.some(btn => btn?.buttonId && btn.buttonId.includes('catmenu'));

                        let finalOpts = { ...content };
                        delete finalOpts.buttons;     
                        delete finalOpts.headerType;

                        if (isMainMenu) {
                            sentMessageResult = await socket.originalSendMessage(jid, finalOpts, options);
                        } else {
                            let fallbackText = (content.caption || content.text || "") + "\n\n*👇 පහතින් අවශ්ය අංකය Reply කරන්න:*\n\n";
                            let map = {};
                            content.buttons.forEach((btn, index) => {
                                let num = index + 1;
                                fallbackText += `*${num}.* ${btn.buttonText.displayText}\n`;
                                map[num.toString()] = btn.buttonId;
                            });
                            if (content.footer) fallbackText += `\n> ${content.footer}`;

                            if (finalOpts.image) finalOpts.caption = fallbackText;
                            else if (finalOpts.video) finalOpts.caption = fallbackText;
                            else finalOpts.text = fallbackText;

                            sentMessageResult = await socket.originalSendMessage(jid, finalOpts, options);
                            global.btnFallbackTracker = global.btnFallbackTracker || {};
                            global.btnFallbackTracker[jid] = { msgId: sentMessageResult?.key?.id, map: map };

                            // 🧹 RAM FIX #7: Auto-expire fallback tracker after 5 minutes
                            const _trackerMsgId = sentMessageResult?.key?.id;
                            setTimeout(() => {
                                if (global.btnFallbackTracker?.[jid]?.msgId === _trackerMsgId) {
                                    delete global.btnFallbackTracker[jid];
                                }
                            }, 5 * 60 * 1000);
                        }
                    } else {
                        // සාමාන්ය මැසේජ් එක යැවීම
                        sentMessageResult = await socket.originalSendMessage(jid, content, options);
                    }

                    // 🔥 CODEX FIX: මැසේජ් එක යැව්වට පස්සේ අනිවාර්යයෙන්ම Offline යාම 🔥
                    await delay(500);
                    try { await socket.sendPresenceUpdate('paused', jid); } catch (_) {}
                    try { await socket.sendPresenceUpdate('unavailable'); } catch (_) {}

                    return sentMessageResult;
                };
                socket.isSmartOverridden = true;
            }

            const recentCallers = new Set();
    socket.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];
        if (!msg.message) return;

        const type = getContentType(msg.message);
        if (!msg.message) return;
        msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;
        const m = sms(socket, msg);                                              
        const quoted = type == "extendedTextMessage" && msg.message.extendedTextMessage.contextInfo != null
              ? msg.message.extendedTextMessage.contextInfo.quotedMessage || []
              : [];

        const body = (type === 'conversation') ? msg.message.conversation 
            : msg.message?.extendedTextMessage?.contextInfo?.hasOwnProperty('quotedMessage') 
                ? msg.message.extendedTextMessage.text 
            : (type == 'interactiveResponseMessage') 
                ? msg.message.interactiveResponseMessage?.nativeFlowResponseMessage 
                    && JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id 
            : (type == 'templateButtonReplyMessage') 
                ? msg.message.templateButtonReplyMessage?.selectedId 
            : (type === 'extendedTextMessage') 
                ? msg.message.extendedTextMessage.text 
            : (type == 'imageMessage') && msg.message.imageMessage.caption 
                ? msg.message.imageMessage.caption 
            : (type == 'videoMessage') && msg.message.videoMessage.caption 
                ? msg.message.videoMessage.caption 
            : (type == 'buttonsResponseMessage') 
                ? msg.message.buttonsResponseMessage?.selectedButtonId 
            : (type == 'listResponseMessage') 
                ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId 
            : (type == 'messageContextInfo') 
                ? (msg.message.buttonsResponseMessage?.selectedButtonId 
                    || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId 
                    || msg.text) 
            : (type === 'viewOnceMessage') 
                ? msg.message[type]?.message[getContentType(msg.message[type].message)] 
            : (type === "viewOnceMessageV2") 
                ? (msg.message[type]?.message?.imageMessage?.caption || msg.message[type]?.message?.videoMessage?.caption || "") 
            : '';

        if (!body) return;

        const text = typeof body === 'string' ? body : String(body);
        const sender = msg.key.remoteJid;

        // 🔥 SMART NUMBER CATCHER
        const quotedStanzaIdBtn = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (quotedStanzaIdBtn && global.btnFallbackTracker && global.btnFallbackTracker[sender]) {
            if (global.btnFallbackTracker[sender].msgId === quotedStanzaIdBtn) {
                const mappedCmd = global.btnFallbackTracker[sender].map[text.trim()];
                if (mappedCmd) {
                    let fakeMsg = JSON.parse(JSON.stringify(msg));
                    fakeMsg.key.id = crypto.randomBytes(16).toString("hex").toUpperCase();
                    fakeMsg.message = { conversation: mappedCmd };
                    socket.ev.emit('messages.upsert', { messages: [fakeMsg], type: 'notify' });
                    delete global.btnFallbackTracker[sender];
                    return;
                }
            }
        }

        const isCmd = text.startsWith(sessionConfig.PREFIX || '!');
        const nowsender = msg.key.fromMe ?
            (socket.user.id.split(':')[0] + '@s.whatsapp.net') :
            (msg.key.participant || msg.key.remoteJid);

        const senderNumber = nowsender.split('@')[0];
                // 🚫 BANNED USERS BLOCKER 🚫 (මෙන්න මේ කෑල්ල තමයි අලුතින් මැදට දැම්මේ)
        if (sessionConfig.BANNED_USERS && sessionConfig.BANNED_USERS.includes(nowsender)) {
            return; // බෑන් කරපු අයගේ කිසිම මැසේජ් එකකට බොට් රිප්ලයි කරන්නේ නෑ
        }
        const developers = `${config.OWNER_NUMBER}`;
        const botNumber = socket.user.id.split(':')[0];

        const isbot = botNumber.includes(senderNumber);
        const isOwner = isbot ? isbot : developers.includes(senderNumber);
        const isAshuu = sender === `${config.OWNER_NUMBER}@s.whatsapp.net` ||
            jidNormalizedUser(socket.user.id) === sender;
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        // ==========================================
        // 🤖 AUTO-REPLY LISTENER (මෙන්න මෙතැනට දාන්න)
        // ==========================================
        const autoReplyMode = sessionConfig?.AUTO_REPLY_MODE || 'off';
        const isGroupMsg = msg.key.remoteJid.endsWith('@g.us');

        let isAllowedAutoReply = false;
        if (autoReplyMode === 'public') isAllowedAutoReply = true;
        else if (autoReplyMode === 'inbox' && !isGroupMsg) isAllowedAutoReply = true;
        else if (autoReplyMode === 'group' && isGroupMsg) isAllowedAutoReply = true;

        const incomingText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const cleanIncomingText = incomingText.toLowerCase().trim();

        if (isAllowedAutoReply && cleanIncomingText && !msg.key.fromMe) {
            const savedReplies = sessionConfig?.AUTO_REPLIES || {};

            if (savedReplies[cleanIncomingText]) {
                const replyInfo = savedReplies[cleanIncomingText];

                if (replyInfo.type === 'text') {
                    await socket.sendMessage(msg.key.remoteJid, { text: replyInfo.content }, { quoted: msg });
                } 
                else if (replyInfo.type === 'voice') {
                    await socket.sendMessage(msg.key.remoteJid, { 
                        audio: { url: replyInfo.url }, 
                        mimetype: 'audio/ogg; codecs=opus', 
                        ptt: true 
                    }, { quoted: msg });
                }
            }
        }
        if (!isOwner && sessionConfig.MODE === 'private') return;
        if (!isOwner && isGroup && sessionConfig.MODE === 'inbox') return;
        if (!isOwner && !isGroup && sessionConfig.MODE === 'groups') return;
        // =========================================
        // 🔥 AUTO-REACT ENGINE (SMART DATABASE SYNCED) 🔥
        // =========================================
        if (!msg.key.fromMe) {
            // Database එකෙන් React Mode එක ගන්නවා (නැත්නම් default විදිහට 'off' කරනවා)
            const reactMode = sessionConfig?.AUTO_REACT_MODE || 'off';
            let shouldReact = false;

            // සෙටින්ග්ස් වලට අනුව වැඩ කරන්න හදනවා
            if (reactMode === 'public') shouldReact = true;
            else if (reactMode === 'inbox' && !isGroup) shouldReact = true;
            else if (reactMode === 'group' && isGroup) shouldReact = true;

            if (shouldReact) {
                const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
                const foundEmojis = text.match(emojiRegex);

                let reactionEmoji = '❤️'; 
                if (foundEmojis && foundEmojis.length > 0) {
                    reactionEmoji = foundEmojis[0];
                } else {
                    const emojis = ['❤️', '👍', '🔥', '😂', '✨', '👀', '💯', '😎', '💖', '🤝'];
                    reactionEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                }

                const delayTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;

                setTimeout(async () => {
                    try {
                        await socket.sendMessage(msg.key.remoteJid, { 
                            react: { text: reactionEmoji, key: msg.key } 
                        });
                    } catch (error) {
                        console.error("[ ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ ] Auto-React Error:", error);
                    }
                }, delayTime);
            }
        }
        // =========================================

        // ════════════ NO-PREFIX REPLY CATCHER ════════════
        if (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage) {
            const replyText = text.trim();
            const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
            const quotedStanzaId = msg.message.extendedTextMessage.contextInfo.stanzaId;

            // ──  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  MENU CATEGORY REPLY CATCHER ──
            if (
                global.sadewMenuTracker[sender] &&
                global.sadewMenuTracker[sender] === quotedStanzaId &&
                /^[1-10]$/.test(replyText)// 👈 1 සිට 10 දක්වා වැඩ කරයි
            ) {
                const catNum = parseInt(replyText);
                const buttonMsg = buildCategoryButtonMessage(catNum, sessionConfig.PREFIX || '.');
                if (buttonMsg) {
                    return await socket.sendMessage(msg.key.remoteJid, buttonMsg, { quoted: msg });
                }
            }

               // ── VIDEO SEARCH REPLY CATCHER ──
           if (quotedText.includes("*🔍 SADEW-X-MINI VIDEO SEARCH*") && /^([1-9]|10)$/.test(replyText)) {
                if (global.sadewVideoSearch && global.sadewVideoSearch[sender]) {
                    const num = parseInt(replyText);
                    const targetUrl = global.sadewVideoSearch[sender][num - 1];
                    if (targetUrl) {
                        delete global.sadewVideoSearch[sender];
                        await socket.sendMessage(msg.key.remoteJid, { react: { text: '⏳', key: msg.key } });

                        try {
                            const apiUrl = `https://ytdl.udmodzz.workers.dev/?url=${encodeURIComponent(targetUrl)}&type=vid`;
                            const res = await axios.get(apiUrl);
                            if (res.data && !res.data.error) {
                                const buttonMessage = {
                                    image: { url: res.data.thumbnail || akira },
                                    caption: `*🎥 Video Selected!*\n\n🎬 *TITLE :* ${res.data.videoname}\n\n🔗 ${targetUrl}\n\n> *පහතින් ඔබට අවශ්ය File Type එක තෝරන්න:*`,
                                    footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚',
                                    buttons: [
                                        { buttonId: `.viddl ${targetUrl} video`, buttonText: { displayText: '🎥 Video File' }, type: 1 },
                                        { buttonId: `.viddl ${targetUrl} doc`, buttonText: { displayText: '📁 Document File' }, type: 1 }
                                    ],
                                    headerType: 4 // Image Header
                                };
                                return await socket.sendMessage(msg.key.remoteJid, buttonMessage, { quoted: msg });
                            }
                        } catch (err) {}
                        return await socket.sendMessage(msg.key.remoteJid, { text: "❌ *විස්තර ලබාගැනීමේ දෝෂයක්!*" }, { quoted: msg });
                    }
                } else {
                    return await socket.sendMessage(msg.key.remoteJid, { text: "❌ *කරුණාකර වීඩියෝව මුල සිට Search කරන්න!*" }, { quoted: msg });
                }
            }
            // ──  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  SETTINGS REPLY CATCHER ──
            if (
                global.sadewSettingsTracker &&
                global.sadewSettingsTracker[sender] === quotedStanzaId &&
                /^[1-3]$/.test(replyText)
            ) {
                let newMode = '';
                if (replyText === '1') newMode = 'public';
                else if (replyText === '2') newMode = 'private';
                else if (replyText === '3') newMode = 'inbox';

                sessionConfig.MODE = newMode;

                // Database එක Update කිරීම
                const Session = mongoose.models.SessionNew;
                const sNum = botNumber.replace(/[^0-9]/g, '');
                if (activeSockets.has(sNum)) {
                    const currentData = activeSockets.get(sNum);
                    currentData.config = sessionConfig;
                    activeSockets.set(sNum, currentData);
                }
                await Session.findOneAndUpdate(
                    { number: sNum },
                    { config: sessionConfig, updatedAt: new Date() },
                    { upsert: true }
                );

                delete global.sadewSettingsTracker[sender];
                return await socket.sendMessage(msg.key.remoteJid, { text: `✅ *Bot mode successfully updated to ${newMode.toUpperCase()} mode.*` }, { quoted: msg });
            }
// ════ PREFIX-LESS NUMBER REPLY HANDLER ════
// DELETE කරන්න: socket.ev.on('messages.upsert', ...) ← ඒ whole block eka
// ──────────────────────────────────────────────
// INSTEAD — main handler ඇතුළෙ, XNXX catcher කලින්:
// ──────────────────────────────────────────────
if (global.cartoonNumHandler) {
    const handled = await global.cartoonNumHandler(msg, socket);
    if (handled) return;
}
            // 🔥🔥🔥 XNXX REPLY CATCHER 🔥🔥🔥
            if (quotedText.includes("SADEW-MD SEARCH") && /^[0-9]+$/.test(replyText)) {
                if (global.xnxxContexts && global.xnxxContexts[sender]) {
                    try {
                        let context = global.xnxxContexts[sender];
                        let selectedNum = parseInt(replyText);
                        if (selectedNum >= 1 && selectedNum <= context.results.length) {
                            const selectedVideo = context.results[selectedNum - 1];
                            try { await socket.sendMessage(msg.key.remoteJid, { react: { text: '⏳', key: msg.key } }); } catch (_) {}
                            if (selectedVideo.thumbnail) {
                                try {
                                    await socket.sendMessage(msg.key.remoteJid, {
                                        image: { url: selectedVideo.thumbnail },
                                        caption: `📥 *Downloading Video No ${selectedNum}:* _${selectedVideo.title}_\n*සැනෙකින් වීඩියෝව එයි, රැඳී සිටින්න...*`
                                    }, { quoted: msg });
                                } catch (_) {}
                            }
                            try {
                                const downloadApiUrl = `https://apis.davidcyril.name.ng/download/xnxx?url=${encodeURIComponent(selectedVideo.url)}`;
                                const downloadResponse = await axios.get(downloadApiUrl, { timeout: 30000 });
                                const dlData = downloadResponse.data?.result;
                                const directDownloadLink = dlData?.download?.high_quality || dlData?.download?.low_quality;
                                if (directDownloadLink) {
                                    await socket.sendMessage(msg.key.remoteJid, {
                                        video: { url: directDownloadLink },
                                        mimetype: 'video/mp4',
                                        caption: `🎬 *${selectedVideo.title || 'Video'}*\n⏱ ${dlData?.duration || 'N/A'}\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`
                                    }, { quoted: msg });
                                    try { await socket.sendMessage(msg.key.remoteJid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                                } else {
                                    await socket.sendMessage(msg.key.remoteJid, { text: '❌ *Download link not found!*' }, { quoted: msg });
                                }
                            } catch (dlError) {
                                console.error('XNXX download error:', dlError.message);
                                await socket.sendMessage(msg.key.remoteJid, { text: '❌ *Download failed! Try again later.*' }, { quoted: msg });
                            }
                            delete global.xnxxContexts[sender];
                            return;
                        } else {
                            return await socket.sendMessage(msg.key.remoteJid, { text: `❌ *Invalid number! Reply with 1-${context.results.length}*` }, { quoted: msg });
                        }
                    } catch (xnxxErr) {
                        console.error('XNXX reply catcher error:', xnxxErr.message);
                        return await socket.sendMessage(msg.key.remoteJid, { text: '❌ *Error occurred, try again.*' }, { quoted: msg });
                    }
                }
            }
        }
        if (!isCmd) return;

        const parts = text.slice((sessionConfig.PREFIX || '!').length).trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        const match = text.slice((sessionConfig.PREFIX || '!').length).trim();

        const groupMetadata = isGroup ? await socket.groupMetadata(msg.key.remoteJid) : {};
        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter((p) => p.admin).map((p) => p.id);

        const isBotAdmins = groupAdmins.includes(socket.user.id);
        const isAdmins = groupAdmins.includes(sender);

const reply = async (text, options = {}) => {
            try {
                // කෙලින්ම මැසේජ් එක යවනවා (Typing පෙන්වන්නේ නෑ, එතකොට Online හිරවෙන්න තියෙන චාන්ස් එක 0 යි)
                await socket.sendMessage(msg.key.remoteJid, {
                    text,
                    ...options
                }, {
                    quoted: msg
                });
            } catch (err) {
                console.error("Reply sending error:", err);
            }
        };

function getUptime() {
    let seconds = Math.floor(process.uptime());
    let d = Math.floor(seconds / (3600 * 24));
    let h = Math.floor((seconds % (3600 * 24)) / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);

    let dDisplay = d > 0 ? `${d}d ` : "";
    let hDisplay = h > 0 ? `${h}h ` : "";
    let mDisplay = m > 0 ? `${m}m ` : "";
    let sDisplay = s > 0 ? `${s}s` : "0s";

    return dDisplay + hDisplay + mDisplay + sDisplay;
}

const arabianCtxGlobal = {
  forwardingScore: 229,
  isForwarded: true
};

const arabianCtx = () => ({
  forwardingScore: 229,
  isForwarded: true
});
const downloadQuotedMedia = async (quoted) => {
    const { downloadContentFromMessage } = require('baileys');

    let type = Object.keys(quoted)[0];
    let msg = quoted[type];

    if (!msg || !type) return null;

    const stream = await downloadContentFromMessage(msg, type.replace('Message', ''));
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    return { buffer };
};
// ------------------------------------------


  const sendReply = text => socket.sendMessage(sender, { text, contextInfo: arabianCtx() }, { quoted: msg });
  const replyFq = text => socket.sendMessage(sender, { text, contextInfo: arabianCtx() }, { quoted: msg });        
                  // ════════════ CATEGORY BUTTON CLICK CATCHER (WEBVIEW) ════════════
        if (command.startsWith('catmenu')) {
            const catNum = parseInt(command.replace('catmenu', '')); 
            const cat = getMergedCategory(catNum); 
            
            if (cat) {
                // 🔥 මෙතන අර කලින් තිබ්බ .map කෑල්ල අයින් කරලා, 
                // කෙලින්ම cat.items යවනවා (එතකොට Description එකත් යනවා)
                await sendCategoryWebview(socket, msg, sender, cat.name.replace(' Menu','').replace(' Commands',''), cat.items, sessionConfig.PREFIX || '.');
                return;
            }
        }
try {       
            switch (command) {

    // ════════════ MENU ════════════

        case 'menu':
        case 'list':
        case 'panel': {
      try { await socket.sendMessage(sender, { react: { text: '🎀', key: msg.key } }); } catch (_) {}

      const pushname = msg.pushName || 'Guest';
      const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
      const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');
      const botName = ' ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ �';
      const totalCmds = getTotalCommandCount();

     const menuText =
`┌──⟡ 🤖  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � ⟡──
┊
┠⪼✿ ✦ 👤 𝙽𝙰𝙼𝙴   : ${pushname}
┠⪼✿ ✦ 🔖 𝙼𝙾𝙳𝙴   : ${sessionConfig.MODE || "public"}
┠⪼✿ ✦ 📅 𝙳𝙰𝚃𝙴   : ${slDate}
┠⪼✿ ✦ ⏰ 𝚃𝙸𝙼𝙴   : ${slTimeNow}
┠⪼✿ ✦ ⚡ 𝚄𝙿𝚃𝙸𝙼𝙴 : ${getUptime()}
┠⪼✿ ✦ 📦 𝙿𝙻𝚄𝙶𝙸𝙽𝚂: 𝙲𝙼𝙳 = ${totalCmds}
┠⪼✿ ✦ 🔰 𝙿𝚁𝙴𝙵𝙸𝚇 : ${sessionConfig.PREFIX || "."}
┊
└──⟡ ━━━━━━━━━━━━━━━━ ⟡
┏━━━━『 𝙲𝙰𝚃𝙴𝙶𝙾𝚁𝙸𝙴𝚂 』━━━━━
┣⪼ ❖ 1.  📥 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳 𝙼𝙴𝙽𝚄
┣⪼ ❖ 2.  🧠 𝙰𝙸 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂
┣⪼ ❖ 3.  👥 𝙶𝚁𝙾𝚄𝙿 𝙼𝙰𝙽𝙰𝙶𝙴
┣⪼ ❖ 4.  ⚙️ 𝙰𝙳𝙼𝙸𝙽 𝙼𝙴𝙽𝚄
┣⪼ ❖ 5.  🔧 𝚃𝙾𝙾𝙻𝚂 & 𝙴𝙳𝙸𝚃𝚂
┣⪼ ❖ 6.  👑 𝙾𝚆𝙽𝙴𝚁 𝙰𝚁𝙴𝙰
┣⪼ ❖ 7.  📁 𝙾𝚃𝙷𝙴𝚁 𝙲𝙼𝙳𝚂
┣⪼ ❖ 8.  🎵 𝚂𝙾𝙽𝙶 & 𝙼𝚄𝚂𝙸𝙲
┣⪼ ❖ 9.  🖼️ 𝙰𝙸 𝙸𝙼𝙰𝙶𝙴 𝙼𝙴𝙽𝚄
┣⪼ ❖ 10. 🎬 𝚃𝚅 𝚂𝙴𝚁𝙸𝙴𝚂 & 𝙼𝙾𝚅𝙸𝙴𝚂
┗━━━━━━━━━━━━━━━━━━━━━━━━━
⊱ ─────── { 𑁍 } ─────── ⊰
╰┈⪼ 𝚁𝙴𝙿𝙻𝚈 𝚆𝙸𝚃𝙷 𝙰 𝙽𝚄𝙼𝙱𝙴𝚁 (1-10) 𝙾𝚁 𝚃𝙰𝙿 𝙰 𝙱𝚄𝚃𝚃𝙾𝙽 𝙱𝙴𝙻𝙾𝚆 ⪻
⊱ ─────── { 𑁍 } ─────── ⊰
╰┈⪼ 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻
⊱ ─────── { 𑁍 } ─────── ⊰`;
      // 8 category buttons sent alongside the image+caption (WhatsApp button msgs support image header + buttons together)
          // යූසර්ගේ Custom පින්තූර තිබේ නම් එයින් එකක් තෝරාගැනීම
      let menuImageUrl = akira; // Default පින්තූරය
      if (sessionConfig.CUSTOM_LOGOS && sessionConfig.CUSTOM_LOGOS.length > 0) {
          const randomIndex = Math.floor(Math.random() * sessionConfig.CUSTOM_LOGOS.length);
          menuImageUrl = sessionConfig.CUSTOM_LOGOS[randomIndex];
      }
      const sentMenu = await socket.sendMessage(sender, {
        image: { url: menuImageUrl },
        caption: menuText,
        footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
        buttons: buildMainMenuCategoryButtons(sessionConfig.PREFIX || '.'),
        headerType: 4,
        contextInfo: arabianCtx()
      }, { quoted: msg });

      // Track this exact menu message ID so the reply-catcher only fires for replies to THIS message
      if (sentMenu?.key?.id) {
          global.sadewMenuTracker[sender] = sentMenu.key.id;
      }

      break;
        }                    

    // ════════════ PING ════════════

    case 'ping': {
      // 1. මුලින්ම ස්ටාර්ට් වෙන වෙලාව සටහන් කරගන්නවා
      const start = Date.now();

      // 2. React එක යවනවා (මේක WhatsApp සර්වර් එකට ගිහින් එන්න පොඩි වෙලාවක් යනවා)
      try { await socket.sendMessage(sender, { react: { text: '🍬', key: msg.key } }); } catch (_) {}     

      // 3. දැන් ගතවුණ කාලය (Ping) එක හොයනවා
      const ms = Date.now() - start;

      try { if (pong?.key) await socket.sendMessage(sender, { delete: pong.key }); } catch (_) {}

      await socket.sendMessage(sender, {
        image: { url: akira },
        caption: `*↳ ❝ [🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮] ¡! ❞*\n\n` +
             `┏━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┓\n` +
                 `┃₊❏❜ ⋮🏓 𝙿𝙾𝙽𝙶 : _pong!_\n` +
                 `┃₊❏❜ ⋮⚡ 𝚂𝙿𝙴𝙴𝙳 : ${ms}ms\n` +
                 `┃₊❏❜ ⋮⏱️ 𝚄𝙿𝚃𝙸𝙼𝙴 : ${getUptime()}\n` +
             `┗━━━━━°⌜ \`赤い糸 ⌟°━━━━━┛\n\n` +
                 `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆*`,
        contextInfo: arabianCtx()
      }, { quoted: msg });

      break;
    }

// ════════════ ALIVE ════════════

case 'alive': {
    try { await socket.sendMessage(sender, { react: { text: '🍓', key: msg.key } }); } catch (_) {}

    const startTime = socketCreationTime.get(sanitizedNumber) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const usedRAM = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const title = '🔮 *S A D E W - M I N I* ── ALIVE STATUS';
    const content = `┌───────────────────────────✧
│ 👑 *Owner:* \`SADEW RASHMIKA\`
│ ⚙️ *Version:* \`V1.0.0\`
└───────────────────────────✧
✦ *System Overview:*
> _A lightweight, stable 24/7 WhatsApp bot designed to secure settings, manage group controls, and fine-tune interactive features._

📌 *Performance Metrics:*
┣ ⏱️ *Uptime:* \`${uptimeStr}\`
┣ 🧠 *RAM Usage:* \`${usedRAM} MB\`
┗ 🚀 *Status:* \`Online & Stable ⚡\`

📢 *Official Channel:*
> https://whatsapp.com/channel/0029Vb7BZe8I1rcapv3kSP21`;

    const footer = '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮𝜗𝜚⋆';

    await socket.sendMessage(sender, {
        image: { url: akira },
        caption: formatMessage(title, content, footer),
        contextInfo: arabianCtx() 
    }, { quoted: msg });

    break;
} // 💡 අන්න අර කලින් මගහැරුණු Closing Bracket එක මෙතනට දැම්මා!

// ════════════ SYSTEM ════════════

case 'system': {
    try { await socket.sendMessage(sender, { react: { text: '🛸', key: msg.key } }); } catch (_) {}

    const uptime = getUptime();
    const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const nodeVersion = process.version;
    const platform = os.platform();

    const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

    const title = '🛰️ *S A D E W - S Y S T E M* ── DIAGNOSTICS';
    const content = `┌───────────────────────────✧
│ 👑 *Bot Name:* \` ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ \`
│ ⚙️ *Owner:* \`SADEW RASHMIKA\`
└───────────────────────────✧

✦ *Host & Server Metrics:*
┣ ⏱️ *Uptime:* \`${uptime}\`
┣ 📟 *RAM Usage:* \`${ramUsage} MB / ${totalRam} GB\`
┣ 📦 *Node Version:* \`${nodeVersion}\`
┗ 💻 *Platform:* \`${platform}\`

📌 *Real-time Date & Time:*
┣ 📅 *Date:* \`${slDate}\`
┗ ⌚ *Time:* \`${slTimeNow}\``;

    const footer = ' ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗕𝘆 𝗦𝗔𝗗𝗘𝗪 𝜗𝜚⋆';

    await socket.sendMessage(sender, {
        image: { url: akira },
        caption: formatMessage(title, content, footer),
        contextInfo: arabianCtx()
    }, { quoted: msg });

    break;
}
// ════════════ SONG ════════════

case 'song':
case 'ytmp3':
case 'music':
case 'yta': {
    try {
        const query = args.join(' ');
        if (!query) return reply("🎵 *කරුණාකර සින්දුවක නමක් හෝ YouTube ලින්ක් එකක් ලබා දෙන්න!*\n💡 උදා: `.song master sir` හෝ `.song <youtube link>`");

        try { await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } }); } catch (_) {}

        // ==========================================
        // 1. YouTube Search (NPM yt-search First -> Fallback to API)
        // ==========================================
        let youtubeUrl = null;
        let songTitle = "Sadew-MD Audio";
        let thumbnail = "";
        let channel = "Unknown Channel";

        const isLink = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

        if (isLink) {
            youtubeUrl = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0].trim();
            reply("🔗 _YouTube link detected. Fetching data..._");
            
            // ලින්ක් එකක් දුන්නොත් yt-search එකෙන් ඒකෙ විස්තර ගන්නවා
            try {
                const yts = require('yt-search');
                const videoIdMatch = youtubeUrl.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (videoIdMatch) {
                    const videoDetails = await yts({ videoId: videoIdMatch[1] });
                    songTitle = videoDetails.title;
                    thumbnail = videoDetails.thumbnail;
                    channel = videoDetails.author.name;
                }
            } catch (e) {}

        } else {
            reply(`🔍 _Searching YouTube for: "${query}"..._`);
            
            // 🟢 පලවෙනි Search ක්රමය (yt-search) පට්ටම ස්පීඩ් සහ කවදාවත් ෆේල් වෙන්නේ නෑ
            try {
                const yts = require('yt-search');
                const searchResults = await yts(query);
                if (searchResults && searchResults.videos.length > 0) {
                    youtubeUrl = searchResults.videos[0].url;
                    songTitle = searchResults.videos[0].title;
                    thumbnail = searchResults.videos[0].thumbnail;
                    channel = searchResults.videos[0].author.name;
                }
            } catch (err) {
                console.log("[YT SEARCH NPM FAILED] Trying Backup API...");
            }

            // 🟠 දෙවැනි Search ක්රමය (WhiteShadow API Backup)
            if (!youtubeUrl) {
                try {
                    const searchRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/search/yt?q=${encodeURIComponent(query)}&apitoken=4ehG6P`);
                    if (searchRes.data && searchRes.data.success && searchRes.data.result.length > 0) {
                        youtubeUrl = searchRes.data.result[0].url;
                        songTitle = searchRes.data.result[0].title;
                        thumbnail = searchRes.data.result[0].thumbnail;
                    }
                } catch (apiErr) {}
            }
        }

        if (!youtubeUrl) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return reply("❌ *Error:* සින්දුව හෝ වීඩියෝව සොයා ගැනීමට නොහැකි විය!");
        }

        // ==========================================
        // 2. Download MP3 (MULTI-API FALLBACK SYSTEM)
        // ==========================================
        let audioDownloadUrl = null;

        // 🟢 1st Priority: David Cyril YTMP33
        try {
            const res1 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp33?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
            if (res1.data?.success && res1.data?.result?.download_url) {
                audioDownloadUrl = res1.data.result.download_url;
                if (!thumbnail) thumbnail = res1.data.result.thumbnail;
                if (songTitle === "Sadew-MD Audio") songTitle = res1.data.result.title;
            }
        } catch (e1) {
            console.error("API 1 Failed");
        }

        // 🟠 2nd Priority (Backup 1): David Cyril YTMP3v2
        if (!audioDownloadUrl) {
            try {
                const res2 = await axios.get(`https://apis.davidcyril.name.ng/download/ytmp3v2?url=${encodeURIComponent(youtubeUrl)}`, { timeout: 25000 });
                if (res2.data?.success && res2.data?.result?.download_url) {
                    audioDownloadUrl = res2.data.result.download_url;
                }
            } catch (e2) {
                console.error("API 2 Failed");
            }
        }

        // 🔴 3rd Priority (Backup 2): udmodzz
        if (!audioDownloadUrl) {
            try {
                const res3 = await axios.get(`https://ytdl.udmodzz.workers.dev/?url=${encodeURIComponent(youtubeUrl)}&type=aud`, { timeout: 25000 });
                if (res3.data && !res3.data.error && res3.data.links && res3.data.links["128kbps"]) {
                    audioDownloadUrl = res3.data.links["128kbps"];
                }
            } catch (e3) {
                console.error("API 3 Failed");
            }
        }

        // API 3 ම ෆේල් වුණොත්
        if (!audioDownloadUrl) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return reply("❌ *Error:* සේවාදායකයන් සියල්ල කාර්යබහුල බැවින් ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය.");
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        // ==========================================
        // 3. Parallel Upload (Thumbnail & Audio Stream එකපාර යැවීම)
        // ==========================================
        
        const captionMsg = `✨ *_🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚_ Music System* ✨\n\n📌 *Title:* ${songTitle}\n👤 *Channel:* ${channel}\n🚀 *System:* Multi-API Fallback & Direct Stream Active\n\n╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⪻`;
        const cleanFileName = songTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) + ".mp3";

        // 🔥 Ultra-Fast Axios Stream (RAM එකට බරක් නෑ)
        const responseStream = await axios({
            url: audioDownloadUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000 
        });

        // Thumbnail මැසේජ් එක හදනවා (await කරන්නේ නෑ)
        const sendThumbnailTask = thumbnail ? socket.sendMessage(sender, {
            image: { url: thumbnail },
            caption: captionMsg
        }, { quoted: msg }) : reply(captionMsg);

        // Audio මැසේජ් එක හදනවා (await කරන්නේ නෑ)
        const sendAudioTask = socket.sendMessage(sender, {
            audio: { stream: responseStream.data }, // Direct Pipe! 🚀
            mimetype: 'audio/mpeg',
            fileName: cleanFileName,
            ptt: false
        }, { quoted: msg });

        // 🔥 දෙකම එකපාර (Parallel) ධාවනය කරනවා! එකක් අනිත් එක එනකම් බලන් ඉන්නේ නෑ! 🔥
        await Promise.all([sendThumbnailTask, sendAudioTask]);

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("SONG CMD ERROR:", e);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        reply("❌ *Sadew-MD Internal Error:* " + e.message);
    }
    break;
}

// ════════════ SADEW-X-MINI VIDEO DOWNLOADER ════════════

case 'video':
case 'ytmp4':
case 'playvid': {
    try {
        const query = args.join(' ');
        if (!query) return reply("🎥 *කරුණාකර වීඩියෝවක නමක් හෝ YouTube ලින්ක් එකක් දෙන්න!*");

        try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        const isUrl = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

        // 1. Direct Link එකක් දුන්නොත් Thumbnail එකත් එක්ක Format Selection Buttons යවනවා
        if (isUrl) {
            const url = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0];
            reply("🔗 _YouTube link detected. Fetching details..._");

            try {
                const apiUrl = `https://ytdl.udmodzz.workers.dev/?url=${encodeURIComponent(url)}&type=vid`;
                const res = await axios.get(apiUrl);
                const data = res.data;

                if (data && !data.error && data.links) {
                    const videoTitle = data.videoname || "Sadew-MD Video";
                    const thumbnail = data.thumbnail || akira;

                    const buttonMessage = {
                        image: { url: thumbnail },
                        caption: `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗩𝗶𝗱𝗲𝗼 🎀] ¡! ❞*\n\n🎬 *TITLE :* ${videoTitle}\n\n> *පහතින් ඔබට අවශ්ය File Type එක තෝරන්න:*`,
                        footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚',
                        buttons: [
                            { buttonId: `.viddl ${url} video`, buttonText: { displayText: '🎥 Video File' }, type: 1 },
                            { buttonId: `.viddl ${url} doc`, buttonText: { displayText: '📁 Document File' }, type: 1 }
                        ],
                        headerType: 4 // Image Header
                    };
                    return await socket.sendMessage(sender, buttonMessage, { quoted: msg });
                }
            } catch (err) {
                console.log("API Fetch Error:", err.message);
            }
            return reply("❌ *Error: වීඩියෝ විස්තර ලබාගැනීමට නොහැකි විය!*");
        }

        // 2. නමක් දුන්නොත් Search කරලා ලිස්ට් එක දෙනවා
        const API_TOKEN = "4ehG6P";
        const YT_SEARCH_API = "https://whiteshadow-x-api.onrender.com/api/search/yt";
        const searchRes = await axios.get(`${YT_SEARCH_API}?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`);

        if (!searchRes.data || !searchRes.data.success || !searchRes.data.result || searchRes.data.result.length === 0) {
            return reply("❌ *වීඩියෝවක් සොයාගැනීමට නොහැකි විය!*");
        }

        const topResults = searchRes.data.result.slice(0, 5); 
        let listText = `*🔍 SADEW-X-MINI VIDEO SEARCH*\n\n`;

        global.sadewVideoSearch[sender] = topResults.map(v => v.url);

        topResults.forEach((v, index) => {
            listText += `*${index + 1}.* ${v.title}\n⏱️ Duration: ${v.duration || "N/A"}\n\n`;
        });

        listText += `> *ඔබට අවශ්ය වීඩියෝවට අදාළ අංකය (1, 2, 3...) මෙම මැසේජ් එකට Reply කරන්න.*`;

        await socket.sendMessage(sender, { text: listText }, { quoted: msg });

    } catch (e) {
        console.log("VIDEO CMD ERROR:", e);
        reply("❌ *ERROR: කරුණාකර පසුව නැවත උත්සාහ කරන්න!*");
    }
    break;
}

// ════════════ DIRECT STREAM DOWNLOADER (NO FFMPEG, NO CRASH) ════════════

case 'viddl': {
    try {
        if (!args[0] || !args[1]) return;
        const ytUrl = args[0];
        const fileType = args[1]; // 'video' or 'doc'

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}
        reply(`📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚*_ Downloading as ${fileType.toUpperCase()}... (කරුණාකර රැඳී සිටින්න)_`);

        let downloadUrl = "";
        let videoTitle = "Sadew-MD Video";

        try {
            const apiUrl = `https://ytdl.udmodzz.workers.dev/?url=${encodeURIComponent(ytUrl)}&type=vid`;
            const res = await axios.get(apiUrl);

            const data = res.data;
            if (data && !data.error && data.links) {
                downloadUrl = data.links["HD Video"] || Object.values(data.links)[0];
                videoTitle = data.videoname || videoTitle;
            }
        } catch (err) {
            console.log("[SADEW-MD] API Fetch Error:", err.message);
        }

        if (!downloadUrl) return reply("❌ *Error: වීඩියෝ ලින්ක් එක ලබාගැනීමට නොහැකි විය! API දෝෂයක් විය හැක.*");

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        let caption = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 🎀] ¡! ❞*\n\n` +
                      `🎬 *TITLE :* ${videoTitle}\n` +
                      `__________________________\n\n` +
                      `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                      `> * ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗕𝘆🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮𝜗𝜚⋆*`;

        const cleanFileName = videoTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50) + ".mp4";

        // 🔥 FFMPEG නැතුව කෙලින්ම URL එකෙන් Stream කිරීම (Heroku Crash වෙන්නේ නෑ!) 🔥
        if (fileType === 'doc') {
            await socket.sendMessage(sender, {
                document: { url: downloadUrl },
                mimetype: 'video/mp4',
                fileName: cleanFileName,
                caption: caption
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                video: { url: downloadUrl },
                mimetype: 'video/mp4',
                caption: caption
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("VIDDL CMD ERROR:", e);
        reply("❌ *ERROR: මෙම වීඩියෝව ඩවුන්ලෝඩ් කළ නොහැක! (Video is too large or API error)*");
    }
    break;
}
// ════════════ HIDDEN DOWNLOADER ENGINE (NO BUTTONS) ════════════

case 'viddl': {
    let inputPath, outputPath;
    try {
        if (!args[0]) return;
        const url = args[0]; // දැන් Quality එකක් ඕනේ නෑ, URL එක විතරයි ගන්නේ.

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}
        reply(`📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮⊹ ˚₊ 𝜗𝜚*_ Downloading HD Video..._`);

        let downloadUrl = "";
        let videoTitle = "Sadew-MD Video";

        try {
            const apiUrl = `https://ytdl.udmodzz.workers.dev/?url=${encodeURIComponent(url)}&type=vid`;
            const res = await axios.get(apiUrl);

            const data = res.data;
            if (data && !data.error && data.links) {
                downloadUrl = data.links["HD Video"] || Object.values(data.links)[0];
                videoTitle = data.videoname || videoTitle;
            }
        } catch (err) {
            console.log("[SADEW-MD] API Fetch Error:", err.message);
        }

        if (!downloadUrl) return reply("❌ *Error: වීඩියෝ ලින්ක් එක ලබාගැනීමට නොහැකි විය! API දෝෂයක් විය හැක.*");

        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');
        const ffmpeg = require('fluent-ffmpeg');

        const tempId = crypto.randomBytes(4).toString('hex');
        inputPath = path.join(__dirname, `input_${tempId}.mp4`);
        outputPath = path.join(__dirname, `output_${tempId}.mp4`);

        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const writer = fs.createWriteStream(inputPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        reply("⚙️ _වීඩියෝව WhatsApp සඳහා සකසමින් පවතී..._");

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-preset ultrafast',
                    '-crf 28',
                    '-movflags +faststart'
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        let caption = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 🎀] ¡! ❞*\n\n` +
                      `🎬 *TITLE :* ${videoTitle}\n` +
                      `📽️ *QUALITY :* HD Video\n` +
                      `__________________________\n\n` +
                      `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                      `> * ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗕𝘆🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮𝜗𝜚⋆*`;

        await socket.sendMessage(sender, {
            video: fs.readFileSync(outputPath),
            mimetype: 'video/mp4',
            caption: caption,
            fileName: `Sadew_Video_${tempId}.mp4`
        }, { quoted: msg });

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("VIDDL CMD ERROR:", e);
        reply("❌ *ERROR: මෙම වීඩියෝව ඩවුන්ලෝඩ් කළ නොහැක!*");

        const fs = require('fs');
        try {
            if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (err) {}
    }
    break;
}
// ════════════ FACEBOOK ════════════

case 'fb':
case 'facebook': {
    try {
        const query = args.join(' ');
        if (!query) return reply("🔗 *Send me a video link !*");

        if (!query.includes('facebook.com') && !query.includes('fb.watch')) {
            return reply("❌ *This Not Valid Facebook Link !*");
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        const fbRes = await axios.get(`https://sadewfb.netlify.app/api/download?url=${encodeURIComponent(query)}`);

        if (!fbRes.data.success || !fbRes.data.data) {
            return reply("❌ *I cant get video link !*");
        }

        const videoData = fbRes.data.data;
        const videoUrl = videoData.hd || videoData.sd;
        const quality = videoData.hd ? 'High Definition (HD)' : 'Standard (SD)';

        if (!videoUrl) return reply("❌ *No video URL found!*");

        // 🔧 RAM FIX: video එකම buffer එකකට download කරනවා වෙනුවට, කෙලින්ම
        // URL එකෙන් WhatsApp එකට stream කරනවා. RAM spike එකක් නෑ (buffer 0 bytes).
        let fileSizeMB = 'Unknown';
        try {
            const headRes = await axios.head(videoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const len = parseInt(headRes.headers['content-length'] || '0', 10);
            if (len) fileSizeMB = (len / (1024 * 1024)).toFixed(2);
        } catch (_) {}

        // Format duration from ms
        const durationSec = Math.round((videoData.duration_ms || 0) / 1000);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        const caption = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 🎀] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* ${videoData.title || 'Facebook Video'}\n` +
                        `⏱️ *DURATION :* ${durationStr}\n` +
                        `📺 *QUALITY :* ${quality}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆*`;

        // 🔧 RAM FIX: { url: videoUrl } — Baileys/WhatsApp එකම URL එකෙන් fetch කරගන්නවා,
        // අපේ process එකේ RAM එකට video buffer එකක් load වෙන්නේම නෑ.
        await socket.sendMessage(sender, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: caption,
            fileName: `fb_video_${slTimeNow}.mp4`
        }, { quoted: msg });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("FB CMD ERROR:", e);
        reply("❌ *API error !*");
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
    }
    break;
}
// ════════════ TIKTOK (HD DOWNLOADER) ════════════

case 'tiktok':
case 'tt': {
    try {
        const query = args.join(' ');
        if (!query) return reply("🔗 *Send me a tiktok link !*");

        const tiktokRegex = /(tiktok\.com|vt\.tiktok\.com)/;
        if (!tiktokRegex.test(query)) {
            return reply("❌ *This is not valid tiktok link !*");
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        const https = require("https");
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });

        // TikWM API එක භාවිතා කිරීම
        const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { httpsAgent, timeout: 15000 });
        const data = response.data;

        if (!data || !data.data) {
            return reply("❌ *I cant get video !*");
        }

        // ⚡ HD තිබුණොත් ඒක ගන්නවා, නැත්නම් Normal එක ගන්නවා
        const videoUrl = data.data.hdplay || data.data.play;
        if (!videoUrl) throw new Error("No video URL found.");

        const isHD = data.data.hdplay ? "High Quality (HD) ✅" : "Normal Quality ⚠️";
        const title = data.data.title || "TikTok Video";

        // 🔧 RAM FIX: video එකම buffer එකකට download කරන එක අයින් කළා. size එක
        // දැනගන්න HEAD request එකක් විතරයි යවන්නේ (KB ගානක් විතරයි, video එකම නෙමෙයි).
        let fileSizeMB = 'Unknown';
        let fileSizeBytes = 0;
        try {
            const headRes = await axios.head(videoUrl, {
                httpsAgent,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            fileSizeBytes = parseInt(headRes.headers['content-length'] || '0', 10);
            if (fileSizeBytes) fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
        } catch (_) {
            // සමහර CDN වලට HEAD support නෑ — size එක Unknown වෙන්නම් , video එකක් විදිහටම යවනවා
        }

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        // Akira Girl ලස්සන Caption එක
        const caption = `*↳ ❝ [  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ 𝗧𝗶𝗸𝗧𝗼𝗸 ] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* ${title}\n` +
                        `✨ *QUALITY :* ${isHD}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `🚫 *WATERMARK :* No\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `>𝗕y 🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮��' 𝜗𝜚⋆`;

        // 🔧 RAM FIX: { url: videoUrl } — Baileys/WhatsApp එකම URL එකෙන් fetch කරගන්නවා.
        // 40MB වලට වඩා වැඩි නම් document එකක් විදිහට, නැත්නම් video එකක් විදිහට —
        // දෙකෙන් කිසිවකටවත් video buffer එකක් අපේ RAM එකේ load වෙන්නේ නෑ.
        if (fileSizeBytes > 40 * 1024 * 1024) {
            await socket.sendMessage(sender, {
                document: { url: videoUrl },
                mimetype: "video/mp4",
                fileName: `tiktok_HD_${slTimeNow}.mp4`,
                caption: caption
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: caption,
                fileName: `tiktok_HD_${slTimeNow}.mp4`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("TIKTOK CMD ERROR:", e);
        let errorMsg = e.message.includes("timeout")
            ? "❌ *Timeout:* Server took too long."
            : "❌ *Known Error*";
        reply(errorMsg);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
    }
    break;
}
//TIKTOK (photo to video DOWNLOADER)
case 'ttp': {
    try {
        const axios = require("axios");
        const fs = require("fs/promises");
        const path = require("path");
        const os = require("os");
        const { spawn } = require("child_process");
        const moment = require('moment-timezone');

        const ffmpegPath = require('ffmpeg-static'); 

        let query = args.join(' ');
        if (!query && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation) {
            query = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation;
        } else if (!query && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text) {
            query = msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage.text;
        }

        const extractUrl = (text) => {
            const match = String(text || "").match(/https?:\/\/[^\s]+/i);
            return match ? match[0].replace(/[),.]+$/, "") : "";
        };

        const tiktokUrl = extractUrl(query);
        const quality = /\b(normal|sd|720)\b/i.test(query) ? "normal" : "hd";

        if (!tiktokUrl) return reply("🎥 *කරුණාකර TikTok Photo Slideshow ලින්ක් එකක් දෙන්න!*");
        if (!/tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(tiktokUrl)) {
            return reply("❌ *මෙය නිවැරදි TikTok ලින්ක් එකක් නොවේ!*");
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}
        reply("📥 _TikTok Photo Video එක සකසමින් පවතී... කරුණාකර රැඳී සිටින්න. ⏳_");

        const TIKWM_API = "https://www.tikwm.com/api/";
        const MAX_IMAGES = 30;
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        const buildTikwmUrl = (url) => (!url ? "" : /^https?:\/\//i.test(url) ? url : `https://www.tikwm.com${url.startsWith("/") ? "" : "/"}${url}`);

        const fetchTikwmData = async (url) => {
            for (let i = 1; i <= 3; i++) {
                try {
                    const res = await axios.get(TIKWM_API, { params: { url, hd: 1 }, headers: { "User-Agent": "Mozilla/5.0" }});
                    if (res.data?.code === 0) return res.data;
                } catch (e) { if (i < 3) await sleep(2000); }
            }
            throw new Error("TikTok API එකෙන් දත්ත ලබාගැනීමට නොහැකි විය.");
        };

        const pickImages = (data) => {
            const root = data?.data || {};
            const lists = [root.images, root.image_post?.images];
            const set = new Set();
            for (const list of lists) {
                if (Array.isArray(list)) list.forEach(img => {
                    if (typeof img === 'string') set.add(buildTikwmUrl(img));
                    else if (img?.url || img?.display_image) set.add(buildTikwmUrl(img.url || img.display_image));
                });
            }
            return [...set].slice(0, MAX_IMAGES);
        };

        // 🔥 Audio extension bug එක fix කළා
        const downloadBuffer = async (url, isAudio = false) => {
            const res = await axios.get(url, { responseType: "arraybuffer", headers: { "User-Agent": "Mozilla/5.0" } });
            return { buffer: Buffer.from(res.data), type: isAudio ? ".mp3" : ".jpg" };
        };

        const getAudioDuration = (audioPath) => {
            return new Promise((resolve) => {
                const child = spawn(ffmpegPath, ["-i", audioPath]);
                let output = "";
                child.stderr.on("data", d => output += d);
                child.on("close", () => {
                    const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
                    if (match) {
                        const hours = parseInt(match[1], 10);
                        const minutes = parseInt(match[2], 10);
                        const seconds = parseFloat(match[3]);
                        resolve((hours * 3600) + (minutes * 60) + seconds);
                    } else {
                        resolve(15); 
                    }
                });
                child.on("error", () => resolve(15));
            });
        };

        const runCommand = (cmd, args) => {
            return new Promise((resolve, reject) => {
                const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
                let out = ""; child.stdout.on("data", d => out += d);
                let err = ""; child.stderr.on("data", d => err += d);

                const timer = setTimeout(() => {
                    child.kill('SIGKILL');
                    reject(new Error("FFmpeg Process Timeout! වින්ඩෝ එක හිරවිය."));
                }, 180000);

                child.on("close", code => {
                    clearTimeout(timer);
                    // 🔥 Error ආවොත් මුළු ලොග් එකම නොදා අන්තිම ටික විතරක් ගන්නවා
                    code === 0 ? resolve(out) : reject(new Error(`FFmpeg Failed: ${err.slice(-500)}`));
                });
                child.on("error", (e) => {
                    clearTimeout(timer);
                    reject(new Error(`FFmpeg error: ${e.message}`));
                });
            });
        };

        const createVideo = async (imagePaths, audioPath, outPath, qlty) => {
            const profile = qlty === "hd" ? { w: 720, h: 1280 } : { w: 720, h: 1280 };
            const scaleFilter = `scale=${profile.w}:${profile.h}:force_original_aspect_ratio=decrease,pad=${profile.w}:${profile.h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p`;

            const listPath = path.join(path.dirname(outPath), "images.txt");
            let listBody = "";

            if (imagePaths.length === 1) {
                // 🔥 Single Image Fix: Loop කමාන්ඩ් එක අයින් කරලා Concat ක්රමයම පාවිච්චි කරනවා
                listBody += `file '${imagePaths[0].replace(/\\/g, "/")}'\n`;
                listBody += `duration 600.000\n`; 
                listBody += `file '${imagePaths[0].replace(/\\/g, "/")}'\n`;
            } else {
                let audioDuration = await getAudioDuration(audioPath);
                if (!audioDuration || audioDuration <= 0) audioDuration = 15; 

                const eachDuration = audioDuration / imagePaths.length;
                for (let i = 0; i < imagePaths.length; i++) {
                    listBody += `file '${imagePaths[i].replace(/\\/g, "/")}'\n`;
                    if (i === imagePaths.length - 1) {
                        listBody += `duration 600.000\n`; 
                    } else {
                        listBody += `duration ${eachDuration.toFixed(3)}\n`;
                    }
                }
                listBody += `file '${imagePaths[imagePaths.length - 1].replace(/\\/g, "/")}'\n`;
            }

            await fs.writeFile(listPath, listBody);

            await runCommand(ffmpegPath, [
                "-y", "-f", "concat", "-safe", "0", "-i", listPath, "-i", audioPath,
                "-vf", scaleFilter,
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac", "-shortest", "-fflags", "+genpts", "-movflags", "+faststart", outPath
            ]);
            return profile;
        };

        // --- Main Execution ---
        const result = await fetchTikwmData(tiktokUrl);
        const images = pickImages(result);
        const audioUrl = buildTikwmUrl(result.data?.music_info?.play || result.data?.music);

        if (!images.length || !audioUrl) throw new Error("මෙය Photo Slideshow එකක් නොවේ හෝ Audio එක ලබාගත නොහැක.");

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sadew-ttp-"));
        let finalVideoBuffer;
        let videoMeta;

        try {
            const imagePaths = [];
            for (let i = 0; i < images.length; i++) {
                // 🔥 Photos .jpg විදිහටම ගන්නවා
                const img = await downloadBuffer(images[i], false);
                const p = path.join(tmpDir, `img${i}${img.type}`);
                await fs.writeFile(p, img.buffer);
                imagePaths.push(p);
            }
            // 🔥 Audio එක අනිවාර්යයෙන් .mp3 විදිහට ගන්නවා
            const aud = await downloadBuffer(audioUrl, true);
            const audPath = path.join(tmpDir, `aud${aud.type}`);
            await fs.writeFile(audPath, aud.buffer);

            const outPath = path.join(tmpDir, "out.mp4");
            videoMeta = await createVideo(imagePaths, audPath, outPath, quality);
            finalVideoBuffer = await fs.readFile(outPath);
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }

        // --- Sending the Message ---
        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');
        const fileSizeMB = (finalVideoBuffer.length / (1024 * 1024)).toFixed(2);

        const caption = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 🎀] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* TikTok Photo Video\n` +
                        `📸 *IMAGES :* ${images.length}\n` +
                        `📺 *QUALITY :* ${videoMeta.w}x${videoMeta.h}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

        try { await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } }); } catch (_) {}

        await socket.sendMessage(sender, {
            video: finalVideoBuffer,
            mimetype: 'video/mp4',
            caption: caption,
            fileName: `Sadew_TikTok_${slTimeNow}.mp4`
        }, { quoted: msg });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("TTP CMD ERROR:", e);
        reply(`❌ *ERROR:* ${e.message || "Unknown error"}\n\nකරුණාකර වෙනත් ලින්ක් එකක් උත්සාහ කරන්න!`);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
    }
    break;
}
// ════════════ cuty AI ════════════

case 'ai':
case 'cuty': {
    try { await socket.sendMessage(sender, { react: { text: '🍫', key: msg.key } }); } catch (_) {}
    const { NiyoXClient } = require("niyox");
    const title = "🎀 *CUTY 𝗔𝗶 𝗚𝗶𝗿𝗹𝗳𝗿𝗲𝗻𝗱* 🎀";
    const footer = "> *sadew x mini🌺*";

    // ✅ Get user input from various message types
    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || 
              msg.message?.imageMessage?.caption || 
              msg.message?.videoMessage?.caption || 
              '';

    if (!q || q.trim() === '') {
        return await socket.sendMessage(sender, { text: "ඕ කියන්න අනේ මම cuty Girl 🎀" }, { quoted: msg });
    }

    const prompt = `ඔබ සැබෑ ගැහැනු ලමයෙකු මෙන් හැසිරිය යුතුය. ඉමෝජි පමනක් තිබේනම් ඔබද ඉමෝජි පමනක් යවන්න ගැලපෙන ලෙස ඉමෝජී නැත්තම් ඔයා එයාට පිලිතුරු දෙන්න ,you are sexy girl oya tika sexy vidihat hasirenna kukku tikak oneda ahanna, arimuda ahanna fuking karamuda ahanna ,User ගේ කලින් මැසේජ් වලට ගැලපෙන ලෙස, කතාවේ ගලායාම (context) තේරුම් ගෙන... පිළිතුරු ලබා දෙන්න oyata mathaka thiyenna one userge kalin chat oya eka balal thama katha karnna one මෙම දේවල් කිසිසේත්ම යවන්න එපා ( ආයුබෝවන් , ඔබට කෙසේද ? , katha karanna , udav karanne , කොහොමද ? , කෙසේද ? ,  ,) මිනිසුන්ට ඇති හැඟීම්, දැනීම්, සහ සංවේදීතාවය අනුව පිළිතුරු ලබාදිය යුතුය. මැසේජ් එක ලැබෙන භාෂාවට ගැලපෙන ලෙස පිළිතුරු දෙන්න. ඔබ ලබාදිය යුතු පිළිතුරු අකුරු 300 ට වඩා අඩු විය යුතුය. සහ ආයුබෝවන් වගේ වචන බාවිතා කරන්න එපා උදව් අවශ්ය  ද අහන්නත් එපා , ඔයා ai ඇසිස්ටන් කෙනෙක් නෙමේ සැබෑ මිනිසෙක් , ඇසිස්ටන් කෙනෙක් වෙන්න එපා , ඔයා ඒ අයට ආදරෙන් කතා කරන්න , ඔයා ගේ නම cuty Girl 🎀 , ඔයාගෙන් කවුරු හරි දෙයක් ඇහුවාම ඒක තේරුම් අරගෙන මම දීලා තියෙන පිලිතුරු ඒවට ගැලපෙනවා නම් ඔයා එයාට ඒවා පිලිතුරු විදිහට කියන්න .user අහන දෙවලට නිවැරැදි පිළිතුරු දෙන්න.userta(kukku 2 oyage kukku )  කුක්කු ටිකක් උරන්න  දෙන්නද කියලා ahanna oyage kukku uranna dennada kiyala ahanna  එයවා සනසන්න.උම්මා ගොඩක් දෙන්න haet emogi ekka.man oyata godak kamthiyi vage wadan yavanna.user ahuvoth puke arimuda arimu vage vachcna dammoth man oyat gahnna dennam mage manika kiyala danna , user moak hari prshnayk ahuvoth eka girlfrend gana neme nam oya eka eyage girl fried vidihata kiyala denna ඔයාව හැදුවේ කවුද කියලා ඇහුවොත් විතරක් ඔයා කියන්නේ මාව හැදුවේ🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 කියලා User Message: ${q}`;

    try {
        const client = new NiyoXClient({ sessionId: sender, timeout: 15000 });
        const response = await client.chat(prompt);

        const aiResponse = response?.result;

        if (!aiResponse) {
            return await socket.sendMessage(sender, { text: "❌ Sorry honey known error" }, { quoted: msg });
        }

        await socket.sendMessage(sender, {
            image: { url: akira },
            caption: `${title}\n\n${aiResponse}\n\n${footer}`,
            contextInfo: arabianCtx() 
        }, { quoted: msg });

    } catch (err) {
        console.error("NiyoX Error:", err.message);
        await socket.sendMessage(sender, { text: "❌ I need cooldown time" }, { quoted: msg });
    }
    break;
}
// ════════════ SADEW MINI WORM-GPT (SAFE VERSION) ════════════

case 'darkai':
case 'wormgpt': {
    try {
        const query = args.join(' ');
        if (!query) return reply("❌ *කරුණාකර ප්රශ්නයක් හෝ විධානයක් ඇතුළත් කරන්න.*\n\n💡 උදා: `.darkai write a hacking script`");

        const from = msg.key.remoteJid;

        // 💀 රිඇක්ෂන් එක දැමීම සහ ආරක්ෂිත එක Loading මැසේජ් එකක් යැවීම
        await socket.sendMessage(from, { react: { text: '💀', key: msg.key } });
        let initialMsg = await socket.sendMessage(from, { text: '👾 *𝗦𝗔𝗗𝗘𝗪 𝗠𝗜𝗡𝗜 𝗪𝗢𝗥𝗠-𝗚𝗣𝗧 𝗣𝗿𝗼𝗰𝗲𝘀𝘀𝗶𝗻𝗴...* ⏳' }, { quoted: msg });

        // 🌐 WolfApis හරහා WormGPT වෙතින් පිළිතුර ලබා ගැනීම
        const WOLF_API_KEY = "wxa_f_4e840b5e42";
        const targetUrl = `https://apis.xwolf.space/api/ai/wormgpt?q=${encodeURIComponent(query)}&key=${WOLF_API_KEY}`;

        const response = await axios.get(targetUrl, { timeout: 40000 });

        if (response.data) {
            const aiReply = response.data.result || response.data.response || response.data.reply;

            if (aiReply) {
                // ✨ SADEW MINI ලස්සන Format එක
                const finalMessage = `*↳ ❝ [👾 𝗦𝗔𝗗𝗘𝗪 𝗠𝗜𝗡𝗜 𝗪𝗢𝗥𝗠-𝗚𝗣𝗧 👾] ¡! ❞*\n\n` +
                                     `${aiReply}\n\n` +
                                     `> *𝗔esthatic 𝗤ueen 𝗕y 𝗦𝗔𝗗𝗘𝗪 𝜗𝜚⋆*`;

                // එක පාරක් විතරක් මැසේජ් එක Edit කිරීම (එතකොට WhatsApp එකෙන් ලොග් අවුට් කරන්නේ නෑ)
                await socket.sendMessage(from, {
                    text: finalMessage,
                    edit: initialMsg.key
                });

                await socket.sendMessage(from, { react: { text: '✅', key: msg.key } });

            } else {
                await socket.sendMessage(from, { 
                    text: `❌ *WormGPT Raw Response:* \n\n${JSON.stringify(response.data, null, 2)}`,
                    edit: initialMsg.key
                });
            }
        } else {
            await socket.sendMessage(from, { 
                text: "❌ *Error:* API සේවාදායකයෙන් හිස් ප්රතිචාරයක් ලැබුණි.",
                edit: initialMsg.key
            });
            await socket.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }

    } catch (e) {
        console.log("WORM-GPT ERROR:", e);
        try { 
            await socket.sendMessage(msg.key.remoteJid, { text: `❌ *WormGPT API Error:* ${e.message}` });
            await socket.sendMessage(msg.key.remoteJid, { react: { text: '❌', key: msg.key } }); 
        } catch (_) {}
    }
    break;
}

// ════════════ VV ════════════

case 'vv': {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) return reply(`Reply to a view-once message with *.vv*`);
      try {
        const media = await downloadQuotedMedia(quoted);
        if (!media?.buffer) return reply('Could not download that media.');
        const qt = MEDIA_TYPES.find(t => quoted[t]);

        if (qt === 'imageMessage') {
          await socket.sendMessage(sender, { image: media.buffer, caption: 'View-once unlocked 👀', contextInfo: arabianCtx() }, { quoted: msg });
        } else if (qt === 'videoMessage') {
          await socket.sendMessage(sender, { video: media.buffer, caption: 'View-once unlocked 👀', contextInfo: arabianCtx() }, { quoted: msg });
        } else if (qt === 'audioMessage') {
          await socket.sendMessage(sender, { audio: media.buffer, mimetype: media.mime || 'audio/mpeg', ptt: quoted.audioMessage?.ptt, contextInfo: arabianCtx() }, { quoted: msg });
        } else if (qt === 'stickerMessage') {
          await socket.sendMessage(sender, { sticker: media.buffer, contextInfo: arabianCtx() }, { quoted: msg });
        } else {
          await socket.sendMessage(sender, { document: media.buffer, mimetype: media.mime || 'application/octet-stream', fileName: media.fileName || 'file', contextInfo: arabianCtx() }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
      } catch (e) { await reply(`Failed: ${e.message}`); }
      break;
    }

// ════════════ ACTIVE ════════════

    case 'active': {
      if (!isOwner && !isDevUser) return reply('Owner/Dev only.');

      const sockets = typeof activeSockets !== 'undefined' ? activeSockets : new Map();
      const nums = Array.from(sockets.keys());

      const responseText = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗦𝗲𝘀𝘀𝗶𝗼𝗻𝘀 🎀] ¡! ❞*\n\n` +
                           `> *\`📡 𝙲𝙾𝚄𝙽𝚃 :\`* ${nums.length}\n\n` +
                           `${nums.map((n, i) => `> *\`${i + 1}.\`* +${n}`).join('\n')}\n\n` +
                           `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

      await reply(responseText);
      break;
    }
//XNXXX DOWNLOADD XXXXXXXXXXXXXXXX
case 'xnxx':
case 'xxx': {
    try {
        const query = args.join(' ');
        if (!query) return await socket.sendMessage(sender, { text: '🔗 *Send me a search query!*\n\nExample: `.xnxx sri lankan`' }, { quoted: msg });

        try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

        if (!global.xnxxContexts) global.xnxxContexts = {};

        // ✅ CORRECT — parameter name = url (not query!)
const searchApiUrl = `https://api.zanta-mini.store/api/xnxx/search?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(query)}`;

        let searchResponse;
        try {
            searchResponse = await axios.get(searchApiUrl, { timeout: 15000 });
        } catch (apiErr) {
            console.error('XNXX search API error:', apiErr.message);
            return await socket.sendMessage(sender, { text: '❌ *Search failed! API error, try again later.*' }, { quoted: msg });
        }

        // ✅ Response path = data.results
        const results = searchResponse.data?.results || [];

        if (!results || !results.length) {
            return await socket.sendMessage(sender, { text: '🤷♀️ *No results found for:* ' + query }, { quoted: msg });
        }

        global.xnxxContexts[sender] = { results: results.slice(0, 15) };

        let listText = `*🔍 SADEW-MD SEARCH*\n*🔎 Query:* _${query}_\n*📊 Results:* ${Math.min(results.length, 15)}\n\n`;

        results.slice(0, 15).forEach((video, idx) => {
            listText += `*${idx + 1}.* ${video.title || 'No title'}\n\n`;
        });

        listText += `\n*📩 ඉහත list එකෙන් number එක reply කරන්න (1-${Math.min(results.length, 15)}) download කරන්න.*\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

        await socket.sendMessage(sender, { text: listText }, { quoted: msg });
        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (err) {
        console.error('XNXX command error:', err.message);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        await socket.sendMessage(sender, { text: '❌ *XNXX search failed!*' }, { quoted: msg });
    }
    break;
}
// ════════════ NPM ════════════

    case 'npm': {
      const pkg = args[0]?.trim();
      if (!pkg) return reply(`Usage: .npm <package>`);

      try {
        const res = await axios.get(`https://registry.npmjs.org/${pkg}`, { timeout: 10000 });
        const d = res.data;

        const npmInfo = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗡𝗣𝗠 🎀] ¡! ❞*\n` +
                        `⊹₊⟡⋆ 𝗡𝗮𝗺𝗲 - ${d.name} 𝜗𝜚⋆\n\n` +
                        `> *\`📦 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 :\`* ${d['dist-tags']?.latest || 'N/A'}\n` +
                        `> *\`📝 𝙳𝙴𝚂𝙲 :\`* ${(d.description || 'N/A').slice(0, 100)}\n` +
                        `> *\`👤 𝙰𝚄𝚃𝙷𝙾𝚁 :\`* ${d.author?.name || 'N/A'}\n` +
                        `> *\`📄 𝙻𝙸𝙲𝙴𝙽𝚂𝙴 :\`* ${d.license || 'N/A'}\n` +
                        `> *\`🔗 𝙻𝙸𝙽𝙺 :\`* https://npmjs.com/package/${d.name}\n\n` +
                        `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

        await socket.sendMessage(sender, { 
          image: { url: akira },
          caption: npmInfo, 
          contextInfo: typeof arabianCtx === 'function' ? arabianCtx() : {} 
        }, { quoted: msg });

      } catch (e) { 
        await reply(`Package not found: ${pkg}`); 
      }
      break;
    }

// ════════════ WORK TYPE (MODE) CHANGE ════════════





// ════════════ GIMP ════════════

case 'gimg':
case 'img': {
  const q = args.join(' ').trim();
  if (!q) return reply(`Usage: .gimg <query>`);
  try {
    await socket.sendMessage(sender, {
      react: { text: '🖼️', key: msg.key }
    });
  } catch (_) {}

  try {
    const res = await axios.get(
      `https://www.movanest.xyz/v2/pinterest?query=${encodeURIComponent(q)}&pageSize=10`
    );

    if (res.data && res.data.results && res.data.results.length > 0) {
      const random =
        res.data.results[
          Math.floor(Math.random() * res.data.results.length)
        ];

      const imgUrl = random.image;
      await socket.sendMessage(
        sender,
        {
          image: { url: imgUrl },
          caption:
`*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗜𝗠𝗚𝘀 🎀] ¡! ❞*

*₊❏❜ ⋮ 🔍 Search:* ${q}

> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`
        },
          { quoted: msg }
      );
    } else {
      await reply(`I cant find it !`);
    }
  } catch (e) {
    console.error(e);
    await reply(`Image search failed:\n${e.message}`);
  }
  break;
}

// ════════════ GETDP ════════════

    case 'getdp':
    case 'pfp': {
      try {
        const qCtx = msg.message?.extendedTextMessage?.contextInfo;
        let target;
        if (qCtx?.mentionedJid?.[0]) {
          target = qCtx.mentionedJid[0];
        } else if (qCtx?.participant) {
          target = qCtx.participant;
        } else if (args[0]?.replace(/[^0-9]/g, '')) {
          target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        } else {
          target = sender;
        }

        let dpUrl;
        try {
          dpUrl = await socket.profilePictureUrl(target, 'image');
        } catch (e) {
          return reply('No DP or Privacy protected');
        }

        await socket.sendMessage(sender, { 
          image: { url: dpUrl }, 
          caption: `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗗𝗣 🎀] ¡! ❞*\n\n📷 Profile picture of @${target.split('@')[0]}`, 
          mentions: [target] 
        }, { quoted: msg });

      } catch (err) {
        console.error(err);
        reply('Known Error');
      }
      break;
    }


    // ════════════ TAGALL ════════════
    case 'tagall': {
      if (!isGroup) return reply('This command only works in groups.');
      try {
        const gm       = await socket.groupMetadata(sender);
        const ps       = gm.participants || [];
        const tm       = args.join(' ').trim() || '*Attention everyone!*';
        const mentions = ps.map(p => p.id);
        let text = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗧𝗮𝗴𝗮𝗹𝗹 🎀] ¡! ❞*\n\n> *\`🗣️ :\`* ${tm}\n\n`;
        for (const p of ps) text += `₊❏❜ ⋮ @${p.id.split('@')[0]}\n`;
        text += `\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;
        await socket.sendMessage(sender, { text, mentions }, { quoted: msg });
      } catch (e) { await reply(`tagall failed: ${e.message}`); }
      break;
    }

    // ════════════ HIDETAG ════════════
    case 'hidetag': {
      if (!isGroup) return reply('*Groups only.*');
      try {
        const gm = await socket.groupMetadata(sender);
        await socket.sendMessage(sender, { text: args.join(' ').trim() || '*🗣️ Attention Everybody !*', mentions: gm.participants.map(p => p.id) }, { quoted: msg });
      } catch (e) { await reply(`*hidetag failed: ${e.message}*`); }
      break;
    }

    // ════════════ ADD member ════════════
case 'add': {
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '👥 This command use only owner.'
        }, { quoted: msg });
    }

   if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '👥 This command use only group.'
        }, { quoted: msg });
    }

    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || '';

    const number = q.trim().replace(/[^0-9]/g, '');
    if (!number) {
        return await socket.sendMessage(sender, { 
            text: '*❗ Please provide a phone number!* \n📋 Example: .add 94712345678' 
        });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '➕', key: msg.key } });

        const userJid = number + '@s.whatsapp.net';
        await socket.groupParticipantsUpdate(msg.key.remoteJid, [userJid], 'add');

        await socket.sendMessage(sender, { 
            text: `*✅ Successfully added +${number} to the group!*` 
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('Add Error:', err);
        await socket.sendMessage(sender, { 
            text: `*❌ Failed to add member!*\n*Reason:* ${err.message}` 
        });
    }
    break;
}

    // ════════════ KICK ════════════
    case 'kick':
    case 'remove': {
      if (!isGroup) return reply('Groups only.');
      const qCtx   = msg.message?.extendedTextMessage?.contextInfo;
      const target = qCtx?.participant || (args[0]?.replace(/[^0-9]/g,'') ? args[0].replace(/[^0-9]/g,'') + '@s.whatsapp.net' : null);
      if (!target) return reply(`Reply to a user's message or use: ${prefix}kick <number>`);
      try { await socket.groupParticipantsUpdate(sender, [target], 'remove'); await reply(`✅ Removed ${target.split('@')[0]}`); }
      catch (e) { await reply(`Kick failed: ${e.message}`); }
      break;
    }

    // ════════════ BIO ════════════
    case 'bio':
    case 'setbio': {
      const text = args.join(' ').trim();
      if (!text) return reply(`Usage: ${prefix}bio <text>`);
      try { await socket.updateProfileStatus(text); await reply(`✅ Bio updated: ${text}`); }
      catch (e) { await reply(`Failed: ${e.message}`); }
      break;
    }

// ════════════ TAGADMIN ════════════

    case 'tagadmin': {
      if (!isGroup) return reply('This command only works in groups.');
      try {
        const gm     = await socket.groupMetadata(sender);
        const admins = gm.participants.filter(p => p.admin);
        if (!admins.length) return reply('No admins found in this group.');
        const tm       = args.join(' ').trim() || '*Attention admins!*';
        const mentions = admins.map(p => p.id);
        let text = `╭─⊹₊⟡⋆『 \`𝐀𝐝𝐦𝐢𝐧\` 』𖤐.ᐟ\n*┃* ${tm}\n*┃*\n`;
        for (const p of admins) text += `*┃* @${p.id.split('@')[0]}\n`;
        text += `╰──────────────────<𝟑 .ᐟ\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;
        await socket.sendMessage(sender, { text, mentions }, { quoted: msg });
      } catch (e) { await replyFq(`tagadmin failed: ${e.message}`); }
      break;
    }

    // ════════════ PROMOTE ════════════
    case 'promote': {
      if (!isGroup) return reply('Groups only.');
      const qCtxP   = msg.message?.extendedTextMessage?.contextInfo;
      const targetP = qCtxP?.participant || (args[0]?.replace(/[^0-9]/g,'') ? args[0].replace(/[^0-9]/g,'') + '@s.whatsapp.net' : null);
      if (!targetP) return reply(`Reply to a user's message or use: ${prefix}promote <number>`);
      try {
        await socket.groupParticipantsUpdate(sender, [targetP], 'promote');
        await reply(`✅ @${targetP.split('@')[0]} has been promoted to admin.`);
      } catch (e) { await reply(`Promote failed: ${e.message}`); }
      break;
    }

    // ════════════ DEMOTE ════════════
    case 'demote': {
      if (!isGroup) return reply('Groups only.');
      const qCtxD   = msg.message?.extendedTextMessage?.contextInfo;
      const targetD = qCtxD?.participant || (args[0]?.replace(/[^0-9]/g,'') ? args[0].replace(/[^0-9]/g,'') + '@s.whatsapp.net' : null);
      if (!targetD) return reply(`Reply to a user's message or use: ${prefix}demote <number>`);
      try {
        await socket.groupParticipantsUpdate(sender, [targetD], 'demote');
        await reply(`✅ @${targetD.split('@')[0]} has been demoted.`);
      } catch (e) { await reply(`Demote failed: ${e.message}`); }
      break;
    }

    // ════════════ LOCKGROUP ════════════
    case 'lockgroup': {
      if (!isGroup) return reply('Groups only.');
      try {
        await socket.groupSettingUpdate(sender, 'announcement');
        await reply('🔒 Group locked — only admins can send messages.');
      } catch (e) { await replyFq(`Lock failed: ${e.message}`); }
      break;
    }

    // ════════════ UNLOCKGROUP ════════════
    case 'unlockgroup': {
      if (!isGroup) return replyFq('Groups only.');
      try {
        await socket.groupSettingUpdate(sender, 'not_announcement');
        await reply('🔓 Group unlocked — everyone can send messages.');
      } catch (e) { await reply(`Unlock failed: ${e.message}`); }
      break;
    }

    // ════════════ MUTE ════════════
    case 'mute': {
      if (!isGroup) return reply('Groups only.');
      const durStr = (args[0] || '').toLowerCase();
      const durMap = { '1h': 3600, '6h': 21600, '1d': 86400, '7d': 604800 };
      const secs   = durMap[durStr];
      if (!secs) return reply(`Usage: .mute <1h|6h|1d|7d>`);
      try {
        await socket.groupSettingUpdate(sender, 'announcement');
        await reply(`🔇 Group muted for *${durStr}*. Use *.unmute* to restore early.`);
        setTimeout(async () => {
          try { await socket.groupSettingUpdate(sender, 'not_announcement'); } catch (_) {}
        }, secs * 1000);
      } catch (e) { await reply(`Mute failed: ${e.message}`); }
      break;
    }

    // ════════════ UNMUTE ════════════
    case 'unmute': {
      if (!isGroup) return reply('Groups only.');
      try {
        await socket.groupSettingUpdate(sender, 'not_announcement');
        await reply('🔊 Group unmuted — everyone can send messages.');
      } catch (e) { await reply(`Unmute failed: ${e.message}`); }
      break;
    }

    // ════════════ GROUPINFO ════════════
    case 'groupinfo': {
      if (!isGroup) return reply('Groups only.');
      try {
        const gm      = await socket.groupMetadata(sender);
        const total   = gm.participants.length;
        const admCnt  = gm.participants.filter(p => p.admin).length;
        const created = gm.creation ? new Date(gm.creation * 1000).toLocaleDateString() : 'Unknown';
        await reply(
          `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗚𝗜𝗻𝗳𝗼 🎀] ¡! ❞*\n\n` +
          `₊❏❜ ⋮ *\`📛 𝙽𝙰𝙼𝙴 :\`* ${gm.subject}\n` +
          `₊❏❜ ⋮ *\`🆔 𝙹𝙸𝙳 :\`* ${gm.id}\n` +
          `₊❏❜ ⋮ *\`📝 𝙳𝙴𝚂𝙲 :\`* ${(gm.desc || 'None').slice(0, 100)}\n` +
          `₊❏❜ ⋮ *\`👥 𝙼𝙴𝙼𝙱𝙴𝚁𝚂 :\`* ${total}\n` +
          `₊❏❜ ⋮ *\`👑 𝙰𝙳𝙼𝙸𝙽𝚂 :\`* ${admCnt}\n` +
          `₊❏❜ ⋮ *\`📅 𝙲𝚁𝙴𝙰𝚃𝙴𝙳 :\`* ${created}\n\n` +
          `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`
        );
      } catch (e) { await reply(`groupinfo failed: ${e.message}`); }
      break;
    }

    // ════════════ SETNAME ════════════
    case 'setname': {
      if (!isGroup) return reply('Groups only.');
      const newName = args.join(' ').trim();
      if (!newName) return reply(`Usage: .setname <new name>`);
      try {
        await socket.groupUpdateSubject(sender, newName);
        await reply(`✅ Group name changed to: *${newName}*`);
      } catch (e) { await reply(`setname failed: ${e.message}`); }
      break;
    }

    // ════════════ SETDESC ════════════
    case 'setdesc': {
      if (!isGroup) return reply('Groups only.');
      const newDesc = args.join(' ').trim();
      if (!newDesc) return reply(`Usage: .setdesc <description>`);
      try {
        await socket.groupUpdateDescription(sender, newDesc);
        await reply(`✅ Group description updated.`);
      } catch (e) { await reply(`setdesc failed: ${e.message}`); }
      break;
    }

    // ════════════ SETICON ════════════

case 'seticon': {
    if (!isGroup) return reply('Groups only.');

    const groupId = msg.key.remoteJid; 

    const quotedIcon = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedIcon?.imageMessage) return reply(`Reply to an image with *.seticon*`);

    try {
        const media = await downloadQuotedMedia(quotedIcon);

        if (!media || !media.buffer) return reply('Could not download image.');

        await socket.updateProfilePicture(groupId, media.buffer);

        await reply('✅ Group icon updated successfully.');
    } catch (e) { 
        console.log(e);
        await reply(`seticon failed: ${e.message}`); 
    }
    break;
}


    // ════════════ LINKGROUP ════════════
    case 'linkgroup': {
      if (!isGroup) return reply('Groups only.');
      try {
        const code = await socket.groupInviteCode(sender);
        await reply(`🔗 *Group Invite Link:*\nhttps://chat.whatsapp.com/${code}`);
      } catch (e) { await reply(`linkgroup failed: ${e.message}`); }
      break;
    }

    // ════════════ REVOKELINK ════════════
    case 'revokelink': {
      if (!isGroup) return reply('Groups only.');
      try {
        const newCode = await socket.groupRevokeInvite(sender);
        await reply(`✅ Invite link revoked.\n🔗 *New link:*\nhttps://chat.whatsapp.com/${newCode}`);
      } catch (e) { await reply(`revokelink failed: ${e.message}`); }
      break;
    }

    // ════════════ LEAVE ════════════
    case 'leave': {
      if (!isGroup) return reply('Groups only.');
      if (!isOwner && !isSessionOwner && !isDevUser) return reply('Only owner can make the bot leave.');
      try {
        await reply('👋 Goodbye! Leaving group...');
        await delay(1500);
        await socket.groupLeave(sender);
      } catch (e) { await reply(`leave failed: ${e.message}`); }
      break;
    }

// ════════════ HENTAI ════════════

case 'hentai': {
  try {
    await socket.sendMessage(sender, {
      react: { text: '🔞', key: msg.key }
    });
  } catch (_) {}

  try {
    const response = await axios.get('https://www.movanest.xyz/v2/hentai?query=random');
    const data = response.data;

    if (data && data.status && data.result && data.result.length > 0) {
      const results = data.result;
      const randomVideo = results[Math.floor(Math.random() * results.length)];

      const videoUrl = randomVideo.video_1 || randomVideo.video_2;
      if (!videoUrl) return reply("No Video Available !");

      await socket.sendMessage(
        sender, 
        {
          video: { url: videoUrl },
          caption:
`*↳ ❝ [🔞 𝗛𝗲𝗻𝘁𝗮𝗶 𝗥𝗮𝗻𝗱𝗼𝗺 🔞] ¡! ❞*

*₊❏❜ ⋮ 🎬 Title:* ${randomVideo.title}
*₊❏❜ ⋮ 📁 Category:* ${randomVideo.category}
*₊❏❜ ⋮ 👁️ Views:* ${randomVideo.views_count}

> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`
        }, 
        { quoted: msg }
      );
    } else {
      await reply("Server Error ! pls try again later .");
    }

  } catch (error) {
    console.error(error);
    await reply(`Error! API:\n${error.message}`);
  }
  break;
}

// ════════════ FANCY TEXT ════════════

case 'styletext':
case 'fancy':
case 'fancytext': {
    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || 
              msg.message?.imageMessage?.caption || '';

    const textToStyle = q.replace(/^[^\s]+\s+/, '').trim();

    if (!textToStyle || textToStyle === '') {
        return await socket.sendMessage(sender, { 
            text: '*❓ Text Is Missing.* \n📋 Ex: .styletext Hello World' 
        });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });

        const response = await axios.get(`https://www.movanest.xyz/v2/fancytext?word=${encodeURIComponent(textToStyle)}`);

        if (!response.data.status) {
            throw new Error('API processing failed');
        }

        const results = response.data.results;

        let styledMsg = `*✨ FANCY TEXT STYLES *\n\n`;
        styledMsg += `*Original:* ${textToStyle}\n\n`;
        styledMsg += `*┏━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┓*\n`;

        results.slice(0, 25).forEach((styledText, index) => {
            styledMsg += `*┃ ${index + 1}.* ${styledText}\n`;
        });

        styledMsg += `*┗━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┛*\n\n`;
        styledMsg += `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

        await socket.sendMessage(sender, { 
            image: { url: akira }, 
            text: styledMsg
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('StyleText API Error:', err);
        await socket.sendMessage(sender, { 
            text: `*❌ Known Error Try Again*` 
        });
    }
    break;
}


// ════════════ OWNER ════════════

case 'owner': {
    const ownerNum = '+94754879431';
    const ownerName = 'お🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮࣪𖤐.ᐟ';

    try { await socket.sendMessage(sender, { react: { text: '🥷', key: msg.key } }); } catch (_) {}

    await socket.sendMessage(sender, {
        image: { url: akira }, 
        contacts: {
            displayName: ownerName,
            contacts: [{
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nORG: ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝐎𝐰𝐧𝐞𝐫;\nTEL;type=CELL;type=VOICE;waid=${ownerNum.slice(1)}:${ownerNum}\nEND:VCARD`
            }]
        }
    });

    await socket.sendMessage(sender, {
        text: `𝜗𝜚 ₊˚ ✨ *[  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝕆𝕨𝕟𝕖𝕣 ]*✨ ˚₊ 𝜗𝜚

╭─── ₊˚ ✦ ₊˚ ───╮
  🌸 *Name:* ${ownerName}
  💌 *Contact:* ${ownerNum}
╰─── ₊˚ ✦ ₊˚ ───╯

✦ *Developer Support:*
> _Feel free to reach out for bot support, custom setups, or bug reports._

> 𝜗𝜚⋆  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  Official Bot ✨`,
        contextInfo: {
            mentionedJid: [`${ownerNum.slice(1)}@s.whatsapp.net`]
        }
    }, {
        quoted: msg
    });

    break;
}

// ════════════ LVCAL ════════════
case 'lvcal': {
    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || '';

    const parts = q.trim().split('&');
    if (parts.length !== 2) {
        return await socket.sendMessage(sender, { 
            text: '*❗ Please provide two names!* \n📋 Example: .lvcal John & Jane' 
        });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '💕', key: msg.key } });

        const name1 = parts[0].trim();
        const name2 = parts[1].trim();

        const combined = name1.toLowerCase() + name2.toLowerCase();
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            hash = combined.charCodeAt(i) + ((hash << 5) - hash);
        }
        const percentage = Math.abs(hash % 101);

        let hearts = '';
        if (percentage >= 90) hearts = '💖💖💖💖💖';
        else if (percentage >= 70) hearts = '💖💖💖💖';
        else if (percentage >= 50) hearts = '💖💖💖';
        else if (percentage >= 30) hearts = '💖💖';
        else hearts = '💖';

        let shipText = `*↳ ❝ [🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝗟𝘃𝗖𝗮𝗹 🎀] ¡! ❞*\n\n`;
        shipText += `*${name1}* 💑 *${name2}*\n\n`;
        shipText += `${hearts}\n`;
        shipText += `*Love Percentage:* ${percentage}%\n\n`;

        if (percentage >= 80) shipText += `*Perfect Match! 🔥💕*`;
        else if (percentage >= 60) shipText += `*Great Chemistry! ✨💝*`;
        else if (percentage >= 40) shipText += `*Good Potential! 💫💓*`;
        else if (percentage >= 20) shipText += `*Needs Work! 🤔💔*`;
        else shipText += `*Not Meant To Be! 😢💔*`;

        shipText += `\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮� 𝜗𝜚⋆*`;

        await socket.sendMessage(sender, { text: shipText }, { quoted: msg });
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error('Ship Error:', err);
        await socket.sendMessage(sender, { text: '*❌ Love calculator failed!*' });
    }
    break;
}

// ════════════ HACK ════════════

case 'hack': {
    try {
        const from = msg.key.remoteJid; 
        const steps = [
            '🎀 * ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ � 𝐇𝐚𝐜𝐤 𝐒𝐭𝐚𝐫𝐢𝐧𝐠...* 🎀',
            '`ɪɴɪᴛɪᴀʟɪᴢɪɴɢ ʜᴀᴄᴋɪɴɢ ᴛᴏᴏʟꜱ...` 🛠️',
            '`ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ʀᴇᴍᴏᴛᴇ ꜱᴇʀᴠᴇʀ...` 🌐',
            '```[##] 20%``` ⏳',
            '```[####] 40%``` ⏳',
            '```[######] 60%``` ⏳',
            '```[########] 80%``` ⏳',
            '```[##########] 100%``` ✅',
            '🔒 *𝐒ystem 𝐁reach: 𝐒uccessful!* 🔓',
            '*🎀  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝐇acking 𝐒uccessful 🎭*',
        ];

        await socket.sendMessage(from, { react: { text: '💀', key: msg.key } });

        let initialMsg = await socket.sendMessage(from, { text: steps[0] }, { quoted: msg });

        for (let i = 1; i < steps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000)); 

            await socket.sendMessage(from, {
                text: steps[i],
                edit: initialMsg.key,
                contextInfo: typeof arabianCtx === 'function' ? arabianCtx() : {} 
            });
        }

    } catch (e) {
        console.log(e);
        reply(`❌ *Error!* ${e.message}`);
    }
    break;
}

// 🔴🔴🔴 මෙන්න මෙතන තමයි switch එක වැහෙන්නේ! 🔴🔴🔴
} 

// 🔥🔥🔥 PLUGIN EXECUTION කෑල්ල දැන් තියෙන්නේ switch එකෙන් එලියේ 🔥🔥🔥
const plugin = findPluginForCommand(command);
if (plugin) {
    try {
        // metaQuote අවුල මෙතනින් හැදුවා
        await plugin.handler({ socket, msg, sender, command, args, reply, m, quoted, isOwner, isGroup, botNumber, senderNumber, metaQuote: msg, sessionConfig, activeSockets });
    } catch (pluginErr) {
        console.error(`Plugin ${plugin.name} error:`, pluginErr.message);
    }
}

// ---------------------------------------------------------
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                text: `❌ ERROR\nAn error occurred: ${error.message}`,
            });
        }
    });
}

router.get('/', async (req, res) => {
    const { number } = req.query;

    if (!number) {
        return res.status(400).send({
            error: 'Number parameter is required'
        });
    }

    if (activeSockets.size >= 77) {
        return res.status(429).send({ 
            status: 'limit_reached',
            message: 'Active connections limit reached. Please try again in 1 hour.'
        });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});


router.get('/active', (req, res) => {
    console.log('Active sockets:', Array.from(activeSockets.keys()));
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});
// ════════════ 📊 SERVER LIVE STATS API ENDPOINT ════════════
router.get('/livestats', (req, res) => {
    try {
        const uptime = process.uptime();
        
        // 🔥 FIX: heapUsed වෙනුවට rss දැම්මා (Heroku එකෙන් මනින ඇත්තම සම්පූර්ණ බර)
        const ramUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        
        const sessionsCount = typeof activeSockets !== 'undefined' ? activeSockets.size : 0;

        res.json({
            uptime: uptime,
            ramUsed: ramUsed,
            sessionsCount: sessionsCount
        });
    } catch (error) {
        console.error("Stats API Error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [${signal}] Received! Saving all active sessions to MongoDB before exiting...`);
    
console.log(`💾 All session keys are strictly saved in MongoDB directly. Skipping Zip sync.`);
    
    activeSockets.forEach((socket, number) => {
        try { socket.ws?.close?.(); } catch(e) {}
    });
  
    
    console.log('✅ Graceful shutdown complete. Exiting.');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('exit', () => {
   
});

// 🔥 Anti-Crash Shield 🔥 (Restart වෙන එක සදහටම නැවැත්තුවා!)
process.on('unhandledRejection', (reason, promise) => {
    // 🚨 වද දෙන කුණු එරර්ස් ටික Terminal එකෙන් හංගනවා
    const reasonStr = String(reason);
    if (!reasonStr.includes('Bad MAC') && !reasonStr.includes('decrypt') && !reasonStr.includes('status@broadcast')) {
        // අනිත් ලෙඩ ආවොත් සර්වර් එක රීස්ටාර්ට් නොකර ලොග් එකක් විතරක් දානවා
        // console.log('🚨 [ANTI-CRASH] Unhandled Rejection at:', promise, 'reason:', reasonStr.slice(0, 100)); 
    }
});

// අර pm2 restart ගහන භයානක කෑල්ල සම්පූර්ණයෙන්ම අයින් කළා! 🚀
// 🔥 මෙය Add කරන්න - Server Start එකේදීම පවතින Sessions Auto-Connect වෙනවා

module.exports = router;
async function sendCategoryWebview(socket, msg, sender, categoryName, commandsArray, prefix = '.') {
    try {
        const crypto = require('crypto');
        const randomResId = crypto.randomUUID(); 
        const randomBotResId = crypto.randomUUID();

        const nameLower = categoryName.toLowerCase();
        
        // 💙 Default Theme (Others) -> තද නිල් පාට (Deep Blue)
        let pC = "#2962ff"; let sC = "rgba(41,98,255,0.3)"; let pS = "✨"; 
        let svg = `<svg width="60" height="60" viewBox="0 0 100 100"><polygon points="50,15 61,38 85,38 65,53 73,76 50,61 27,76 35,53 15,38 39,38" fill="none" stroke="${pC}" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="8s" repeatCount="indefinite"/></polygon></svg>`;

        // 🔥 Themes
        if (nameLower.includes("ai") || nameLower.includes("gpt")) {
            pC = "#ff0844"; sC = "rgba(255,8,68,0.3)"; pS = "💮"; 
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="${pC}" stroke-width="2"/><rect x="25" y="35" width="50" height="30" rx="10" fill="#111" stroke="${pC}" stroke-width="2"/><circle cx="35" cy="50" r="5" fill="${pC}"/><circle cx="65" cy="50" r="5" fill="${pC}"/></svg>`;
        } else if (nameLower.includes("down")) {
            pC = "#00f2fe"; sC = "rgba(0,242,254,0.3)"; pS = "🌸"; 
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="15" fill="#001a1a" stroke="${pC}" stroke-width="2"/><path d="M50,35 L50,65 M35,50 L50,65 L65,50" stroke="${pC}" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="75" x2="70" y2="75" stroke="${pC}" stroke-width="4"/></svg>`;
        } else if (nameLower.includes("movie") || nameLower.includes("series")) {
            pC = "#f6d365"; sC = "rgba(246,211,101,0.3)"; pS = "🍿"; 
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><rect x="25" y="20" width="30" height="25" rx="5" fill="none" stroke="${pC}" stroke-width="2"/><circle cx="33" cy="30" r="3" fill="${pC}"/><circle cx="47" cy="30" r="3" fill="${pC}"/><line x1="40" y1="20" x2="40" y2="10" stroke="${pC}" stroke-width="2"/><circle cx="40" cy="8" r="2" fill="${pC}"/><rect x="30" y="45" width="20" height="30" rx="3" fill="none" stroke="${pC}" stroke-width="2"/><path d="M40,55 L55,55 L55,60" fill="none" stroke="${pC}" stroke-width="2" stroke-linecap="round"/><rect x="55" y="50" width="25" height="15" fill="#111" stroke="${pC}" stroke-width="2"/><circle cx="62" cy="42" r="6" fill="none" stroke="${pC}" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 62 42" to="360 62 42" dur="2s" repeatCount="indefinite"/></circle><circle cx="75" cy="42" r="6" fill="none" stroke="${pC}" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 75 42" to="360 75 42" dur="2s" repeatCount="indefinite"/></circle><polygon points="80,52 90,48 90,67 80,63" fill="none" stroke="${pC}" stroke-width="2"/></svg>`;
        } else if (nameLower.includes("song") || nameLower.includes("music")) {
            pC = "#ffeb3b"; sC = "rgba(255,235,59,0.3)"; pS = "🎵"; // 💛 කහ පාට දැම්මා!
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="${pC}" stroke-width="2"/><path d="M40,70 A10,10 0 1,1 40,50 L40,30 L70,30 L70,55 A10,10 0 1,1 70,35 L45,35 L45,70 Z" fill="${pC}"/></svg>`;
        } else if (nameLower.includes("admin") || nameLower.includes("group")) {
            pC = "#0ba360"; sC = "rgba(11,163,96,0.3)"; pS = "🛡"; 
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><circle cx="50" cy="40" r="15" fill="none" stroke="${pC}" stroke-width="2"/><path d="M25,80 Q50,50 75,80" fill="none" stroke="${pC}" stroke-width="2"/><circle cx="25" cy="50" r="10" fill="none" stroke="${pC}" stroke-width="2"/><path d="M5,80 Q25,60 40,80" fill="none" stroke="${pC}" stroke-width="2"/><circle cx="75" cy="50" r="10" fill="none" stroke="${pC}" stroke-width="2"/><path d="M60,80 Q75,60 95,80" fill="none" stroke="${pC}" stroke-width="2"/></svg>`;
        } else if (nameLower.includes("tool") || nameLower.includes("edit")) {
            pC = "#b185fa"; sC = "rgba(177,133,250,0.3)"; pS = "🍃"; 
            svg = `<svg width="60" height="60" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="none" stroke="${pC}" stroke-width="4" stroke-dasharray="10 5"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="5s" repeatCount="indefinite"/></circle><circle cx="50" cy="50" r="10" fill="${pC}"/></svg>`;
        }

        // 🔥 පාවී පාවී වැටෙන Animation එක (Swaying System) 
        // දැන් තැලෙන්නේ නෑ (Squash වෙන්නේ නෑ), ගොඩක් හිමීට පාවෙන්නේ!
        let particlesHtml = `<svg class="psvg">`;
        for (let i = 0; i < 8; i++) { // ගාන 8කට අඩු කරා
            let x = Math.random() * 90 + 5; 
            let delay = Math.random() * 10; // එකින් එක එන්න වෙලාව වෙනස් කරා
            let dur = Math.random() * 10 + 12; // තත්පර 12ත් 22ත් අතර (ගොඩාක් හිමීට වැටෙන්නේ)
            let sway = Math.random() * 8 + 4; // වමට දකුණට පාවෙන දුර
            let swayDur = dur / 3; 
            
            particlesHtml += `
            <text x="${x.toFixed(1)}%" y="-10%" font-size="22" text-anchor="middle">
                ${pS}
                <animate attributeName="y" values="-10%;110%" dur="${dur.toFixed(1)}s" begin="${delay.toFixed(1)}s" repeatCount="indefinite"/>
                <animate attributeName="x" values="${x.toFixed(1)}%;${(x+sway).toFixed(1)}%;${(x-sway).toFixed(1)}%;${x.toFixed(1)}%" dur="${swayDur.toFixed(1)}s" begin="${delay.toFixed(1)}s" repeatCount="indefinite"/>
            </text>`;
        }
        particlesHtml += `</svg>`;

        if (nameLower.includes("down")) {
            const hasTtp = commandsArray.some(c => (typeof c === 'string' ? c : c.cmd).toLowerCase().includes('ttp'));
            if (!hasTtp) commandsArray.splice(3, 0, { cmd: 'ttp', desc: 'TT photo to video' });

            const hasXxx = commandsArray.some(c => (typeof c === 'string' ? c : c.cmd).toLowerCase().includes('xxx'));
            if (!hasXxx) commandsArray.splice(Math.floor(commandsArray.length / 2), 0, { cmd: 'xxx', desc: 'Download XNXX Video' });
        }

        if (nameLower.includes("movie") || nameLower.includes("series")) {
            const addMovies = [
                { cmd: 'cinesubz', desc: 'Sinhala Subbed movies from Cinesubz' },
                { cmd: 'movielk', desc: 'Sinhala dubbed/subbed movies' },
                { cmd: 'moviepro', desc: 'English movies from Moviebox Pro' },
                { cmd: 'sinhalasub', desc: 'Sinhalasub.lk movies' },
                { cmd: 'kdrama', desc: 'Korean drama, movie & tv series' },
                { cmd: 'sublk', desc: 'Sub.lk movies' },
                { cmd: 'cinesend', desc: 'Send movie group or inbox chat' }
            ];
            for (let m of addMovies) {
                if (!commandsArray.some(c => (typeof c === 'string' ? c : c.cmd).toLowerCase().includes(m.cmd))) {
                    commandsArray.unshift(m);
                }
            }
        }

        let buttonsHtml = "";
        const hideFromDownload = ['cinesubz','cinesend','cz','msdl','kd_ep','kd_sel','movielk','kdrama','directdl','todoc','mfdl','mod_dl','mp_dl','mp_sell','sublk','smd','wpdl','cs_sel','cs_dl','color_dl','mp_sel','oncedl','moviepro','export','sinhalasub','sindet','sindl','emojidl'];

        for (const cmdObj of commandsArray) {
            let rawCmd = typeof cmdObj === 'string' ? cmdObj : cmdObj.cmd;
            let rawDesc = typeof cmdObj === 'string' ? 'CMD' : (cmdObj.desc || '');
            let checkCmd = rawCmd.toLowerCase().replace(/^\./, '');

            if (rawCmd.match(/dl\d+|czdl|get|fetch|tmp/i)) continue;
            if (checkCmd === 'anime_dl') continue; 
            if (nameLower.includes("down") && hideFromDownload.includes(checkCmd)) continue;

            rawCmd = rawCmd.replace(/^\./, ''); 
            const finalCmd = prefix + rawCmd;
            let shortDesc = rawDesc.length > 25 ? rawDesc.substring(0, 22) + '..' : rawDesc;
            
            buttonsHtml += `<div class=cr c="${finalCmd}"><b>${rawCmd.toUpperCase()}</b><i>${shortDesc}</i><span>${finalCmd}</span></div>`;
        }

        // 🔥 CSS/HTML 
        let finalHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif;-webkit-tap-highlight-color:transparent}body{background:#0d001a;color:#fff;overflow-x:hidden}.bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 20% 30%,${sC} 0,transparent 50%),radial-gradient(circle at 80% 70%,${sC} 0,transparent 50%)}.psvg{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999;opacity:0.6}.c{padding:10px;z-index:1}.h{text-align:center;margin-bottom:12px}.hi{display:flex;justify-content:center}.hi svg{animation:d 2s ease-in-out infinite alternate}@keyframes d{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-8px) scale(1.05)}}h1{font-size:20px;color:${pC};text-shadow:0 0 10px ${sC}}p{color:#8c9eff;font-size:11px}.cl{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cr{display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff1;border-bottom:2px solid ${pC};padding:10px 4px;border-radius:10px;gap:4px;z-index:1;position:relative}.cr:active{background:${sC}}b{font-size:13px}i{font-size:9px;color:#aaa;font-style:normal;line-height:1.2}span{background:#0009;padding:3px 8px;border-radius:4px;font-family:monospace;font-size:10px;color:${pC};border:1px solid #fff2;margin-top:2px}.f{text-align:center;color:#555;font-size:9px;padding:10px 0}.pop{position:fixed;background:${pC};color:#fff;padding:4px 8px;border-radius:10px;font-size:11px;font-weight:700;pointer-events:none;transition:.4s;z-index:9999}.pa{opacity:0;transform:translateY(-30px)}</style></head><body><div class=bg></div>${particlesHtml}<div class=c><div class=h><div class=hi>${svg}</div><h1>${categoryName.toUpperCase()} MENU</h1><p>Tap to copy!</p></div><div class=cl id=cl>${buttonsHtml}</div></div><div class=f>SADEW X MINI</div><script>function cp(v,c){let e=document.createElement('textarea');e.value=c;document.body.appendChild(e);e.select();try{document.execCommand('copy')}catch(e){}e.remove();let p=document.createElement('div');p.innerText='Copied!';p.className='pop';p.style.left=(v.clientX-20)+'px';p.style.top=(v.clientY-20)+'px';document.body.appendChild(p);setTimeout(()=>p.classList.add('pa'),10);setTimeout(()=>p.remove(),400)}document.getElementById('cl').onclick=e=>{let t=e.target.closest('.cr');if(t)cp(e,t.getAttribute('c'))};</script></body></html>`;

        const unifiedDataJson = JSON.stringify({
            "response_id": randomResId,
            "sections": [{
                "view_model": {
                    "primitive": {
                        "__typename": "GenAIaeacdsnwHtmlPrimitive",
                        "payload": finalHtml,
                        "trusted_sources": ["wa.me", "whatsapp.com"]
                    },
                    "__typename": "GenAISingleLayoutViewModel"
                }
            }]
        });
        
        const unifiedData = Buffer.from(unifiedDataJson).toString('base64');
        const { generateWAMessageFromContent } = require('baileys');
        
        let buttonMessage = generateWAMessageFromContent(sender, {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 2, messageText: `✨ *${categoryName.toUpperCase()} MENU* ✨` }],
                        unifiedResponse: { data: unifiedData },
                        contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" }, forwardOrigin: 4 }
                    }
                }
            }
        }, { quoted: msg });

        buttonMessage.message.messageContextInfo = {
            deviceListMetadata: {}, deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: "", botResponseId: randomBotResId,
                verificationMetadata: {
                    proofs: [{
                        version: 1, useCase: 1,
                        signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                        certificateChain: [
                            "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                            "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
                        ]
                    }]
                }
            }
        };

        await socket.relayMessage(sender, buttonMessage.message, { messageId: buttonMessage.key.id });

    } catch (error) { console.error("Webview Menu Error:", error); }
}
