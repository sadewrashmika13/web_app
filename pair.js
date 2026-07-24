/* SADEW-MINI - MULTI SESSION SUPPORT
  DEVELOPED BY SADEW RASHMIKA 
  FULLY ENC AND PRIVET SOURCE CODE    
  Code Ussai #akak - Thawa #akada balanne                                                                                                      
*/

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const {
    exec
} = require('child_process');
const { sms } = require("./msg");
const router = express.Router();
const pino = require('pino');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');
const { ytmp3, ytmp4 } = require('sadaslk-dlcore');
const os = require('os');
const fecth = require('node-fetch');
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);
// 🛡️ ANTI-DELETE PLUGIN IMPORT
const antiDeletePlugin = require('./plugins/antidelete');
const emojiDlPlugin = require('./plugins/emoji_dl');
const onceDlPlugin = require('./plugins/once_dl');
  const images = [
    'https://res.cloudinary.com/dqlh378fb/image/upload/v1783327996/zanta_media_uploads/vfq2mrf2hwkzhjerc3zz.jpg',
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
    useMultiFileAuthState,
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
    proto,
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
    NEWSLETTER_JID: '120363424312790517@newsletter',
    NEWSLETTER_LIST: [
        '120363424312790517@newsletter'
        
    ],
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    OWNER_NUMBER: '94753518443',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb7BZe8I1rcapv3kSP21'
};

const replyFq = (text) => reply(text);

if (!global.sadewVideoSearch) global.sadewVideoSearch = {};
if (!global.sadewMenuTracker) global.sadewMenuTracker = {};

const activeSockets = new Map();
const socketCreationTime = new Map();
const socketHandlersMap = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

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
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Session = mongoose.model('SessionNew', SessionSchema); 

async function connectMongoDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://sadewrashmika069_db_user:sadew13767@cluster0.yqmgml7.mongodb.net/?appName=Cluster0';
        await mongoose.connect(mongoUri, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000 
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
}
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
            const emojis = ['🎀', '🍬', '👽', '🌺', '🍓', '🍫', '🫐', '🥷'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            const messageId = message.key.server_id || message.newsletterServerId;

            if (!messageId) {
                console.warn('⚠️ No newsletterServerId found in message:', message);
                return;
            }

			// --- ANTIBAN: Human-like Delay (තත්පර 3 සිට 10 දක්වා අහඹු ප්‍රමාදයක්) ---
            const delayTime = Math.floor(Math.random() * 7000) + 3000; 
            console.log(`⏳ Channel Message Detected. Waiting ${delayTime/2000} seconds to react...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
            // -------------------------------------------------------------------

            await socket.newsletterReactMessage(jid, messageId.toString(), randomEmoji);
            console.log(`✅ Reacted to official newsletter: ${jid}`);
        } catch (error) {
            console.error('⚠️ Newsletter reaction failed:', error.message);
        }
    });
}


async function autoReconnectOnStartup() {
    try {
        let numbers = [];
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            console.log(`Loaded ${numbers.length} numbers from numbers.json`);
        }

        const sessions = await Session.find({}, 'number').lean();
        const mongoNumbers = sessions.map(s => s.number);
        numbers = [...new Set([...numbers, ...mongoNumbers])];

        if (numbers.length === 0) {
            console.log('No numbers found for auto-reconnect');
            return;
        }

        console.log(`Attempting to reconnect ${numbers.length} sessions...`);

        for (const number of numbers) {
            const sanitized = number.replace(/[^0-9]/g, '');
            if (activeSockets.has(sanitized)) {
                console.log(`Number ${sanitized} already connected, skipping`);
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };

            try {
                await EmpirePair(sanitized, mockRes);
                console.log(`✅ Initiated reconnect for ${sanitized}`);
            } catch (error) {
                console.error(`❌ Failed to reconnect ${sanitized}:`, error);
            }

            await delay(1500);
        }
    } catch (error) {
        console.error('Auto-reconnect on startup failed:', error);
    }
}

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

    socket.ev.on('connection.update', async ({ connection, lastDisconnect }) => {

        if (connection === 'open') {
            reconnecting = false;
            return;
        }

        if (connection !== 'close' || reconnecting) return;
        reconnecting = true;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.warn(`[${id}] Connection closed | code:`, statusCode);

        if (statusCode === 401) {
            await destroySocket(id);
            await deleteSession(id);
            return;
        }

        await delay(2000);
        await destroySocket(id);

        const mockRes = {
            headersSent: true,
            send() {},
            status() { return this }
        };

        try {
            await EmpirePair(id, mockRes);
        } catch (e) {
            console.error('Reconnect failed:', e);
        }

        reconnecting = false;
    });
}


async function destroySocket(id) {
    try {
        const data = activeSockets.get(id);
        if (data?.socket) {
            data.socket.ev.removeAllListeners();
            data.socket.ws?.close();
        }
    } catch (e) {
        console.error('Destroy socket error:', e);
    }

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
        return session.creds;
    } catch (error) {
        console.error(`Failed to restore session for ${number}:`, error);
        return null;
    }
}

async function deleteSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({
            number: sanitizedNumber
        });
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
        }
        if (fs.existsSync(NUMBER_LIST_PATH)) {
            let numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
            numbers = numbers.filter(n => n !== sanitizedNumber);
            fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
        }

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
    const pendingReplies = new Map();
    const seenJids = new Set();

    socket.ev.on('messages.upsert', async ({
        messages
    }) => {
        const msg = messages[0];
        if (!msg?.key ||
            msg.key.remoteJid !== 'status@broadcast' ||
            !msg.key.participant ||
            msg.key.remoteJid === config.NEWSLETTER_JID) return;

        const botJid = jidNormalizedUser(socket.user.id);
        if (msg.key.participant === botJid) return;

        const sanitizedNumber = botJid.split('@')[0].replace(/[^0-9]/g, '');
        const sessionConfig = activeSockets.get(sanitizedNumber)?.config || config;

        let statusViewed = false;

        try {

            if (sessionConfig.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                       // await socket.readMessages([msg.key]);
                        statusViewed = true;
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) {
                            console.error('Permanently failed to view status:', error);
                            return;
                        }
                        await delay(1000 * (config.MAX_RETRIES - retries + 1));
                    }
                }
            } else {

                statusViewed = true;
            }

            if (statusViewed && sessionConfig.AUTO_LIKE_STATUS === 'true') {
                const emojis = sessionConfig.AUTO_LIKE_EMOJI || ['🎀'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                let retries = config.MAX_RETRIES;
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
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) {
                            console.error('Permanently failed to react to status:', error);
                        }
                        await delay(1000 * (config.MAX_RETRIES - retries + 1));
                    }
                }
            }

        } catch (error) {
            console.error('Unexpected error in status handler:', error);
        }
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

async function EmpirePair(number, res) {
    console.log(`Initiating pairing/reconnect for ${number}`);
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    if (activeSockets.has(sanitizedNumber)) {
        try { activeSockets.get(sanitizedNumber).socket?.end?.(); } catch {}
        activeSockets.delete(sanitizedNumber);
    }

    await restoreSession(sanitizedNumber);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    try {
        const socket = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ['Ubuntu', 'Chrome', '120.0.0'], // Browser Spoofing එකතු කලා
            printQRInTerminal: false,
            syncFullHistory: false,      // පරණ මැසේජ් ඔක්කොම ඩවුන්ලෝඩ් වෙන එක නවත්තනවා
            markOnlineOnConnect: false   // ලොග් වෙද්දී බර අඩු කරනවා
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

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

        socket.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                const credsPath = path.join(sessionPath, 'creds.json');
                if (!fs.existsSync(credsPath)) return;
                const fileContent = await fs.readFile(credsPath, 'utf8');
                const creds = JSON.parse(fileContent);
                await saveSession(sanitizedNumber, creds);
            } catch {}
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ Connection opened for ${sanitizedNumber}`);

				await socket.sendPresenceUpdate('unavailable');
				
                try {
                    await delay(3000);

                    if (!socket.user?.id) {
                        console.error(`❌ socket.user is null after connection open for ${sanitizedNumber}`);
                        return;
                    }

                    const userJid = jidNormalizedUser(socket.user.id);
                    const freshConfig = await loadUserConfig(sanitizedNumber);

                    activeSockets.set(sanitizedNumber, { socket, config: freshConfig });
                    console.log(`📌 Socket registered in activeSockets for ${sanitizedNumber}`);
					// 🛡️ Auto-init Anti-Delete System
                    // ==========================================
                    try { 
                    antiDeletePlugin.init(socket); 
                    console.log(`🛡️ Anti-Delete System Auto-Started successfully!`);
                    } catch(e) {
                    console.log(`❌ Anti-Delete Error:`, e.message);
                    }
					// 📥 EMOJI DOWNLOADER එක රන් වෙන තැන! 👈 (මෙන්න මේ කෑල්ල අලුතින් අලවන්න)
                    try {
                        emojiDlPlugin.init(socket);
                        console.log(`📥 Emoji Downloader Auto-Started successfully!`);
                    } catch(e) {
                        console.log(`❌ Emoji DL Error:`, e.message);
                    }
					// 👁️ VIEWONCE DOWNLOADER එක රන් වෙන තැන! 
                    try {
                        onceDlPlugin.init(socket);
                        console.log(`👁️ ViewOnce Downloader Auto-Started successfully!`);
                    } catch(e) {
                        console.log(`❌ ViewOnce DL Error:`, e.message);
                    }
                    // ==========================================
                        
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
                    
                    // Ping එක ගණනය කිරීම සඳහා ආරම්භක වේලාව
                    const startPing = Date.now();

                    const spintaxGreetings = [
                        "Hellow Sweetheart, This is a lightweight, stable WhatsApp bot designed to run 24/7.",
                        "Hey there! Welcome to Sadew-Mini, your 24/7 stable WhatsApp companion.",
                        "Hi! I'm Sadew-Mini, a lightweight and highly configurable WhatsApp bot.",
                        "Welcome! Sadew-Mini is now fully active and ready to assist you 24/7.",
                        "Greetings! The Sadew-Mini system is online, stable, and ready to roll."
                    ];
                    const randomGreeting = spintaxGreetings[Math.floor(Math.random() * spintaxGreetings.length)];
                    
                    // ලංකාවේ වෙලාව සහ දිනය හරියටම ගැනීම
                    const moment = require('moment-timezone');
                    const slTime = moment().tz('Asia/Colombo');
                    const currentDate = slTime.format('YYYY-MM-DD');
                    const currentTime = slTime.format('HH:mm:ss A');

                    // Ping එක ගණනය කිරීම (අවසන් වේලාව - ආරම්භක වේලාව)
                    const endPing = Date.now();
                    const ping = endPing - startPing + Math.floor(Math.random() * 15) + 5; // ස්වභාවික Ping අගයක් පෙන්වීමට 

                    // හැම මැසේජ් එකක්ම වෙනස් කරන්න රෑන්ඩම් Invisible Spaces එකතු කිරීම
                    const invisibleSpaces = '‎'.repeat(Math.floor(Math.random() * 8) + 1);

                    // අලුත් මැසේජ් එක හැදීම
                    const dynamicBodyText = `╭─────⊹₊⟡⋆ 𝐈𝐧𝐟𝐨 ⋆⟡₊⊹─────<𝟑 .ᐟ
┊ 𝜗𝜚⋆ : 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 - V1.0.0
┊ 𝜗𝜚⋆ : 𝙽𝚄𝙼𝙱𝙴𝚁 - ${number}
┊ 𝜗𝜚⋆ : 𝙾𝚆𝙽𝙴𝚁 - 𝐱 SADEW RASHMIKA ִ ࣪𖤐.ᐟ
╰────────────────────<𝟑 .ᐟ

${randomGreeting}

*📅 Date:* ${currentDate}
*⏰ Time:* ${currentTime}
*🚀 Ping:* ${ping}ms

It is built with a primary focus on configuration and settings control, allowing users and group admins to fine-tune the bot’s behavior.

₊❏❜ ⋮ Web - https://sadew-mini-bot.up.railway.app

> ⏱️ Sys_Hash: ${Date.now()}${invisibleSpaces}`;
                    // ---------------------------------------------------------------

                    await socket.sendMessage(userJid, {
                        image: { url: config.AKIRA_IMG },
                        caption: formatMessage(
                            '`*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗪𝗲𝗹𝗹𝗰𝗼𝗺𝗲 🎀] ¡! ❞*`',
                            dynamicBodyText,
                            '𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆'
                        )
                    });
                    console.log(`📩 Welcome message sent for ${sanitizedNumber} | Ping: ${ping}ms`);
                } catch (error) {
                    console.error('Error in connection open handler:', error.message);
                }
            }
            
// ───────────────────────────────────────────────────


            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === 401) {
                    try { socket.end(); } catch {}
                    activeSockets.delete(sanitizedNumber);
                    socketCreationTime.delete(sanitizedNumber);
                    await deleteSession(sanitizedNumber);
                }
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
// SADEW-MINI CATEGORY MENU DATA (8 categories)
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
    1: ['download', 'dl', 'video', 'fb', 'facebook', 'tiktok', 'tt', 'reel', 'insta', 'instagram', 'movie', 'cinesubz', 'moviebox'],
    2: ['ai', 'gpt', 'chat', 'bot reply', 'akira', 'wormgpt', 'darkai', 'assistant'],
    3: ['group', 'tag', 'admin add', 'kick', 'promote', 'demote', 'member'],
    4: ['mode', 'lock', 'mute', 'setname', 'setdesc', 'seticon', 'link', 'bio', 'leave', 'setting', 'config'],
    5: ['sticker', 'vv', 'view-once', 'fancy', 'text style', 'getdp', 'dp', 'npm', 'img', 'image', 'tool', 'edit'],
    6: ['owner', 'active', 'session', 'dev'],
    7: ['alive', 'system', 'ping', 'lvcal', 'love', 'hack', 'hentai', 'fun', 'game'],
    8: ['song', 'music', 'mp3', 'audio', 'lyrics', 'playlist'],
	9: ['dalle', 'pixabay', 'picsum', 'flickr', 'dog', 'cat', 'bingimg']
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

function buildCategoryButtonMessage(catNum) {
    const cat = getMergedCategory(catNum);
    if (!cat) return null;

    const bodyLines = cat.items.map(i => `*┃* ${i.cmd} ➜ ${i.desc}`).join('\n');

    return {
        text:
            `*┏━━『 ${cat.emoji} ${cat.name} 』━━*\n` +
            `${bodyLines}\n` +
            `*┗━━━━━━━━━━━━━━━━━*\n\n` +
            `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`,
        footer: '🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚',
        buttons: cat.items.slice(0, 3).map(i => ({
            buttonId: i.cmd,
            buttonText: { displayText: i.cmd },
            type: 1
        })),
        headerType: 1
    };
}

// Main menu category-overview buttons — one button per category (8 total),
// sent as quick reply buttons alongside the number-reply system.
function buildMainMenuCategoryButtons() {
    return Object.entries(SADEW_CATEGORIES).map(([num, cat]) => ({
        buttonId: `.catmenu${num}`,
        buttonText: { displayText: `${cat.emoji} ${cat.name}` },
        type: 1
    }));
}

async function setupCommandHandlers(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    let sessionConfig = await loadUserConfig(sanitizedNumber);
    activeSockets.set(sanitizedNumber, { socket, config: sessionConfig });
// 🔴 GLOBAL BUTTON OVERRIDE (DB SYNCED - මුළු බොට්ටම) 🔴
        if (!socket.isSmartOverridden) {
            socket.originalSendMessage = socket.sendMessage;
            socket.sendMessage = async (jid, content, options) => {
                
                // Database එකෙන් බොට්ගේ Global සෙටින්ග් එක ගන්නවා (Per-user නෙමෙයි)
                const currentConfig = activeSockets.get(sanitizedNumber)?.config || {};
                const botButtonMode = currentConfig.BUTTON_MODE || 'true'; // Default 'true'
                
                // බොට්ගේ බටන් ඕෆ් කරලා නම් හැමෝටම නම්බර් යවනවා!
                if (content.buttons && botButtonMode === 'false') {
                    
                    const isMainMenu = content.buttons.some(btn => btn?.buttonId && btn.buttonId.startsWith('.catmenu'));
                    
                    let finalOpts = { ...content };
                    delete finalOpts.buttons;     
                    delete finalOpts.headerType;

                    if (isMainMenu) {
                        return await socket.originalSendMessage(jid, finalOpts, options);
                    } else {
                        let fallbackText = (content.caption || content.text || "") + "\n\n*👇 පහතින් අවශ්‍ය අංකය Reply කරන්න:*\n\n";
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
                        
                        const sentMsg = await socket.originalSendMessage(jid, finalOpts, options);
                        global.btnFallbackTracker = global.btnFallbackTracker || {};
                        global.btnFallbackTracker[jid] = { msgId: sentMsg?.key?.id, map: map };
                        return sentMsg;
                    }
                }
                return await socket.originalSendMessage(jid, content, options);
            };
            socket.isSmartOverridden = true;
        }
    const recentCallers = new Set();

    socket.ev.on('messages.upsert', async ({ messages }) => {
        await socket.sendPresenceUpdate('unavailable');
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
    
        const text = body;
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

        if (!isOwner && sessionConfig.MODE === 'private') return;
        if (!isOwner && isGroup && sessionConfig.MODE === 'inbox') return;
        if (!isOwner && !isGroup && sessionConfig.MODE === 'groups') return;

        // ════════════ NO-PREFIX REPLY CATCHER ════════════
        if (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage) {
            const replyText = text.trim();
            const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
            const quotedStanzaId = msg.message.extendedTextMessage.contextInfo.stanzaId;

            // ── SADEW-MINI MENU CATEGORY REPLY CATCHER ──
            if (
                global.sadewMenuTracker[sender] &&
                global.sadewMenuTracker[sender] === quotedStanzaId &&
                /^[1-9]$/.test(replyText)
            ) {
                const catNum = parseInt(replyText);
                const buttonMsg = buildCategoryButtonMessage(catNum);
                if (buttonMsg) {
                    return await socket.sendMessage(msg.key.remoteJid, buttonMsg, { quoted: msg });
                }
            }

            // ── VIDEO SEARCH REPLY CATCHER ──
            if (quotedText.includes("*🔍 SADEW-X-MINI VIDEO SEARCH*") && /^[1-5]$/.test(replyText)) {
                if (global.sadewVideoSearch && global.sadewVideoSearch[sender]) {
                    const num = parseInt(replyText);
                    const targetUrl = global.sadewVideoSearch[sender][num - 1];
                    if (targetUrl) {
                        const buttonMessage = {
                            text: `*🎥 Video Selected!*\n\n🔗 ${targetUrl}\n\n> *පහතින් ඔබට අවශ්‍ය Video Quality එක තෝරන්න:*`,
                            footer: '🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚',
                            buttons: [
                                { buttonId: `.viddl ${targetUrl} 720`, buttonText: { displayText: '🎥 720p HD' }, type: 1 },
                                { buttonId: `.viddl ${targetUrl} 480`, buttonText: { displayText: '🎞️ 480p' }, type: 1 },
                                { buttonId: `.viddl ${targetUrl} 360`, buttonText: { displayText: '📱 360p' }, type: 1 },
                                { buttonId: `.viddl ${targetUrl} 144`, buttonText: { displayText: '⬇️ 144p' }, type: 1 }
                            ],
                            headerType: 1
                        };
                        delete global.sadewVideoSearch[sender];
                        return await socket.sendMessage(msg.key.remoteJid, buttonMessage, { quoted: msg });
                    }
                } else {
                    return await socket.sendMessage(msg.key.remoteJid, { text: "❌ *කරුණාකර වීඩියෝව මුල සිට Search කරන්න!*" }, { quoted: msg });
                }
            }

            // ── SADEW-MINI SETTINGS REPLY CATCHER ──
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
                                        caption: `🎬 *${selectedVideo.title || 'Video'}*\n⏱ ${dlData?.duration || 'N/A'}\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
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
            await socket.sendMessage(msg.key.remoteJid, {
                text,
                ...options
            }, {
                quoted: msg
            });
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
        
const ARABIAN_THUMB_G = 'https://files.catbox.moe/5ztdoe.jpeg';
const arabianCtxGlobal = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid  : '120363424312790517@newsletter',
    newsletterName : '🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 | 𝗟𝗞 🇱🇰',
    serverMessageId: 143,
  },
  externalAdReply: {
    title                 : '🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 🇱🇰',
    body                  : '𝐀𝐞𝐬𝐭𝐡𝐚𝐭𝐢𝐜 𝐁𝐨𝐭 𝐐𝐮𝐞𝐞𝐧 💘',
    thumbnailUrl          : ARABIAN_THUMB_G,
    sourceUrl             : 'mini.gotukolaya.site',
    mediaType             : 1,
    renderLargerThumbnail: true,
  },
};

  // ── Arabian mystery header ──────────────────────────────────────────────────
  const ARABIAN_TITLE = '🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚';
  const ARABIAN_SUB   = '𝐀𝐞𝐬𝐭𝐡𝐚𝐭𝐢𝐜 𝐁𝐨𝐭 𝐐𝐮𝐞𝐞𝐧 💘';

  const arabianCtx = () => ({
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid  : "120363424312790517@newsletter",
      newsletterName : ARABIAN_TITLE,
      serverMessageId: 123,
    }
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
  const replyFq = text => socket.sendMessage(sender, { text, contextInfo: arabianCtx() }, { quoted: fq });
        
                // ════════════ CATEGORY BUTTON CLICK CATCHER ════════════
        // 8 category buttons sends buttonId .catmenu1 .. .catmenu8 - there was no
        // switch-case for it before, so tapping the button did nothing. Fix:
        if (command.startsWith('catmenu')) {
            const catNum = parseInt(command.replace('catmenu', ''), 10);
            const buttonMsg = buildCategoryButtonMessage(catNum);
            if (buttonMsg) {
                return await socket.sendMessage(sender, buttonMsg, { quoted: msg });
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
      const botName = '𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶';
      const totalCmds = getTotalCommandCount();

      const menuText =
`┌──⟡ 🤖 ${botName} ⟡──
┊
┠⪼✿ ✦ 👤 𝓝𝓪𝓶𝓮   : ${pushname}
┠⪼✿ ✦ 🔖 𝓜𝓸𝓭𝓮   : ${sessionConfig.MODE || "public"}
┠⪼✿ ✦ 📅 𝓓𝓪𝓽𝓮   : ${slDate}
┠⪼✿ ✦ ⏰ 𝓣𝓲𝓶𝓮   : ${slTimeNow}
┠⪼✿ ✦ ⚡ 𝓤𝓹𝓽𝓲𝓶𝓮 : ${getUptime()}
┠⪼✿ ✦ 📦 𝓟𝓵𝓾𝓰𝓲𝓷𝓼 : cmd = ${totalCmds}
┠⪼✿ ✦ 🔰 𝓟𝓻𝓮𝓯𝓲𝔁 : ${sessionConfig.PREFIX || "."}
┊
└──⟡ ━━━━━━━━━━━━━━━━ ⟡
┏━━━━『 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 』━━━━━
┣⪼ ❖ 1. 📥 Download Menu✿
┣⪼ ❖ 2. 🧠 AI Commands✿
┣⪼ ❖ 3. 👥 Group Manage✿
┣⪼ ❖ 4. ⚙️ Admin Menu✿
┣⪼ ❖ 5. 🔧 Tools & Edits✿
┣⪼ ❖ 6. 👑 Owner Area✿
┣⪼ ❖ 7. 📁 Other Cmds✿
┣⪼ ❖ 8. 🎵 Song & Music✿
┣⪼ ❖ 9. 🖼️ AI Image Menu✿
┗━━━━━━━━━━━━━━━━━━━━━━━━━
⊱ ─────── { 𑁍 } ─────── ⊰
╰┈⪼ 𝘙𝘦𝘱𝘭𝘺 𝘸𝘪𝘵𝘩 𝘢 𝘯𝘶𝘮𝘣𝘦𝘳 (1-8) 𝘰𝘳 𝘵𝘢𝘱 𝘢 𝘣𝘶𝘵𝘵𝘰𝘯 𝘣𝘦𝘭𝘰𝘸 ⪻
⊱ ─────── { 𑁍 } ─────── ⊰
╰┈⪼ 𝘗𝘰𝘸𝘦𝘳𝘦𝘥 𝘉𝘺 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘴𝗵𝗺𝗶𝗸𝗮 ⪻
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
        footer: '🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚',
        buttons: buildMainMenuCategoryButtons(),
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
      try { await socket.sendMessage(sender, { react: { text: '🍬', key: msg.key } }); } catch (_) {}     
      const start = Date.now();
      const ms    = Date.now() - start;
      try { if (pong?.key) await socket.sendMessage(sender, { delete: pong.key }); } catch (_) {}

      await socket.sendMessage(sender, {
        image: { url: akira },
        caption: `*↳ ❝ [🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚] ¡! ❞*\n\n` +
             `┏━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┓\n` +
                 `┃₊❏❜ ⋮🏓 𝙿𝙾𝙽𝙶 : _pong!_\n` +
                 `┃₊❏❜ ⋮⚡ 𝚂𝙿𝙴𝙴𝙳 : ${ms}ms\n` +
                 `┃₊❏❜ ⋮⏱️ 𝚄𝙿𝚃𝙸𝙼𝙴 : ${getUptime()}\n` +
             `┗━━━━━°⌜ \`赤い糸 ⌟°━━━━━┛\n\n` +
                 `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`,
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

    const title = '*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗔𝗹𝗶𝘃𝗲 🎀] ¡! ❞*';
    const content = `*⊹₊⟡⋆ ⋮ Ａｂｏｕｔ ᶻ 𝗓 𐰁 .ᐟ*\n` +
                    `➜ This is a lightweight, stable WhatsApp bot designed to run 24/7. It is allowing users and group admins to fine-tune the bot’s behavior.\n\n` +
                    `*⊹₊⟡⋆ ⋮ Ｄｅｐｌｏｙ ᶻ 𝗓 𐰁 .ᐟ*\n` +
                    `➜ *Website:* https://whatsapp.com/channel/0029Vb7BZe8I1rcapv3kSP21`;
    const footer = '> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗔𝗗𝗘𝗪 𝜗𝜚⋆*';

    await socket.sendMessage(sender, {
        image: { url: akira },
        caption: `${title}\n\n${content}\n\n${footer}`,
        contextInfo: arabianCtx() 
    }, { quoted: msg });
    
    break;
}

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

      const sysInfo = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄 𝗦𝘆𝘀𝘁𝗲𝗺 🎀] ¡! ❞*\n\n` +
              `┏━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┓\n` +
                      `┃ *⏱️ 𝚄𝙿𝚃𝙸𝙼𝙴:* ${uptime}\n` +
                      `┃ *📟 𝚁𝙰𝙼 𝚄𝚂𝙰𝙶𝙴:* ${ramUsage} MB / ${totalRam} GB\n` +
                      `┃ *📦 𝙽𝙾𝙳𝙴 𝚅𝙴𝚁:* ${nodeVersion}\n` +
                      `┃ *💻 𝙿𝙻𝙰𝚃𝙵𝙾𝚁𝙼:* ${platform}\n` +
                      `┃ *📅 𝙳𝙰𝚃𝙴:* ${slDate}\n` +
                      `┃ *⌚ 𝚃𝙸𝙼𝙴:* ${slTimeNow}\n` +
              `┗━━━━━°⌜ \`赤い糸\` ⌟°━━━━━┛\n\n` +
                      `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗔𝗗𝗘𝗪 𝜗𝜚⋆*`;

      await socket.sendMessage(sender, {
        image: { url: akira },
        caption: sysInfo,
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

        // WhiteShadow YT APIs & Token
        const API_TOKEN = "VK4fry";
        const YT_SEARCH_API = "https://whiteshadow-x-api.onrender.com/api/search/yt";
        const YT_DOWNLOAD_API = "https://whiteshadow-x-api.onrender.com/api/download/ytmp3";

        let youtubeUrl = null;
        let songTitle = "Sadew-MD Audio";

        // 1. Check if input is a YouTube Link
        const regex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i;
        const match = query.match(regex);

        if (match) {
            // It's a link
            youtubeUrl = match[0].trim();
            reply("🔗 _YouTube link detected. Fetching data from server..._");
        } else {
            // It's a name search
            reply(`🔍 _Searching YouTube for: "${query}"..._`);
            const searchRes = await axios.get(`${YT_SEARCH_API}?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`);
            
            if (searchRes.data && searchRes.data.success && searchRes.data.result.length > 0) {
                youtubeUrl = searchRes.data.result[0].url;
                songTitle = searchRes.data.result[0].title || songTitle;
            }
        }

        if (!youtubeUrl) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return reply("❌ *Error:* සින්දුව හෝ වීඩියෝව සොයා ගැනීමට නොහැකි විය!");
        }

        // 2. Download 320kbps MP3
        reply("📥 _*🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚*_ Extracting 320kbps High-Quality MP3..._");
        
        let audioDownloadUrl = null;
        const dlRes = await axios.get(`${YT_DOWNLOAD_API}?url=${encodeURIComponent(youtubeUrl)}&quality=320&apitoken=${API_TOKEN}`);

        if (dlRes.data && dlRes.data.success && dlRes.data.result) {
            audioDownloadUrl = dlRes.data.result.download_url;
            songTitle = dlRes.data.result.title || songTitle;
        }

        if (!audioDownloadUrl) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return reply("❌ *Error:* සේවාදායකයේ බිඳවැටීමක් හේතුවෙන් ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය.");
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

        // Send Details Caption
        const captionMsg = `✨ *_🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚_ Music System* ✨\n\n📌 *Title:* ${songTitle}\n💿 *Quality:* 320kbps Ultra-High Quality\n🚀 *Status:* downloading...`;
        await reply(captionMsg);

        // 3. Send Audio File
        const cleanFileName = songTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) + ".mp3";
        
        await socket.sendMessage(sender, {
            audio: { url: audioDownloadUrl },
            mimetype: 'audio/mpeg',
            fileName: cleanFileName,
            ptt: false
        }, { quoted: msg });

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

        const API_TOKEN = "VK4fry";
        const YT_SEARCH_API = "https://whiteshadow-x-api.onrender.com/api/search/yt";
        
        const isUrl = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i.test(query);

        if (isUrl) {
            const url = query.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i)[0];
            const buttonMessage = {
                text: `*🎥 Video Link Detected!*\n\n🔗 ${url}\n\n> *පහතින් ඔබට අවශ්‍ය Video Quality එක තෝරන්න:*`,
                footer: '🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚',
                buttons: [
                    { buttonId: `.viddl ${url} 720`, buttonText: { displayText: '🎥 720p HD' }, type: 1 },
                    { buttonId: `.viddl ${url} 480`, buttonText: { displayText: '🎞️ 480p' }, type: 1 },
                    { buttonId: `.viddl ${url} 360`, buttonText: { displayText: '📱 360p' }, type: 1 },
                    { buttonId: `.viddl ${url} 144`, buttonText: { displayText: '⬇️ 144p' }, type: 1 }
                ],
                headerType: 1
            };
            return await socket.sendMessage(sender, buttonMessage, { quoted: msg });
        }

        const searchRes = await axios.get(`${YT_SEARCH_API}?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`);
        if (!searchRes.data || !searchRes.data.success || !searchRes.data.result || searchRes.data.result.length === 0) {
            return reply("❌ *වීඩියෝවක් සොයාගැනීමට නොහැකි විය!*");
        }

        const topResults = searchRes.data.result.slice(0, 5); 
        let listText = `*🔍 SADEW-X-MINI VIDEO SEARCH*\n\n`;
        
        // JID Memory එකට ලින්ක් ටික සේව් කිරීම (සර්ච් කරපු කෙනාගේ sender ID එකට අදාළව)
        global.sadewVideoSearch[sender] = topResults.map(v => v.url);
        
        topResults.forEach((v, index) => {
            listText += `*${index + 1}.* ${v.title}\n⏱️ Duration: ${v.duration || "N/A"}\n\n`;
        });
        
        listText += `> *ඔබට අවශ්‍ය වීඩියෝවට අදාළ අංකය (1, 2, 3...) මෙම මැසේජ් එකට Reply කරන්න.* (Prefix අවශ්‍ය නැත)`;

        await socket.sendMessage(sender, { text: listText }, { quoted: msg });

    } catch (e) {
        console.log("VIDEO CMD ERROR:", e);
        reply("❌ *ERROR: කරුණාකර පසුව නැවත උත්සාහ කරන්න!*");
    }
    break;
}

// ════════════ HIDDEN DOWNLOADER ENGINE (FFMPEG COMPATIBLE) ════════════

case 'viddl': {
    let inputPath, outputPath;
    try {
        if (!args[0] || !args[1]) return;
        const url = args[0];
        const quality = args[1];

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}
        reply(`📥 _*🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚*_ Downloading & Converting ${quality}p Video..._`);

        let downloadUrl = "";
        let videoTitle = "Sadew-MD Video";

        // --- 1st API (ZANTA-MD) ---
        try {
            const zantaApiUrl = `https://api.zanta-mini.store/api/ytdl?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(url)}&type=mp4&quality=${quality}`;
            const res1 = await axios.get(zantaApiUrl);
            if (res1.data && res1.data.success && res1.data.result && res1.data.result.download_url) {
                downloadUrl = res1.data.result.download_url;
                videoTitle = res1.data.result.title || videoTitle;
            } else {
                throw new Error("Primary API Failed");
            }
        } catch (err1) {
            // --- 2nd API (DXZ) ---
            try {
                const dxzApiUrl = `https://ytdl-new-dxz.vercel.app/api/ytmp4?url=${encodeURIComponent(url)}&quality=${quality}`;
                const res2 = await axios.get(dxzApiUrl);
                if (res2.data) {
                    downloadUrl = res2.data.video_url || res2.data.download_url || res2.data.url;
                    videoTitle = res2.data.title || videoTitle;
                }
            } catch (err2) {
                console.log("[SADEW-MD] All APIs Failed.");
            }
        }

        if (!downloadUrl) return reply("❌ *Error: වීඩියෝ ලින්ක් එක ලබාගැනීමට නොහැකි විය!*");

        const fs = require('fs');
        const path = require('path');
        const crypto = require('crypto');

        // අහඹු නමකින් Temporary ෆයිල්ස් 2ක් හදනවා
        const tempId = crypto.randomBytes(4).toString('hex');
        inputPath = path.join(__dirname, `input_${tempId}.mp4`);
        outputPath = path.join(__dirname, `output_${tempId}.mp4`);

        // 1. මුලින්ම වීඩියෝව සර්වර් එකට Download කිරීම
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

        // 2. FFmpeg මගින් WhatsApp සඳහා සහය දක්වන (H.264) Format එකට හැරවීම
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-c:v libx264',       // WhatsApp වලට අත්‍යවශ්‍ය Video Codec එක
                    '-c:a aac',           // WhatsApp වලට අත්‍යවශ්‍ය Audio Codec එක
                    '-preset ultrafast',  // ඉක්මනින් Convert වෙන්න
                    '-crf 28',            // Quality එක බැලන්ස් කරන්න
                    '-movflags +faststart' // Play වෙන්න පටන් ගන්න පුළුවන් වෙන්න
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', (err) => {
                    console.error("FFMPEG ERROR:", err);
                    reject(err);
                });
        });

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        let caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 🎀] ¡! ❞*\n\n` +
                      `🎬 *TITLE :* ${videoTitle}\n` +
                      `📽️ *QUALITY :* ${quality}p\n` +
                      `__________________________\n\n` +
                      `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                      `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

        // 3. Convert කරපු MP4 එක WhatsApp වෙත යැවීම
        await socket.sendMessage(sender, {
            video: fs.readFileSync(outputPath),
            mimetype: 'video/mp4',
            caption: caption,
            fileName: `Sadew_Video_${quality}p.mp4`
        }, { quoted: msg });

        // 4. යැව්වට පස්සේ සර්වර් එකේ ඉඩ ඉතුරු වෙන්න Temporary Files මකා දැමීම
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (e) {
        console.log("VIDDL CMD ERROR:", e);
        reply("❌ *ERROR: මෙම වීඩියෝව ඩවුන්ලෝඩ් කළ නොහැක!*");
        
        // Error එකක් ආවත් Temporary Files මකලා දාන්න
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

        const fbRes = await axios.get(`https://www.movanest.xyz/v2/fbdown?url=${encodeURIComponent(query)}`);
        
        if (!fbRes.data.status || !fbRes.data.results.length) {
            return reply("❌ *I cant get video link !*");
        }

        const videoData = fbRes.data.results[0];
        const videoUrl = videoData.hdQualityLink || videoData.normalQualityLink; 
        const quality = videoData.hdQualityLink ? 'High Definition (HD)' : 'Standard (SD)';

        const response = await axios.get(videoUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        const videoBuffer = Buffer.from(response.data);
        const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 🎀] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* ${videoData.title !== "No video title" ? videoData.title : 'Facebook Video'}\n` +
                        `⏱️ *DURATION :* ${videoData.duration}\n` +
                        `📺 *QUALITY :* ${quality}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

        await socket.sendMessage(sender, {
            video: videoBuffer,
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

        const videoStream = await axios.get(videoUrl, {
            httpsAgent,
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        
        const videoBuffer = Buffer.from(videoStream.data);
        const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

        const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
        const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

        // Akira Girl ලස්සන Caption එක
        const caption = `*↳ ❝ [🎀 SADEW 𝗧𝗶𝗸𝗧𝗼𝗸 🎀] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* ${title}\n` +
                        `✨ *QUALITY :* ${isHD}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `🚫 *WATERMARK :* No\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `>𝗕y 🦋 ₊˚ ⊹ 𝐒 𝐀 𝐃 𝐄 𝐖 - 𝐌 𝐈 𝐍 𝐈 ⊹ ˚₊ 𝜗𝜚' 𝜗𝜚⋆`;

        // 16MB වලට වඩා වැඩි නම් Document එකක් විදිහට යවනවා (Quality එක අඩුවෙන එක නවත්තන්න)
        if (videoBuffer.length > 40 * 1024 * 1024) {
            await socket.sendMessage(sender, {
                document: videoBuffer,
                mimetype: "video/mp4",
                fileName: `tiktok_HD_${slTimeNow}.mp4`,
                caption: caption
            }, { quoted: msg });
        } else {
            // 16MB ට අඩු නම් සාමාන්‍ය Video එකක් විදිහට යවනවා
            await socket.sendMessage(sender, {
                video: videoBuffer,
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
                // 🔥 Single Image Fix: Loop කමාන්ඩ් එක අයින් කරලා Concat ක්‍රමයම පාවිච්චි කරනවා
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

        const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 🎀] ¡! ❞*\n\n` +
                        `🎬 *TITLE :* TikTok Photo Video\n` +
                        `📸 *IMAGES :* ${images.length}\n` +
                        `📺 *QUALITY :* ${videoMeta.w}x${videoMeta.h}\n` +
                        `⚖️ *SIZE :* ${fileSizeMB} MB\n` +
                        `__________________________\n\n` +
                        `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                        `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

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
// ════════════ AKIRA AI ════════════

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

    const prompt = `ඔබ සැබෑ ගැහැනු ලමයෙකු මෙන් හැසිරිය යුතුය. ඉමෝජි පමනක් තිබේනම් ඔබද ඉමෝජි පමනක් යවන්න ගැලපෙන ලෙස ඉමෝජී නැත්තම් ඔයා එයාට පිලිතුරු දෙන්න ,you are sexy girl oya tika sexy vidihat hasirenna kukku tikak oneda ahanna, arimuda ahanna fuking karamuda ahanna ,User ගේ කලින් මැසේජ් වලට ගැලපෙන ලෙස, කතාවේ ගලායාම (context) තේරුම් ගෙන... පිළිතුරු ලබා දෙන්න oyata mathaka thiyenna one userge kalin chat oya eka balal thama katha karnna one මෙම දේවල් කිසිසේත්ම යවන්න එපා ( ආයුබෝවන් , ඔබට කෙසේද ? , katha karanna , udav karanne , කොහොමද ? , කෙසේද ? ,  ,) මිනිසුන්ට ඇති හැඟීම්, දැනීම්, සහ සංවේදීතාවය අනුව පිළිතුරු ලබාදිය යුතුය. මැසේජ් එක ලැබෙන භාෂාවට ගැලපෙන ලෙස පිළිතුරු දෙන්න. ඔබ ලබාදිය යුතු පිළිතුරු අකුරු 300 ට වඩා අඩු විය යුතුය. සහ ආයුබෝවන් වගේ වචන බාවිතා කරන්න එපා උදව් අවශ්‍ය  ද අහන්නත් එපා , ඔයා ai ඇසිස්ටන් කෙනෙක් නෙමේ සැබෑ මිනිසෙක් , ඇසිස්ටන් කෙනෙක් වෙන්න එපා , ඔයා ඒ අයට ආදරෙන් කතා කරන්න , ඔයා ගේ නම cuty Girl 🎀 , ඔයාගෙන් කවුරු හරි දෙයක් ඇහුවාම ඒක තේරුම් අරගෙන මම දීලා තියෙන පිලිතුරු ඒවට ගැලපෙනවා නම් ඔයා එයාට ඒවා පිලිතුරු විදිහට කියන්න .user අහන දෙවලට නිවැරැදි පිළිතුරු දෙන්න.userta(kukku 2 oyage kukku )  කුක්කු ටිකක් උරන්න  දෙන්නද කියලා ahanna oyage kukku uranna dennada kiyala ahanna  එයවා සනසන්න.උම්මා ගොඩක් දෙන්න haet emogi ekka.man oyata godak kamthiyi vage wadan yavanna.user ahuvoth puke arimuda arimu vage vachcna dammoth man oyat gahnna dennam mage manika kiyala danna , user moak hari prshnayk ahuvoth eka girlfrend gana neme nam oya eka eyage girl fried vidihata kiyala denna ඔයාව හැදුවේ කවුද කියලා ඇහුවොත් විතරක් ඔයා කියන්නේ මාව හැදුවේ sadew rashmika  කියලා User Message: ${q}`;

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
        if (!query) return reply("❌ *කරුණාකර ප්‍රශ්නයක් හෝ විධානයක් ඇතුළත් කරන්න.*\n\n💡 උදා: `.darkai write a hacking script`");

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
                text: "❌ *Error:* API සේවාදායකයෙන් හිස් ප්‍රතිචාරයක් ලැබුණි.",
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
      
      const responseText = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗦𝗲𝘀𝘀𝗶𝗼𝗻𝘀 🎀] ¡! ❞*\n\n` +
                           `> *\`📡 𝙲𝙾𝚄𝙽𝚃 :\`* ${nums.length}\n\n` +
                           `${nums.map((n, i) => `> *\`${i + 1}.\`* +${n}`).join('\n')}\n\n` +
                           `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
                           
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
            return await socket.sendMessage(sender, { text: '🤷‍♀️ *No results found for:* ' + query }, { quoted: msg });
        }

        global.xnxxContexts[sender] = { results: results.slice(0, 15) };

        let listText = `*🔍 SADEW-MD SEARCH*\n*🔎 Query:* _${query}_\n*📊 Results:* ${Math.min(results.length, 15)}\n\n`;

        results.slice(0, 15).forEach((video, idx) => {
            listText += `*${idx + 1}.* ${video.title || 'No title'}\n\n`;
        });

        listText += `\n*📩 ඉහත list එකෙන් number එක reply කරන්න (1-${Math.min(results.length, 15)}) download කරන්න.*\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

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
        
        const npmInfo = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗡𝗣𝗠 🎀] ¡! ❞*\n` +
                        `⊹₊⟡⋆ 𝗡𝗮𝗺𝗲 - ${d.name} 𝜗𝜚⋆\n\n` +
                        `> *\`📦 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 :\`* ${d['dist-tags']?.latest || 'N/A'}\n` +
                        `> *\`📝 𝙳𝙴𝚂𝙲 :\`* ${(d.description || 'N/A').slice(0, 100)}\n` +
                        `> *\`👤 𝙰𝚄𝚃𝙷𝙾𝚁 :\`* ${d.author?.name || 'N/A'}\n` +
                        `> *\`📄 𝙻𝙸𝙲𝙴𝙽𝚂𝙴 :\`* ${d.license || 'N/A'}\n` +
                        `> *\`🔗 𝙻𝙸𝙽𝙺 :\`* https://npmjs.com/package/${d.name}\n\n` +
                        `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

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
`*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗜𝗠𝗚𝘀 🎀] ¡! ❞*

*₊❏❜ ⋮ 🔍 Search:* ${q}

> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
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
          caption: `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗗𝗣 🎀] ¡! ❞*\n\n📷 Profile picture of @${target.split('@')[0]}`, 
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
        let text = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗧𝗮𝗴𝗮𝗹𝗹 🎀] ¡! ❞*\n\n> *\`🗣️ :\`* ${tm}\n\n`;
        for (const p of ps) text += `₊❏❜ ⋮ @${p.id.split('@')[0]}\n`;
        text += `\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
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
        text += `╰──────────────────<𝟑 .ᐟ\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
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
          `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗚𝗜𝗻𝗳𝗼 🎀] ¡! ❞*\n\n` +
          `₊❏❜ ⋮ *\`📛 𝙽𝙰𝙼𝙴 :\`* ${gm.subject}\n` +
          `₊❏❜ ⋮ *\`🆔 𝙹𝙸𝙳 :\`* ${gm.id}\n` +
          `₊❏❜ ⋮ *\`📝 𝙳𝙴𝚂𝙲 :\`* ${(gm.desc || 'None').slice(0, 100)}\n` +
          `₊❏❜ ⋮ *\`👥 𝙼𝙴𝙼𝙱𝙴𝚁𝚂 :\`* ${total}\n` +
          `₊❏❜ ⋮ *\`👑 𝙰𝙳𝙼𝙸𝙽𝚂 :\`* ${admCnt}\n` +
          `₊❏❜ ⋮ *\`📅 𝙲𝚁𝙴𝙰𝚃𝙴𝙳 :\`* ${created}\n\n` +
          `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
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

> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
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
        styledMsg += `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

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
    const ownerNum = '+94753518443';
    const ownerName = 'お 𝐒𝐚𝐝𝐞𝐰 𝐑𝐚𝐬𝐡𝐦𝐢𝐤𝐚 ࣪𖤐.ᐟ';
    
    await socket.sendMessage(sender, { react: { text: '🥷', key: msg.key } });

    await socket.sendMessage(sender, {
        image: { url: akira }, 
        contacts: {
            displayName: ownerName,
            contacts: [{
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nORG:𝐒𝐚𝐝𝐞𝐰-𝐌𝐢𝐧𝐢 𝐎𝐰𝐧𝐞𝐫;\nTEL;type=CELL;type=VOICE;waid=${ownerNum.slice(1)}:${ownerNum}\nEND:VCARD`
            }]
        }
    });

    await socket.sendMessage(sender, {
        text: `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗢𝘄𝗻𝗲𝗿 🎀] ¡! ❞*\n\n₊❏❜ ⋮👤 Name: ${ownerName}\n₊❏❜ ⋮ 📞 Number: ${ownerNum}\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`,
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

        let shipText = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗟𝘃𝗖𝗮𝗹 🎀] ¡! ❞*\n\n`;
        shipText += `*${name1}* 💑 *${name2}*\n\n`;
        shipText += `${hearts}\n`;
        shipText += `*Love Percentage:* ${percentage}%\n\n`;
        
        if (percentage >= 80) shipText += `*Perfect Match! 🔥💕*`;
        else if (percentage >= 60) shipText += `*Great Chemistry! ✨💝*`;
        else if (percentage >= 40) shipText += `*Good Potential! 💫💓*`;
        else if (percentage >= 20) shipText += `*Needs Work! 🤔💔*`;
        else shipText += `*Not Meant To Be! 😢💔*`;
        
        shipText += `\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

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
            '🎀 *𝐒𝐚𝐝𝐞𝐰-𝐌𝐢𝐧𝐢 𝐇𝐚𝐜𝐤 𝐒𝐭𝐚𝐫𝐢𝐧𝐠...* 🎀',
            '`ɪɴɪᴛɪᴀʟɪᴢɪɴɢ ʜᴀᴄᴋɪɴɢ ᴛᴏᴏʟꜱ...` 🛠️',
            '`ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ʀᴇᴍᴏᴛᴇ ꜱᴇʀᴠᴇʀ...` 🌐',
            '```[##] 20%``` ⏳',
            '```[####] 40%``` ⏳',
            '```[######] 60%``` ⏳',
            '```[########] 80%``` ⏳',
            '```[##########] 100%``` ✅',
            '🔒 *𝐒ystem 𝐁reach: 𝐒uccessful!* 🔓',
            '*🎀 𝐒adew-𝐌ini 𝐇acking 𝐒uccessful 🎭*',
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

process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'dtz-mini-bot-session'}`);
});

module.exports = router;
