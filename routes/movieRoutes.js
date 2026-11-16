const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cheerio = require('cheerio');
const qs = require('qs');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Admin = require('../models/Admin'); // 🔥 Admin Database එක ඉම්පෝට් කළා

const router = express.Router();

const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    try { fs.mkdirSync(tempDir, { recursive: true }); } catch (_) {}
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const CZ2_API = "https://cinesubz-api-cnw.vercel.app/api";
const ANIME_BASE = "https://animeheaven.me";
const MOVIEBOX_API_BASE = "https://mbx-production.up.railway.app";
const MOVIEBOX_KEY = "mb_c15c2f12a1ab099a81de2907ad99ee140832ebfe";
const GEMINI_WORKER_URL = "https://tt.sadewrashmika069.workers.dev";

// 🔥 META AI FAKE QUOTE (SHONUX) 🔥
const metaName = "Meta AI";
const shonux = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_FAKE_ID_TS" },
    message: { contactMessage: { displayName: metaName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${metaName};;;;\nFN:${metaName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
};

// 🛡️ Track sent details cards to guarantee NEVER sending duplicates
const sentDetailsCardTracker = new Set();

// ?? Client-Server Encrypted Payload Decryption
function decryptPayload(body) {
    if (!body || typeof body !== 'object') return body;
    if (!body._enc || !body._t) return body;
    try {
        const ts = Number(body._t);
        if (!ts || Math.abs(Date.now() - ts) > 2 * 60 * 60 * 1000) {
            console.warn('[SECURITY] Expired or invalid payload timestamp:', ts);
            return body;
        }
        const salt = 'sAdEw_2026_x!';
        const rawBinary = Buffer.from(body._enc, 'base64').toString('binary');
        let decrypted = '';
        for (let i = 0; i < rawBinary.length; i++) {
            const charCode = rawBinary.charCodeAt(i) ^ salt.charCodeAt(i % salt.length) ^ ((ts >> (i % 8)) & 0xFF);
            decrypted += String.fromCharCode(charCode);
        }
        return JSON.parse(decodeURIComponent(escape(decrypted)));
    } catch (err) {
        console.error('[SECURITY] Failed to decrypt payload:', err.message);
        return body;
    }
}

// 🔥 මේවා දැන් Fallbacks (DB එකෙන් ආවේ නැත්තම් විතරක් මේවා පාවිච්චි වෙනවා) 🔥
const FALLBACK_GROUP_JID = '120363425721300928@g.us'; 
const FALLBACK_BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' };

// ════════════ 🛡️ SECURITY & VALIDATION HELPERS ════════════
const ALLOWED_IMAGE_HOSTS = [
    'cinesubz.net',
    'cinesubz.co',
    'cinesubz.lk',
    'cinesubz-api-cnw.vercel.app',
    'supercloud1.xyz',
    'terracloud2.site',
    'avatarzone.online',
    'player2.setwenna.one',
    'sinhalasub.lk',
    'sinhalasub.net',
    'image.tmdb.org',
    'tmdb.org',
    'm.media-amazon.com',
    'ia.media-imdb.com',
    'animeheaven.me',
    'bp.blogspot.com',
    'blogger.googleusercontent.com',
    'baiscopelk.com',
    'sublk.com',
    'pbcdnw.aoneroom.com',
    'aoneroom.com',
    'macdn.aoneroom.com',
    'moviebox.asitha.top',
    'bcdnw.hakunaymatata.com',
    'hakunaymatata.com',
    'mbx-production.up.railway.app',
    'mbx.dnuz.top',
    'kurox.site',
    '1tamilmv.rocks',
    '1tamilmv.wtf',
    '1tamilmv.cz',
    '1tamilmv.vin',
    '1tamilmv.org',
    '1tamilmv.com',
    'postimg.cc',
    'postimages.org',
    'extraimage.info',
    'extraimage.net',
    'imagetwist.com',
    'imgbb.com',
    'ibb.co',
    'imgur.com',
    'i.imgur.com',
    'pixhost.to',
    'wp.com',
    'cloudinary.com',
    'googleusercontent.com',
    'thenkiri.com',
    'animostlk.blogspot.com',
    'piratelk.com',
    'helaflix.blogspot.com',
    'helaflixdownload.blogspot.com',
    'sinhalacartoons.com',
    'cartoons.lk',
    'playbookstatic.com',
    'cloud.sinhalachr.workers.dev',
    'animostlk.sinhalachr.workers.dev',
    'downloadwella.com',
    'pixeldrain.com'
];

let Jimp = null;
try {
    const jPkg = require('jimp');
    Jimp = jPkg.Jimp || jPkg;
} catch(_) {}

let ffmpegPath = null;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (_) {}
if (!ffmpegPath) {
    try {
        ffmpegPath = require('@ffmpeg-installer/ffmpeg')?.path;
    } catch (_) {}
}
if (!ffmpegPath) ffmpegPath = 'ffmpeg';

function convertWithFfmpeg(buffer) {
    if (!ffmpegPath) return null;
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const ff = spawn(ffmpegPath, [
            '-i', 'pipe:0',
            '-vframes', '1',
            '-q:v', '2',
            '-f', 'image2',
            '-c:v', 'mjpeg',
            'pipe:1'
        ]);
        const chunks = [];
        ff.stdout.on('data', c => chunks.push(c));
        ff.on('close', code => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks));
            } else {
                resolve(null);
            }
        });
        ff.on('error', () => resolve(null));
        ff.stdin.write(buffer);
        ff.stdin.end();
    });
}

// 🖼️ High-speed, micro-thumbnail generator for WhatsApp documents (< 15KB to prevent socket stall)
async function createDocumentThumbnail(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 20) return null;

    // 1. Try ffmpeg (scale to width 120, low quality 7 -> ~3KB-6KB lightweight JPEG)
    if (ffmpegPath) {
        try {
            const thumb = await new Promise((resolve) => {
                const { spawn } = require('child_process');
                const ff = spawn(ffmpegPath, [
                    '-i', 'pipe:0',
                    '-vf', 'scale=120:-1',
                    '-vframes', '1',
                    '-q:v', '7',
                    '-f', 'image2',
                    '-c:v', 'mjpeg',
                    'pipe:1'
                ]);
                const chunks = [];
                ff.stdout.on('data', c => chunks.push(c));
                ff.on('close', code => {
                    if (code === 0 && chunks.length > 0) resolve(Buffer.concat(chunks));
                    else resolve(null);
                });
                ff.on('error', () => resolve(null));
                ff.stdin.write(buffer);
                ff.stdin.end();
            });
            if (thumb && thumb.length > 100 && thumb.length <= 20000) return thumb;
        } catch (_) {}
    }

    // 2. Jimp fallback (resize to 120, quality 50 -> <10KB)
    try {
        if (Jimp) {
            const readFn = Jimp.read || Jimp;
            if (typeof readFn === 'function') {
                const img = await readFn(buffer);
                if (img) {
                    if (typeof img.resize === 'function') {
                        try { img.resize({ w: 120 }); } catch (e) { try { img.resize(120, -1); } catch (_) {} }
                    }
                    if (typeof img.quality === 'function') img.quality(50);
                    let b = null;
                    if (typeof img.getBuffer === 'function') b = await img.getBuffer('image/jpeg');
                    else if (typeof img.getBufferAsync === 'function') b = await img.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg');
                    if (b && b.length > 100 && b.length <= 20000) return b;
                }
            }
        }
    } catch (_) {}

    // 3. Fallback: only if original buffer is already under 20KB
    if (buffer.length <= 20000) return buffer;

    return null;
}

function isValidMovieImage(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return false;
    try {
        const parsed = new URL(imgUrl);
        const proto = parsed.protocol.toLowerCase();
        if (proto !== 'http:' && proto !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        // SSRF protection: reject private/loopback IP addresses
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.') || host.startsWith('169.254.')) {
            return false;
        }
        return true;
    } catch (_) {
        return false;
    }
}

function detectImageMime(buf) {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 12) return 'image/jpeg';
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return 'image/jpeg';
}

async function ensureJpegBuffer(imgBuffer) {
    if (!imgBuffer || !Buffer.isBuffer(imgBuffer) || imgBuffer.length < 20) return imgBuffer;
    if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8 && imgBuffer[2] === 0xFF) {
        return imgBuffer;
    }
    // 1. Try ffmpeg first (Universal, fast support for WebP, PNG, AVIF, GIF -> pristine JPEG)
    try {
        const ffJpg = await convertWithFfmpeg(imgBuffer);
        if (ffJpg && ffJpg.length > 100) return ffJpg;
    } catch (_) {}

    // 2. Jimp fallback
    try {
        if (Jimp) {
            const readFn = Jimp.read || Jimp;
            if (typeof readFn === 'function') {
                const image = await readFn(imgBuffer);
                if (image && typeof image.getBuffer === 'function') {
                    return await image.getBuffer('image/jpeg');
                } else if (image && typeof image.getBufferAsync === 'function') {
                    return await image.getBufferAsync(Jimp.MIME_JPEG || 'image/jpeg');
                }
            }
        }
    } catch (e) {
        console.log("[IMAGE] Jpeg buffer conversion note:", e.message);
    }
    return imgBuffer;
}

function sanitizeText(str, maxLen = 1000) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\r\n\t]+/g, ' ').replace(/[*_~`]/g, '').trim().substring(0, maxLen);
}

// 🛡️ Catalog of recently searched / verified titles & posters
const verifiedMoviesCache = new Map();

function cacheVerifiedMovies(list) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
        const title = item.title || item.name;
        if (!title) continue;
        const normKey = sanitizeText(title, 80).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normKey) continue;
        verifiedMoviesCache.set(normKey, {
            title: title.trim(),
            img: item.img || item.image || item.poster || item.poster_url || '',
            source: item.source || '',
            year: item.year || item.date || '',
            genres: item.genres || '',
            imdb: item.imdb || item.rating || '',
            runtime: item.runtime || ''
        });
        if (verifiedMoviesCache.size > 500) {
            const firstKey = verifiedMoviesCache.keys().next().value;
            verifiedMoviesCache.delete(firstKey);
        }
    }
}

// 🛡️ IP Rate-Limiting & Security Tracking
const suspiciousIps = new Map();
suspiciousIps.clear();

function recordSuspiciousRequest(ip) {
    const count = (suspiciousIps.get(ip) || 0) + 1;
    suspiciousIps.set(ip, count);
    setTimeout(() => {
        const c = suspiciousIps.get(ip) || 0;
        if (c <= 1) suspiciousIps.delete(ip);
        else suspiciousIps.set(ip, c - 1);
    }, 60 * 60 * 1000);
}

function isIpSuspicious(ip) {
    return (suspiciousIps.get(ip) || 0) >= 5;
}

function formatQuality(rawQuality) {
    if (!rawQuality || typeof rawQuality !== 'string') return 'HD';
    const trimmed = rawQuality.trim();
    if (!trimmed) return 'HD';

    const epMatch = trimmed.match(/\b(?:(?:S\d+\s*)?(?:E|EP|Episode)\s*(\d+)|Episode\s+(\d+))\b/i);
    let ep = '';
    if (epMatch) {
        const num = epMatch[1] || epMatch[2];
        ep = `Ep ${num}`;
    }

    const resMatch = trimmed.match(/\b(480p|720p|1080p|1440p|2160p|4k)\b/i);
    let res = '';
    if (resMatch) {
        res = resMatch[1].toLowerCase();
        if (res === '4k') res = '4K';
    }

    let size = '';
    const sizeMatch = trimmed.match(/\b(\d+(?:\.\d+)?\s*(?:gb|mb))\b/i);
    if (sizeMatch) {
        size = sizeMatch[1].replace(/\s+/g, '').toUpperCase();
    }

    let tag = '';
    if (/\b(bluray|bdrip)\b/i.test(trimmed)) tag = 'BluRay';
    else if (/\b(web\s*dl|web-?dl|webrip)\b/i.test(trimmed)) tag = 'WEB-DL';
    else if (/\b(av1)\b/i.test(trimmed)) tag = 'AV1';
    else if (/\b(hevc|x265)\b/i.test(trimmed)) tag = 'HEVC';
    else if (/\b(mkv)\b/i.test(trimmed)) tag = 'MKV';

    if (ep && res) return size ? `${ep} - ${res} (${size})` : `${ep} - ${res}`;
    if (ep) return size ? `${ep} (${size})` : ep;
    if (res && size) return `${res} - ${size}`;
    if (res && tag) return `${res} ${tag}`;
    if (res) return res;
    if (tag && size) return `HD (${tag} - ${size})`;
    if (tag) return `HD (${tag})`;
    if (size) return `HD (${size})`;

    if (/gdrive|driver|drive|pixeldrain|pixdrogon|download|direct|server|link|stream/i.test(trimmed)) {
        return 'HD';
    }

    const clean = trimmed.replace(/[^a-zA-Z0-9\s\-_.()[\]]/g, '').replace(/\s+/g, ' ').substring(0, 25).trim();
    if (!clean || clean.length < 2) return 'HD';
    return clean;
}

// ════════════════════════════════════════════════════════
// 🤖 GEMINI AI SUMMARY ENGINE (CLOUDFLARE WORKER + FALLBACK)
// ════════════════════════════════════════════════════════
const GEMINI_KEYS = [
    process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4, process.env.GEMINI_KEY_5, process.env.GEMINI_KEY_6
].filter(Boolean);

const geminiSummaryCache = new Map();

async function callGeminiWorker(prompt) {
    try {
        const workerUrl = `${GEMINI_WORKER_URL}/?text=${encodeURIComponent(prompt)}`;
        const res = await axios.get(workerUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 25000
        });
        const candidate = res.data?.data?.candidates?.[0] || res.data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        let text = parts.map(p => p.text || '').join('').trim();
        if (text && text.length >= 25) {
            text = text.replace(/^#+\s+/gm, '')
                       .replace(/^\*\s+Sentence\s+\d+.*?:?\s*/gmi, '')
                       .replace(/^Sentence\s+\d+.*?:?\s*/gmi, '')
                       .trim();
            return { text, model: 'gemini-3.6-flash (Worker)' };
        }
    } catch (e) {
        console.warn("[GEMINI WORKER] Error:", e.message);
    }
    return null;
}

async function callGeminiDirect(key, model, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await axios.post(url, { 
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500
        }
    }, { timeout: 15000 });

    const candidate = response.data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let text = parts.map(p => p.text || '').join('').trim();
    if (text && text.length >= 25) {
        text = text.replace(/^#+\s+/gm, '')
                   .replace(/^\*\s+Sentence\s+\d+.*?:?\s*/gmi, '')
                   .replace(/^Sentence\s+\d+.*?:?\s*/gmi, '')
                   .trim();
        return { text, model };
    }
    throw new Error(`Empty response from ${model}`);
}

async function getGeminiSummary(movieTitle) {
    if (!movieTitle) return "";
    const cleanSearchTitle = movieTitle.split('|')[0]
        .replace(/sinhala subtitles|සිංහල උපසිරැසි|sinhala sub|subtitles/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    const cacheKey = cleanSearchTitle.toLowerCase();
    if (geminiSummaryCache.has(cacheKey)) {
        return geminiSummaryCache.get(cacheKey);
    }

    const prompt = `You are a cinema lover writing a short, exciting movie recommendation for a movie club in conversational spoken Sinhala (කතා කරන සරල සිංහල).

චිත්‍රපටය: "${cleanSearchTitle}"

කරුණාකර මෙම චිත්‍රපටය නැරඹීමට දැඩි ආශාවක් සහ කුතුහලයක් ඇතිවන පරිදි, අතිශය සිත් ඇදගන්නාසුලු, ලස්සන කතා කරන සිංහලෙන් කෙටි, පැහැදිලි සාරාංශයක් (Short & punchy 2-3 sentences overview) එකම ඡේදයකින් ලියන්න.

විශේෂ උපදෙස්:
1. දිග: වාක්‍ය 2 ත් 3 ත් අතර කෙටි සාරාංශයක් විය යුතුය (Short & crisp, 2-3 sentences max).
2. භාෂාව: මිත්‍රශීලී කතා කරන සිංහලෙන් ලියන්න. ආකර්ෂණීය emojis (🎬🍿✨🔥) 2-3 ක් යොදන්න.
3. අන්තර්ගතය: කතාවේ ප්‍රධාන සිදුවීම සහ කුතුහලය පමණක් කෙටියෙන් කියන්න. Spoilers කිසිවක් හෙළි නොකරන්න.
4. කිසිදු Heading, Bullet points, Numbers හෝ හැඳින්වීමක් ("මෙන්න සාරාංශය") නැතිව කෙටි සාරාංශය පමණක් කෙලින්ම ලබාදෙන්න.`;

    // Race Worker and Direct Gemini API keys in parallel for instant response
    const candidatePromises = [];

    // 1. Worker Promise
    candidatePromises.push(
        callGeminiWorker(prompt).then(res => {
            if (res?.text && res.text.length >= 25) return res;
            throw new Error("Worker empty/short text");
        })
    );

    // 2. Direct API keys across multiple models
    const effectiveKeys = GEMINI_KEYS.length > 0 ? GEMINI_KEYS : [];
    for (const k of effectiveKeys) {
        candidatePromises.push(callGeminiDirect(k, 'gemini-3.6-flash', prompt).catch(() => null));
        candidatePromises.push(callGeminiDirect(k, 'gemini-2.0-flash', prompt).catch(() => null));
        candidatePromises.push(callGeminiDirect(k, 'gemini-1.5-flash', prompt).catch(() => null));
    }

    try {
        const validPromises = candidatePromises.map(p => p.then(res => {
            if (res?.text && res.text.length >= 25) return res;
            throw new Error("Short text");
        }));
        const fastest = await Promise.any(validPromises);
        if (fastest?.text) {
            console.log(`[GEMINI] ✅ AI Summary generated with ${fastest.model}`);
            geminiSummaryCache.set(cacheKey, fastest.text);
            return fastest.text;
        }
    } catch (_) {}

    return "";
}

// ════════════════════════════════════════════════════════
// 🌐 1. CINESUBZ PURE NATIVE SCRAPER & DIRECT STREAM RESOLVER
// ════════════════════════════════════════════════════════
const KNOWN_CZ_SERVERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "45"];

function cleanCineTitle(str) {
    if (!str) return 'Untitled';
    return str
        .replace(/Sinhala Subtitles\s*\|\s*සිංහල උපසිරැසි සමඟ/gi, '')
        .replace(/\|\s*සිංහල උපසිරැසි සමඟ/gi, '')
        .replace(/\|.*$/i, '')
        .trim();
}

async function scrapeSearchDirect(query) {
    if (!query || typeof query !== 'string') return [];
    const cleanQ = query.split('|')[0]
        .replace(/sinhala subtitles|සිංහල උපසිරැසි|sinhala sub|subtitles/gi, '')
        .replace(/\b(19\d\d|20\d\d)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const queriesToTry = [query.trim()];
    if (cleanQ && cleanQ !== query.trim()) queriesToTry.push(cleanQ);

    const domainsToTry = [
        'https://cinesubz.net/?s=',
        'https://cinesubz.co/?s=',
        'https://cinesubz.lk/?s=',
        'https://r.jina.ai/https://cinesubz.net/?s='
    ];

    for (const q of queriesToTry) {
        for (const base of domainsToTry) {
            try {
                const searchUrl = `${base}${encodeURIComponent(q)}`;
                const res = await axios.get(searchUrl, {
                    headers: HEADERS,
                    timeout: 8000
                });
                const $ = cheerio.load(res.data);
                const results = [];
                const seen = new Set();

                $('.item-box').each((i, el) => {
                    const a = $(el).find('a').first();
                    const href = a.attr('href');
                    if (!href || seen.has(href)) return;
                    if (!href.includes('/movies/') && !href.includes('/tvshows/')) return;
                    seen.add(href);

                    let title = a.attr('title') || $(el).find('.title, h2, h3').text().trim() || '';
                    title = cleanCineTitle(title);

                    let img = $(el).find('img').attr('data-original') || 
                              $(el).find('img').attr('data-src') || 
                              $(el).find('img').attr('src') || '';
                    if (img && img.startsWith('//')) img = 'https:' + img;

                    const isTV = href.includes('/tvshows/') || (a.attr('data-ptype') === 'tvshows');
                    const imdb = $(el).find('.imdb, .imdb-score, .rating').text().trim() || 'N/A';

                    let year = 'N/A';
                    const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
                    if (yearMatch) year = yearMatch[1];

                    results.push({
                        title,
                        url: href,
                        img,
                        year,
                        imdb,
                        isTV,
                        source: 'cinesubz'
                    });
                });

                if (results.length > 0) return results;
            } catch (_) {}
        }
    }

    // Secondary Fallback: CZ2 API
    try {
        const cz2Res = await axios.get(`${CZ2_API}/search?q=${encodeURIComponent(cleanQ || query)}`, { timeout: 8000, headers: HEADERS });
        const list = cz2Res.data?.data || cz2Res.data?.result || [];
        if (list.length > 0) {
            return list.slice(0, 15).map(mv => ({
                title: cleanCineTitle(mv.title || mv.name || 'Movie'),
                url: mv.url || mv.link,
                img: mv.img || mv.image || '',
                year: mv.year || mv.date || 'N/A',
                imdb: mv.imdb || 'N/A',
                isTV: Boolean(mv.isTV || (mv.url && mv.url.includes('/tvshows/'))),
                source: 'cinesubz'
            }));
        }
    } catch (_) {}

    return [];
}

async function scrapeCineSubzDetails(pageUrl) {
    const res = await axios.get(pageUrl, {
        headers: { ...HEADERS, 'Referer': 'https://cinesubz.net/' },
        timeout: 25000
    });
    const $ = cheerio.load(res.data);

    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    title = cleanCineTitle(title)
        .replace(/Direct & Telegram Download Links/gi, '')
        .replace(/CineSubz.*$/gi, '')
        .trim();

    let poster = $('meta[property="og:image"]').attr('content') || 
                 $('img[class*="poster"]').attr('src') || 
                 $('.sheader .poster img').attr('src') || '';
    if (poster && poster.startsWith('//')) poster = 'https:' + poster;

    let synopsis = '';
    $('.entry-content p, .wp-content p, .sinopse p, .desc p').each((_, p) => {
        if (!synopsis) {
            const t = $(p).text().trim();
            if (t.length > 40 && !t.includes('Direct & Telegram') && !t.includes('CineSubz')) {
                synopsis = t;
            }
        }
    });

    const epLinks = [];
    $('a[href*="/episodes/"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !epLinks.some(e => e.href === href)) {
            let epText = $(el).text().trim().replace(/\s+/g, ' ');
            let numMatch = href.match(/(\d+)x(\d+)/i) || epText.match(/(\d+)\s+([A-Za-z0-9\s]+)/);
            let epLabel = epText || `Episode ${i + 1}`;
            if (numMatch && numMatch[1] && numMatch[2]) {
                epLabel = `S${numMatch[1].padStart(2, '0')} E${numMatch[2].padStart(2, '0')} - ${epText.split(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/)[0].trim()}`;
            }
            epLinks.push({
                title: epLabel.trim(),
                href: href
            });
        }
    });

    const isTV = epLinks.length > 0;

    const downloadQualities = [];
    $('.movie-download-button, a[href*="zt-links"], a[href*="/api-"]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const text = $(el).text().trim().replace(/\s+/g, ' ');

        let quality = 'HD';
        const qMatch = text.match(/(480p|720p|1080p|2160p|4k)/i);
        if (qMatch) quality = qMatch[1].toUpperCase();

        let size = 'Unknown';
        const sMatch = text.match(/([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB))/i);
        if (sMatch) size = sMatch[1].toUpperCase();

        let type = '';
        const tMatch = text.match(/(BluRay|WEBRip|WEB-DL|HDTC|HDRip)/i);
        if (tMatch) type = tMatch[1];

        let label = `🎥 ${quality} (${size})`;
        if (type) label = `🎥 ${quality} [${type}] (${size})`;

        downloadQualities.push({
            label,
            quality,
            size,
            type,
            ztUrl: href
        });
    });

    return {
        title,
        poster,
        synopsis,
        isTV,
        episodes: epLinks,
        downloadQualities
    };
}

async function resolveDirectVideo(ztUrl) {
    if (ztUrl.match(/\.(mp4|mkv)(\?|$)/i) && !ztUrl.includes('google.com/server') && !ztUrl.includes('cinesubz.net/api-')) {
        return { url: ztUrl, size: 0, server: 'direct', filename: path.basename(ztUrl.split('?')[0]) };
    }

    const res = await axios.get(ztUrl, {
        headers: { ...HEADERS, 'Referer': 'https://cinesubz.net/' },
        timeout: 20000
    });
    const $ = cheerio.load(res.data);
    const linkHref = $('#link').attr('href') || $('a#link').attr('href') || $('a[href*="server"]').attr('href');
    const prevLnk = $('a.prev-lnk').attr('href');

    let cz2Promise = null;
    if (prevLnk && (prevLnk.includes('/movies/') || prevLnk.includes('/episodes/'))) {
        cz2Promise = axios.get(`${CZ2_API}/dl-links?url=${encodeURIComponent(prevLnk)}`, { timeout: 12000, headers: HEADERS }).catch(() => null);
    }

    if (!linkHref) {
        if (cz2Promise) {
            const cz2Res = await cz2Promise;
            const links = cz2Res?.data?.downloadLinks || [];
            if (links.length > 0 && links[0].direct_mp4_url) {
                return { url: links[0].direct_mp4_url, size: 0, server: 'cz2', filename: path.basename(links[0].direct_mp4_url.split('?')[0]) };
            }
        }
        throw new Error("Download Redirect Link එක සොයා ගැනීමට නොහැකි විය.");
    }

    const m = linkHref.match(new RegExp('server(\\d+)/.*?([^/]+\\.(?:mp4|mkv))', 'i'));
    if (!m) {
        if (linkHref.startsWith('http') && !linkHref.includes('google.com')) {
            return { url: linkHref, size: 0, server: 'direct', filename: path.basename(linkHref) };
        }
        if (cz2Promise) {
            const cz2Res = await cz2Promise;
            const links = cz2Res?.data?.downloadLinks || [];
            if (links.length > 0 && links[0].direct_mp4_url) {
                return { url: links[0].direct_mp4_url, size: 0, server: 'cz2', filename: path.basename(links[0].direct_mp4_url.split('?')[0]) };
            }
        }
        throw new Error("Direct Download Link එක parse කරගත නොහැකි විය: " + linkHref);
    }

    const serverRaw = m[1];
    const rawFilename = decodeURIComponent(m[2]);
    const encodedFilename = encodeURIComponent(rawFilename);

    let primaryServer = serverRaw.padStart(2, '0');
    if (serverRaw === "11" || serverRaw === "12" || serverRaw === "13" || serverRaw === "1") primaryServer = "01";
    else if (serverRaw === "21" || serverRaw === "22" || serverRaw === "23" || serverRaw === "2") primaryServer = "02";
    else if (serverRaw === "4") primaryServer = "45";

    const serversToTry = [primaryServer, ...KNOWN_CZ_SERVERS.filter(s => s !== primaryServer)];

    // Parallel checks against wodocloud CDN servers with Range GET to eliminate cold start drops
    for (let i = 0; i < serversToTry.length; i += 3) {
        const batch = serversToTry.slice(i, i + 3);
        const checks = batch.map(async (s) => {
            const urlsToTry = [
                `https://cs${s}.wodocloud.xyz/${encodedFilename}?play=true`,
                `https://cs${s}.wodocloud.xyz/${encodeURI(rawFilename)}?play=true`
            ];
            for (const candidateUrl of urlsToTry) {
                try {
                    const probe = await axios.get(candidateUrl, {
                        headers: { ...HEADERS, 'Referer': 'https://cinesubz.net/', 'Range': 'bytes=0-100' },
                        timeout: 8000
                    });
                    if (probe.status === 200 || probe.status === 206) {
                        const ct = probe.headers['content-type'] || '';
                        const cr = probe.headers['content-range'] || '';
                        const cl = probe.headers['content-length'] || '0';
                        if (ct.includes('video') || cr.includes('/') || parseInt(cl, 10) > 1000000) {
                            return { url: candidateUrl, size: parseInt(cl, 10), server: s, filename: rawFilename };
                        }
                    }
                } catch (_) {}
            }
            return null;
        });
        const results = await Promise.all(checks);
        const found = results.find(r => r !== null);
        if (found) return found;
    }

    // Secondary fallback: CZ2 dl-links API
    if (cz2Promise) {
        const cz2Res = await cz2Promise;
        const links = cz2Res?.data?.downloadLinks || [];
        for (const item of links) {
            let u = item.direct_mp4_url || item.url || item.link;
            if (u && typeof u === 'string' && u.startsWith('http')) {
                return { url: u, size: 0, server: 'cz2', filename: rawFilename };
            }
        }
    }

    throw new Error("Direct Video Stream එක සොයා ගැනීමට නොහැකි විය.");
}

// ════════════════════════════════════════════════════════
// 🌐 2. SINHALASUB.LK NATIVE SCRAPER
// ════════════════════════════════════════════════════════
const SINHALASUB_BASE = 'https://sinhalasub.lk';
let cachedSinhalaSubNonce = 'b864bc047d';
let sinhalaSubNonceExpiry = 0;

async function getSearchNonce() {
    const now = Date.now();
    if (cachedSinhalaSubNonce && now < sinhalaSubNonceExpiry) return cachedSinhalaSubNonce;
    try {
        const res = await axios.get(SINHALASUB_BASE, { headers: HEADERS, timeout: 10000 });
        const match = res.data.match(/"nonce"\s*:\s*"([a-f0-9]+)"/i);
        if (match && match[1]) {
            cachedSinhalaSubNonce = match[1];
            sinhalaSubNonceExpiry = now + 10 * 60 * 1000;
            return cachedSinhalaSubNonce;
        }
    } catch (_) {}
    return cachedSinhalaSubNonce || 'b864bc047d';
}

async function searchSinhalasub(query) {
    const nonce = await getSearchNonce();
    const searchUrl = `${SINHALASUB_BASE}/wp-json/zetaflix/search/?keyword=${encodeURIComponent(query)}&nonce=${nonce}`;
    const res = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const data = res.data;
    if (!data || typeof data !== 'object' || data.error) return [];

    const results = [];
    for (const [id, item] of Object.entries(data)) {
        if (!item || !item.url) continue;
        let title = (item.title || '')
            .replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '')
            .replace(/Sinhala\s*Subtitles/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        results.push({
            id,
            title: title || item.title,
            url: item.url,
            type: item.type || (item.url.includes('/tvshows/') ? 'tvshows' : 'movies'),
            img: item.img || null,
            year: item.extra?.date || '',
            rating: item.extra?.imdb || '',
            quality: item.extra?.quality || '',
            genres: item.extra?.genres || '',
            source: 'sinhalasub2'
        });
    }
    return results;
}

async function getSinhalasubDetails(pageUrl) {
    const res = await axios.get(pageUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    let title = $('h1.entry-title, h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '').replace(/Sinhala\s*Subtitles/gi, '').trim();

    const poster = $("meta[property='og:image']").attr('content') || $('div.poster img, div.post-thumbnail img').first().attr('src');
    const desc = $('div.entry-content p, div.wp-content p, div.description p, .overview p').first().text().trim();
    const rating = $('span.rating, .imdb-rating, .starstruck-rating').first().text().trim();

    const downloadOptions = [];
    $('.links-table tr, table tr').each((i, row) => {
        const tableId = $(row).closest('table').attr('id') || 'Server';
        if (tableId.toLowerCase().includes('subtitle')) return;

        const quality = $(row).find('.zm-q').text().trim() || $(row).find('strong, .quality').text().trim() || 'Download';
        const size = $(row).find('.zm-m-size').text().trim();
        const a = $(row).find('a.zm-dl-btn, a');
        const link = a.attr('href');
        if (link && (link.includes('/links/') || link.includes('drive.google') || link.includes('pixeldrain'))) {
            downloadOptions.push({
                server: tableId,
                quality: quality,
                size: size || '',
                linkPageUrl: link
            });
        }
    });

    return { title, poster, rating, desc, downloadOptions };
}

async function getSinhalasubTvEpisodes(tvUrl) {
    const res = await axios.get(tvUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    let title = $('h1.entry-title, h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '').replace(/Sinhala\s*Subtitles/gi, '').trim();
    const poster = $("meta[property='og:image']").attr('content') || $('div.poster img, div.post-thumbnail img').first().attr('src');

    const episodes = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (href.includes('/episodes/') && !episodes.some(e => e.url === href)) {
            episodes.push({
                title: text || `Episode ${episodes.length + 1}`,
                url: href
            });
        }
    });

    return { title, poster, episodes };
}

async function resolveSinhalasubLink(linkPageUrl) {
    if (linkPageUrl.includes('drive.google.com') || linkPageUrl.includes('pixeldrain.com/api/file/')) {
        return linkPageUrl;
    }
    const res = await axios.get(linkPageUrl, { headers: HEADERS, timeout: 15000 });
    const match = res.data.match(/var\s+zluFinalLink\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        let finalUrl = match[1].trim();
        if (finalUrl.includes('pixeldrain.com/u/')) {
            finalUrl = finalUrl.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
        }
        return finalUrl;
    }
    return linkPageUrl;
}

// ════════════════════════════════════════════════════════
// 🌐 3. THENKIRI KDRAMA SCRAPER
// ════════════════════════════════════════════════════════
const THENKIRI_BASE = 'https://thenkiri.com';

async function searchThenkiri(query) {
    const res = await axios.get(`${THENKIRI_BASE}/?s=${encodeURIComponent(query)}`, {
        headers: HEADERS,
        timeout: 20000,
        httpsAgent
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('article, .entry, .post').each((i, el) => {
        const titleEl = $(el).find('.entry-title a, h2 a, h3 a, .post-title a').first();
        let title = titleEl.text().replace(/^DOWNLOAD\s+/i, '').trim();
        let link = titleEl.attr('href');
        let img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');

        if (!title) {
            const a = $(el).find('a').first();
            title = a.text().replace(/^DOWNLOAD\s+/i, '').trim();
            link = a.attr('href');
        }

        if (title && link && link.includes('thenkiri.com') && !results.some(r => r.url === link)) {
            if (!link.includes('/category/') && !link.includes('/tag/') && !link.includes('/author/')) {
                results.push({ title, url: link, img, source: 'kdrama' });
            }
        }
    });

    return results;
}

async function getThenkiriDetails(pageUrl) {
    const res = await axios.get(pageUrl, { headers: HEADERS, timeout: 20000, httpsAgent });
    const $ = cheerio.load(res.data);

    const title = $('h1.entry-title, h1').first().text().replace(/^DOWNLOAD\s+/i, '').trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('article img, .entry-content img').first().attr('src') || '';

    const downloads = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('downloadwella.com') || href.endsWith('.mkv') || href.endsWith('.mp4')) {
            downloads.push({
                meta: text || `Episode ${downloads.length + 1}`,
                resolvedUrl: href,
                direct: href.endsWith('.mkv') || href.endsWith('.mp4')
            });
        }
    });

    return { title, poster, downloads };
}

async function getDirectLinkThenkiri(dlLink, browserUa) {
    if (!dlLink) return null;
    if (dlLink.endsWith('.mkv') || dlLink.endsWith('.mp4')) return dlLink;

    if (dlLink.includes('downloadwella.com')) {
        try {
            const page1 = await axios.get(dlLink, {
                headers: { 'User-Agent': browserUa || HEADERS['User-Agent'] },
                httpsAgent,
                timeout: 20000
            });
            const $1 = cheerio.load(page1.data);
            const formData = {};
            $1('form').first().find('input[type="hidden"]').each((i, el) => {
                formData[$1(el).attr('name')] = $1(el).attr('value');
            });
            $1('form').first().find('input[type="submit"], button[type="submit"]').each((i, el) => {
                const n = $1(el).attr('name');
                const v = $1(el).attr('value');
                if (n) formData[n] = v;
            });

            const page2 = await axios.post(dlLink, qs.stringify(formData), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': dlLink,
                    'User-Agent': browserUa || HEADERS['User-Agent']
                },
                httpsAgent,
                timeout: 20000
            });
            const $2 = cheerio.load(page2.data);
            let direct = $2('a').filter((i, el) => $2(el).text().trim() === 'Start download').attr('href');
            if (!direct) {
                direct = $2('.btn-success').attr('href') || $2('a[href*=".mkv"]').attr('href') || $2('a[href*=".mp4"]').attr('href');
            }
            return direct || null;
        } catch (e) {
            console.error("[KDrama Scraper] Bypass error:", e.message);
            return null;
        }
    }
    return dlLink;
}

// ════════════════════════════════════════════════════════
// 🌐 4. ANIMOSTLK SCRAPER
// ════════════════════════════════════════════════════════
const ANIMOST_BASE = 'https://animostlk.blogspot.com';

async function searchAnimost(query) {
    const feedUrl = `${ANIMOST_BASE}/feeds/posts/default?alt=json&q=${encodeURIComponent(query)}&max-results=15`;
    const res = await axios.get(feedUrl, { headers: HEADERS, timeout: 15000 });
    const entries = res.data?.feed?.entry || [];
    const results = [];

    for (const e of entries) {
        const title = e.title?.$t?.trim() || 'Untitled Anime';
        const postUrl = e.link?.find(l => l.rel === 'alternate')?.href || '';
        let thumbnail = null;
        if (e['media$thumbnail'] && e['media$thumbnail'].url) {
            thumbnail = e['media$thumbnail'].url.replace(/\/s[0-9]+(-c)?\//, '/w600-h340/');
        }
        results.push({
            title,
            url: postUrl,
            img: thumbnail || 'https://animostlk.blogspot.com/favicon.ico',
            source: 'animost'
        });
    }
    return results;
}

async function getAnimostDownloadOptions(postUrl) {
    const res = await axios.get(postUrl, { headers: HEADERS, timeout: 15000 });
    const htmlContent = res.data;
    const $ = cheerio.load(htmlContent);
    const options = [];

    const foundUrls = new Set();
    $('a').each((i, el) => {
        const h = $(el).attr('href');
        if (h) foundUrls.add(h);
    });

    const rawMatches = htmlContent.match(/https?:\/\/[^\s"\'<>]+/g) || [];
    for (const r of rawMatches) foundUrls.add(r);

    for (let u of foundUrls) {
        u = u.replace(/&amp;/g, '&');
        if (u.includes('animostlk.sinhalachr.workers.dev')) {
            try {
                const wRes = await axios.get(u, { headers: HEADERS, timeout: 10000 });
                const w$ = cheerio.load(wRes.data);
                const title = w$('title').text().replace(/[-–—]\s*ANIMOSTLK/i, '').trim();
                let streamUrl = w$('source').attr('src');
                if (!streamUrl) {
                    const sm = wRes.data.match(/https?:\/\/prod\.playbookstatic\.com[^\s"\'<>]+/);
                    if (sm) streamUrl = sm[0];
                }
                if (streamUrl) {
                    options.push({
                        meta: title || 'Episode Stream',
                        resolvedUrl: streamUrl,
                        direct: true
                    });
                }
            } catch (_) {}
        } else if (u.endsWith('.mp4') || u.endsWith('.mkv')) {
            options.push({
                meta: path.basename(u),
                resolvedUrl: u,
                direct: true
            });
        }
    }

    const poster = $("meta[property='og:image']").attr('content') || $('article img').first().attr('src') || '';
    return { poster, downloads: options };
}

// ════════════════════════════════════════════════════════
// 🌐 5. PIRATELK SCRAPER
// ════════════════════════════════════════════════════════
const PIRATELK_BASE = 'https://piratelk.com';

async function searchPirateLK(query) {
    const searchUrl = `${PIRATELK_BASE}/?s=${encodeURIComponent(query)}`;
    const searchResults = [];
    const seenUrls = new Set();

    try {
        const res = await axios.get(searchUrl, { headers: HEADERS, timeout: 8000 });
        const $ = cheerio.load(res.data);

        $('article, .post, .result-item, .item, .entry').each((i, el) => {
            let titleEl = $(el).find('h2.post-box-title a, h2.entry-title a, h2 a, h3 a, .entry-title a, .title a').first();
            let title = titleEl.text().replace(/^DOWNLOAD\s+/i, '').trim();
            let link = titleEl.attr('href');
            let img = $(el).find('.post-thumbnail img, img').first().attr('data-src') || 
                      $(el).find('.post-thumbnail img, img').first().attr('src') ||
                      $(el).find('img').first().attr('data-lazy-src');
            if (img && img.startsWith('data:')) img = null;

            if (!title) {
                $(el).find('a').each((_, aEl) => {
                    const txt = $(aEl).text().replace(/^DOWNLOAD\s+/i, '').trim();
                    const hr = $(aEl).attr('href');
                    if (txt && hr && hr.includes('piratelk.com') && !hr.includes('/category/') && !hr.includes('/tag/') && !title) {
                        title = txt;
                        link = hr;
                    }
                });
            }

            if (title && link && link.includes('piratelk.com') && !seenUrls.has(link)) {
                if (!link.includes('/category/') && !link.includes('/tag/') && !link.includes('/author/')) {
                    seenUrls.add(link);
                    searchResults.push({ title, url: link, img, source: 'piratelk' });
                }
            }
        });
    } catch (_) {}

    // Fallback: Jina AI bypass for Cloudflare protection on piratelk.com
    if (searchResults.length === 0) {
        try {
            const jinaRes = await axios.get(`https://r.jina.ai/${searchUrl}`, { timeout: 15000 });
            const md = typeof jinaRes.data === 'string' ? jinaRes.data : '';
            const lines = md.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('## [')) {
                    const m = line.match(/^##\s*\[(.*)\]\((https:\/\/piratelk\.com\/[^\s\)]+)/i);
                    if (m) {
                        const rawTitle = m[1];
                        const url = m[2];
                        if (url.includes('/wp-content/')) continue;
                        if (!seenUrls.has(url) && !url.includes('/category/') && !url.includes('/tag/') && !url.includes('/author/')) {
                            seenUrls.add(url);
                            const title = rawTitle.replace(/^DOWNLOAD\s+/i, '').replace(/\|\s*.*$/i, '').trim();
                            let img = '';
                            for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
                                const imgM = lines[j].match(/\((https:\/\/piratelk\.com\/wp-content\/uploads\/[^\s\)]+)\)/i);
                                if (imgM) {
                                    img = imgM[1];
                                    break;
                                }
                            }
                            searchResults.push({ title, url, img, source: 'piratelk' });
                        }
                    }
                }
            }
        } catch (jinaErr) {
            console.error("[PIRATELK JINA SEARCH ERROR]:", jinaErr.message);
        }
    }

    return searchResults;
}

function extractGdriveFileId(url) {
    if (!url) return null;
    if (url.includes('/drive/folders/') || url.includes('/folders/')) return null;
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) || 
              url.match(/[?&]id=([a-zA-Z0-9_-]+)/i) || 
              url.match(/\/open\?id=([a-zA-Z0-9_-]+)/i) ||
              url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/i) ||
              url.match(/\/d\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
}

async function getPirateLKDetails(pageUrl) {
    let title = 'Movie';
    let poster = '';
    const downloadLinks = [];
    const seenUrls = new Set();

    try {
        const res = await axios.get(pageUrl, { headers: HEADERS, timeout: 8000 });
        const $ = cheerio.load(res.data);

        title = $('h1.entry-title, h1.post-title, h1').first().text().replace(/^DOWNLOAD\s+/i, '').trim();
        poster = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        if (!poster || poster.startsWith('data:')) {
            $('article img, .entry-content img, .post-thumbnail img').each((i, el) => {
                if (poster && !poster.startsWith('data:')) return;
                const candidate = $(el).attr('data-src') || $(el).attr('src');
                if (candidate && !candidate.startsWith('data:') && !candidate.includes('logo')) poster = candidate;
            });
        }

        $('a').each((i, el) => {
            let href = $(el).attr('href') || '';
            const linkText = $(el).text().trim();
            const parentText = $(el).parent().text().trim();
            const lowerHref = href.toLowerCase();

            // 🚫 Strictly exclude UsersDrive per user request
            if (lowerHref.includes('usersdrive') || lowerHref.includes('userdrive') || linkText.toLowerCase().includes('usersdrive') || parentText.toLowerCase().includes('usersdrive')) return;

            const isDlHost = lowerHref.includes('pixeldrain.com') || 
                             lowerHref.includes('drive.google.com') || 
                             lowerHref.includes('racaty.net') || 
                             lowerHref.includes('mega.nz') ||
                             lowerHref.endsWith('.mp4') || lowerHref.endsWith('.mkv');

            if (isDlHost && !seenUrls.has(href)) {
                seenUrls.add(href);
                let qMatch = (linkText + ' ' + parentText + ' ' + href).match(/(480p|720p|1080p|2160p|4k)/i);
                let sMatch = (linkText + ' ' + parentText).match(/([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB))/i);
                let host = lowerHref.includes('pixeldrain') ? 'PixelDrain' :
                           lowerHref.includes('racaty') ? 'Racaty' :
                           lowerHref.includes('drive.google') ? 'GDrive' : 'Download';
                let label = qMatch ? qMatch[1].toUpperCase() : 'HD';
                if (sMatch) label += ` (${sMatch[1].toUpperCase()})`;
                label += ` [${host}]`;

                downloadLinks.push({
                    meta: label,
                    resolvedUrl: href,
                    direct: true
                });
            }
        });
    } catch (_) {}

    // Fallback: Jina AI bypass for Cloudflare
    if (downloadLinks.length === 0) {
        try {
            const jinaRes = await axios.get(`https://r.jina.ai/${pageUrl}`, { timeout: 15000 });
            const md = typeof jinaRes.data === 'string' ? jinaRes.data : '';

            const titleMatch = md.match(/Title:\s*(.+)/i) || md.match(/#\s*(.+)/);
            if (titleMatch) title = titleMatch[1].replace(/\|\s*.*$/i, '').trim();

            const posterMatch = md.match(/\((https:\/\/piratelk\.com\/wp-content\/uploads\/[^\s\)]+)\)/i);
            if (posterMatch && !poster) poster = posterMatch[1];

            const links = [...md.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g)];
            for (const l of links) {
                let text = l[1].trim();
                let href = l[2].trim();
                const lowerHref = href.toLowerCase();

                if (lowerHref.includes('#') || lowerHref.includes('/category/') || lowerHref.includes('/tag/') || lowerHref.includes('piratelk.com/download/')) continue;
                // 🚫 Strictly exclude UsersDrive
                if (lowerHref.includes('usersdrive') || lowerHref.includes('userdrive') || text.toLowerCase().includes('usersdrive')) continue;

                const isDlHost = lowerHref.includes('pixeldrain.com') || 
                                 lowerHref.includes('drive.google.com') || 
                                 lowerHref.includes('racaty.net') || 
                                 lowerHref.includes('mega.nz') ||
                                 lowerHref.endsWith('.mp4') || lowerHref.endsWith('.mkv');

                if (isDlHost && !seenUrls.has(href)) {
                    seenUrls.add(href);
                    let qMatch = (text + ' ' + href).match(/(480p|720p|1080p|2160p|4k)/i);
                    let sMatch = text.match(/([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB))/i);
                    let host = lowerHref.includes('pixeldrain') ? 'PixelDrain' :
                               lowerHref.includes('racaty') ? 'Racaty' :
                               lowerHref.includes('drive.google') ? 'GDrive' : 'Download';
                    let label = qMatch ? qMatch[1].toUpperCase() : 'HD';
                    if (sMatch) label += ` (${sMatch[1].toUpperCase()})`;
                    label += ` [${host}]`;

                    downloadLinks.push({
                        meta: label,
                        resolvedUrl: href,
                        direct: true
                    });
                }
            }
        } catch (jErr) {
            console.error("[PIRATELK JINA DETAILS ERROR]:", jErr.message);
        }
    }

    return { title, poster, downloads: downloadLinks };
}

// ════════════════════════════════════════════════════════
// 🌐 6. HELAFLIX SCRAPER
// ════════════════════════════════════════════════════════
let helaFeedCache = null;
let helaCacheTime = 0;

async function getHelaflixPosts(query) {
    const cleanQuery = (query || '').trim();
    let url;
    if (cleanQuery && cleanQuery.toLowerCase() !== 'all') {
        url = `https://helaflix.blogspot.com/feeds/posts/default?alt=json&q=${encodeURIComponent(cleanQuery)}&max-results=15`;
    } else {
        url = `https://helaflix.blogspot.com/feeds/posts/default?alt=json&max-results=15`;
    }
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const entries = res.data?.feed?.entry || [];
    return entries.map(e => {
        const title = e.title?.$t?.trim() || 'Untitled';
        const postUrl = e.link?.find(l => l.rel === 'alternate')?.href || '';
        let thumbnail = e['media$thumbnail']?.url?.replace(/\/s[0-9]+(-c)?\//, '/w600-h340/') || '';
        return {
            title,
            url: postUrl,
            img: thumbnail || 'https://helaflix.blogspot.com/favicon.ico',
            source: 'helaflix'
        };
    });
}

async function resolveUniversalDownloadHela(bridgeUrl) {
    if (!bridgeUrl) return null;
    try {
        const now = Date.now();
        if (!helaFeedCache || (now - helaCacheTime) > 10 * 60 * 1000) {
            const fRes = await axios.get('https://helaflixdownload.blogspot.com/feeds/posts/default?alt=json&max-results=100', { headers: HEADERS, timeout: 15000 });
            helaFeedCache = fRes.data?.feed?.entry || [];
            helaCacheTime = now;
        }

        const slug = bridgeUrl.split('/').pop().replace('.html', '').toLowerCase();
        let matched = helaFeedCache.find(e => {
            const altHref = e.link?.find(l => l.rel === 'alternate')?.href || '';
            return altHref.toLowerCase().includes(`/${slug}.html`) || altHref.toLowerCase().endsWith(`/${slug}`);
        });

        let content = matched ? matched.content?.$t : '';
        if (!content) {
            const liveRes = await axios.get(`https://helaflixdownload.blogspot.com/feeds/posts/default?alt=json&q=${encodeURIComponent(slug)}`, { headers: HEADERS, timeout: 10000 });
            const liveEntries = liveRes.data?.feed?.entry || [];
            if (liveEntries.length > 0) content = liveEntries[0].content?.$t || '';
        }

        if (content) {
            const mReal = content.match(/REAL_DOWNLOAD_FILE_LINK\s*=\s*['"]([^'"]+)['"]/i);
            const mTarget = content.match(/REAL_TARGET_URL\s*=\s*['"]([^'"]+)['"]/i);
            const linkStr = (mReal ? mReal[1] : '') + ' ' + (mTarget ? mTarget[1] : '');
            const idMatch = linkStr.match(/[?&]id=([a-zA-Z0-9_-]{25,})/) || content.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
            if (idMatch) {
                return { downloadUrl: `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&authuser=0` };
            }
            if (mReal && mReal[1] && !mReal[1].includes('REAL_MOVIE_DOWNLOAD_LINK_HERE')) {
                return { downloadUrl: mReal[1].trim() };
            }
        }
    } catch (_) {}
    return { downloadUrl: bridgeUrl };
}

// ════════════════════════════════════════════════════════
// 🌐 7. CARTOONS SCRAPER (SINHALACARTOONS & CARTOONS.LK)
// ════════════════════════════════════════════════════════
function decodeScData(rawScData) {
    if (!rawScData) return null;
    try {
        let base64 = rawScData.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
        return JSON.parse(jsonStr);
    } catch (_) {
        return null;
    }
}

async function searchSinhalaCartoons(query) {
    try {
        const cleanQuery = (query || '').trim();
        const url = !cleanQuery || cleanQuery.toLowerCase() === 'all'
            ? 'https://sinhalacartoons.com/wp-json/wp/v2/posts?per_page=20&_embed'
            : `https://sinhalacartoons.com/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanQuery)}&per_page=20&_embed`;
        const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        if (Array.isArray(res.data)) {
            return res.data.map(post => {
                let title = (post.title?.rendered || 'Untitled')
                    .replace(/&#8217;/g, "'")
                    .replace(/&#8216;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#038;/g, '&');
                let img = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                          post.featured_media_src_url || 
                          '';
                return {
                    title,
                    url: post.link,
                    img,
                    source: 'slcartoons'
                };
            });
        }
    } catch (e) {
        console.warn("[SINHALACARTOONS SEARCH ERROR]:", e.message);
    }
    return [];
}

async function getSinhalaCartoonsDetails(postUrl) {
    const res = await axios.get(postUrl, { headers: HEADERS, timeout: 15000 });
    const html = res.data;
    const $ = cheerio.load(html);

    let title = $('h1.movie-title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    title = title.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'");

    const image = $('.info-poster img').attr('src') || $('meta[property="og:image"]').attr('content') || '';
    const isSeries = $('.episode-row').length > 0;

    const downloads = [];
    if (isSeries) {
        $('.episode-row').each((i, el) => {
            const rawDlUrl = $(el).attr('data-download-url') || '';
            const epNum = $(el).find('.ep-number').text().trim() || `${i + 1}`;
            let directDownload = '';
            let epTitle = '';
            const scMatch = rawDlUrl.match(/sc_data=([^"'\s&]+)/);
            if (scMatch) {
                const parsed = decodeScData(scMatch[1]);
                if (parsed) {
                    directDownload = parsed.direct || '';
                    epTitle = parsed.title || '';
                }
            }
            if (directDownload) {
                downloads.push({
                    meta: epTitle || `Episode ${epNum}`,
                    resolvedUrl: directDownload,
                    direct: true
                });
            }
        });
    } else {
        const seenUrls = new Set();
        // 1. Direct sc_data button or regex in HTML
        const scBtn = $('.sc-download-links-btn').attr('href') || '';
        const scMatch = (scBtn + ' ' + html).match(/sc_data=([^"'\s&]+)/);
        if (scMatch) {
            const parsed = decodeScData(scMatch[1]);
            if (parsed && parsed.direct && !seenUrls.has(parsed.direct)) {
                seenUrls.add(parsed.direct);
                downloads.push({
                    meta: parsed.title || 'Direct HD Download',
                    resolvedUrl: parsed.direct,
                    direct: true
                });
            }
        }

        // 2. Video player sources & iframes
        const playerSources = [
            $('#mainPlayer source').attr('src'),
            $('#mainPlayer').attr('src'),
            $('video source').attr('src'),
            $('video').attr('src'),
            $('iframe#mainPlayer').attr('src'),
            $('.video-container iframe').attr('src'),
            $('.player-container iframe').attr('src')
        ];
        for (const pSrc of playerSources) {
            if (pSrc && pSrc.startsWith('http') && !seenUrls.has(pSrc)) {
                seenUrls.add(pSrc);
                downloads.push({
                    meta: 'Direct Player Stream HD',
                    resolvedUrl: pSrc,
                    direct: true
                });
            }
        }

        // 3. Direct download buttons and links
        $('a').each((i, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim() || 'Download HD';
            const lowerHref = href.toLowerCase();
            if (!href.startsWith('http')) return;

            const isDlLink = lowerHref.includes('pixeldrain.com') ||
                             lowerHref.includes('drive.google.com') ||
                             lowerHref.includes('mega.nz') ||
                             lowerHref.includes('cloud.sinhalachr.workers.dev') ||
                             lowerHref.includes('animostlk.sinhalachr.workers.dev') ||
                             lowerHref.endsWith('.mp4') || lowerHref.endsWith('.mkv') ||
                             lowerHref.includes('sc_data=');

            if (isDlLink && !seenUrls.has(href)) {
                seenUrls.add(href);
                let finalHref = href;
                if (href.includes('sc_data=')) {
                    const scM = href.match(/sc_data=([^"'\s&]+)/);
                    if (scM) {
                        const parsed = decodeScData(scM[1]);
                        if (parsed?.direct) finalHref = parsed.direct;
                    }
                }
                let label = text;
                if (!label || label.length > 50) {
                    if (lowerHref.includes('pixeldrain')) label = 'PixelDrain HD';
                    else if (lowerHref.includes('drive.google')) label = 'GDrive HD';
                    else if (lowerHref.includes('mega')) label = 'Mega HD';
                    else label = 'Direct HD Download';
                }
                downloads.push({
                    meta: label,
                    resolvedUrl: finalHref,
                    direct: true
                });
            }
        });

        // 4. Script matches for video streams
        if (downloads.length === 0) {
            const scriptMatches = [...html.matchAll(/(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+\.(?:mp4|mkv)[^"']*)["']/gi)];
            for (const sm of scriptMatches) {
                const sUrl = sm[1];
                if (sUrl && !seenUrls.has(sUrl)) {
                    seenUrls.add(sUrl);
                    downloads.push({
                        meta: 'HD Direct Stream',
                        resolvedUrl: sUrl,
                        direct: true
                    });
                }
            }
        }
    }

    return { title, poster: image, isSeries, downloads };
}

async function searchCartoonsLk(query) {
    const cleanQuery = (query || '').trim();
    try {
        const url = !cleanQuery || cleanQuery.toLowerCase() === 'all'
            ? 'https://cartoons.lk/wp-json/wp/v2/posts?per_page=20&_embed'
            : `https://cartoons.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(cleanQuery)}&_embed`;
        const res = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        if (Array.isArray(res.data) && res.data.length > 0) {
            return res.data.map(p => {
                const fullTitle = p.title?.rendered || 'Untitled';
                const title = fullTitle.replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                const img = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || p.featured_media_src_url || '';
                return {
                    title,
                    url: p.link,
                    img,
                    source: 'cartoonslk'
                };
            });
        }
    } catch (_) {}

    try {
        const searchRes = await axios.get(`https://cartoons.lk/?s=${encodeURIComponent(cleanQuery)}`, { headers: HEADERS, timeout: 20000 });
        const $ = cheerio.load(searchRes.data);
        const results = [];
        const seen = new Set();
        $('article, .post, .item, .entry, .card').each((i, el) => {
            const a = $(el).find('a').first();
            const href = a.attr('href');
            if (!href || seen.has(href)) return;
            seen.add(href);
            let rawTitle = $(el).find('h2, h3, .title, .entry-title').text().trim() || a.attr('title') || '';
            if (!rawTitle) return;
            let img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
            results.push({
                title: rawTitle.replace(/&#8217;/g, "'").replace(/&amp;/g, '&'),
                url: href,
                img,
                source: 'cartoonslk'
            });
        });
        return results;
    } catch (_) {
        return [];
    }
}

async function getCartoonsLkDetails(pageUrl) {
    const res = await axios.get(pageUrl, { headers: HEADERS, timeout: 25000 });
    const html = res.data;
    const $ = cheerio.load(html);

    const mNonce = html.match(/nonce:\s*["']([a-zA-Z0-9]+)["']/i);
    const nonce = mNonce ? mNonce[1] : null;

    let postId = $('.movie-download-container').attr('data-post-id') ||
                 $('button.direct-download-btn').first().attr('data-post-id') ||
                 $('button[data-post-id]').first().attr('data-post-id');
    if (!postId) {
        const mEpId = html.match(/id=["']episodes-data-(\d+)["']/i);
        if (mEpId) postId = mEpId[1];
    }
    if (!postId) {
        const mSeries = html.match(/data-cl-series=["'](\d+)["']/i);
        if (mSeries) postId = mSeries[1];
    }
    if (!postId) {
        const mPostId = html.match(/data-post-id=["'](\d+)["']/i) || html.match(/post-(\d+)/i);
        if (mPostId) postId = mPostId[1];
    }

    const title = $('h1').text().trim() || $('title').text().trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('.movie-poster img, .entry-content img').first().attr('src') || '';

    const epScript = $(`script[id^="episodes-data-"]`);
    let isSeries = false;
    let downloads = [];

    if (epScript.length > 0) {
        try {
            const episodes = JSON.parse(epScript.html());
            if (Array.isArray(episodes) && episodes.length > 0) {
                isSeries = episodes.length > 1;
                downloads = episodes.map((ep, idx) => ({
                    meta: ep.title || (isSeries ? `Episode ${idx + 1}` : (ep.resolution || 'HD Download')),
                    resolvedUrl: `cartoonslk://${postId}?nonce=${nonce || ''}&type=episode&episodeIndex=${idx}&linkIndex=0&pageUrl=${encodeURIComponent(pageUrl)}`,
                    direct: false
                }));
            }
        } catch (_) {}
    }

    if (!isSeries && downloads.length === 0) {
        $('button.direct-download-btn, a.direct-download-btn, [data-action-type="download"]').each((i, el) => {
            const pId = $(el).attr('data-post-id') || postId;
            const lIndex = $(el).attr('data-link-index') || '0';
            let label = $(el).text().trim() || 'HD Download';
            downloads.push({
                meta: label,
                resolvedUrl: `cartoonslk://${pId}?nonce=${nonce || ''}&type=single&linkIndex=${lIndex}&pageUrl=${encodeURIComponent(pageUrl)}`,
                direct: false
            });
        });
        if (downloads.length === 0 && postId) {
            downloads.push({
                meta: 'Direct HD Download',
                resolvedUrl: `cartoonslk://${postId}?nonce=${nonce || ''}&type=single&linkIndex=0&pageUrl=${encodeURIComponent(pageUrl)}`,
                direct: false
            });
        }
    }

    return { title, poster, isSeries, downloads };
}

async function resolveCartoonsLkStream({ pageUrl, postId, nonce, type, episodeIndex, linkIndex }) {
    if (!nonce || !postId) {
        const pageRes = await axios.get(pageUrl, { headers: HEADERS, timeout: 20000 });
        const m = pageRes.data.match(/nonce:\s*["']([a-zA-Z0-9]+)["']/i);
        if (m) nonce = m[1];
        if (!postId) {
            const mPost = pageRes.data.match(/id=["']episodes-data-(\d+)["']/i) ||
                          pageRes.data.match(/data-cl-series=["'](\d+)["']/i) ||
                          pageRes.data.match(/data-post-id=["'](\d+)["']/i);
            if (mPost) postId = mPost[1];
        }
    }
    const params = new URLSearchParams();
    params.append('action', 'get_movie_link');
    params.append('nonce', nonce || '');
    params.append('post_id', postId || '');
    params.append('type', type || 'single');
    params.append('action_type', 'download');
    if (type === 'episode') {
        params.append('episode_index', String(episodeIndex !== undefined ? episodeIndex : 0));
    }
    params.append('link_index', String(linkIndex !== undefined ? linkIndex : 0));

    let ajaxRes;
    try {
        ajaxRes = await axios.post('https://cartoons.lk/wp-admin/admin-ajax.php', params.toString(), {
            headers: {
                ...HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Referer': pageUrl,
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 25000
        });
    } catch (err) {
        // Retry once with a fresh nonce in case of timeout or stale nonce
        try {
            const pageRes = await axios.get(pageUrl, { headers: HEADERS, timeout: 20000 });
            const m = pageRes.data.match(/nonce:\s*["']([a-zA-Z0-9]+)["']/i);
            if (m) {
                params.set('nonce', m[1]);
                ajaxRes = await axios.post('https://cartoons.lk/wp-admin/admin-ajax.php', params.toString(), {
                    headers: {
                        ...HEADERS,
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Referer': pageUrl,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    timeout: 25000
                });
            }
        } catch (_) {}
    }

    let dlUrl = ajaxRes?.data?.data?.url;
    if (!dlUrl) {
        // Also try switching type between single and episode as fallback
        const altType = type === 'episode' ? 'single' : 'episode';
        params.set('type', altType);
        try {
            const altRes = await axios.post('https://cartoons.lk/wp-admin/admin-ajax.php', params.toString(), {
                headers: {
                    ...HEADERS,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Referer': pageUrl,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 20000
            });
            dlUrl = altRes?.data?.data?.url;
        } catch (_) {}
    }

    if (!dlUrl) throw new Error("Cartoons.lk did not return a download url");

    // Follow 302 redirect to Cloudflare worker or final download link
    try {
        const headRes = await axios.get(dlUrl, {
            headers: { ...HEADERS, 'Referer': pageUrl || 'https://cartoons.lk/' },
            maxRedirects: 0,
            validateStatus: () => true,
            timeout: 15000
        });
        const redirLoc = headRes.headers.location || (headRes.headers.get ? headRes.headers.get('location') : null);
        let finalResolved = redirLoc || dlUrl;
        if (finalResolved && finalResolved.includes('pixeldrain.com/u/')) {
            finalResolved = finalResolved.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
        }
        return finalResolved;
    } catch (_) {
        if (dlUrl && dlUrl.includes('pixeldrain.com/u/')) {
            dlUrl = dlUrl.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
        }
        return dlUrl;
    }
}

// ════════════════════════════════════════════════════════
// ⚡ WARMUP & SOCKET HELPERS
// ════════════════════════════════════════════════════════
async function warmGroupSession() {
    try {
        const sock = getActiveSocket(FALLBACK_BOT_NUMBER);
        if (sock && !sock._groupWarmed) {
            console.log(`[WARMUP] ⚡ Pre-warming group session for ${FALLBACK_GROUP_JID}...`);
            if (typeof sock.groupMetadata === 'function') {
                await sock.groupMetadata(FALLBACK_GROUP_JID).catch(() => {});
            }
            if (typeof sock.sendPresenceUpdate === 'function') {
                await sock.sendPresenceUpdate('available', FALLBACK_GROUP_JID).catch(() => {});
            }
            sock._groupWarmed = true;
            console.log(`[WARMUP] ✅ Group session warm & Signal ratchets ready!`);
        }
    } catch(e) {}
}

function warmApis() {
    axios.get(`${CZ2_API}/search?q=batman`, { timeout: 8000, headers: HEADERS }).catch(() => {});
    warmGroupSession();
}
warmApis();
setInterval(warmApis, 90 * 1000);

function getActiveSocket(targetBotNumber) {
    const activeSockets = global.activeSockets;
    if (!activeSockets || activeSockets.size === 0) return null;
    const cleanNum = targetBotNumber ? String(targetBotNumber).replace(/[^0-9]/g, '') : '';
    const cleanFallback = FALLBACK_BOT_NUMBER.replace(/[^0-9]/g, '');
    const sessionData = (cleanNum && activeSockets.get(cleanNum)) || activeSockets.get(cleanFallback) || Array.from(activeSockets.values())[0];
    return sessionData?.socket || sessionData;
}

async function getReadySocket(targetBotNumber, maxWaitMs = 15000) {
    const start = Date.now();
    let sock = getActiveSocket(targetBotNumber);
    if (sock && sock.user) return sock;
    console.log(`[SOCKET] ⏳ Waiting for WhatsApp socket to become ready...`);
    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, 1000));
        sock = getActiveSocket(targetBotNumber);
        if (sock && sock.user) {
            console.log(`[SOCKET] ✅ WhatsApp socket is now ready!`);
            return sock;
        }
    }
    return sock;
}

async function sendMediaSafely(sock, jid, msgParams, timeoutMs = 60000, options = {}) {
    if (!sock) throw new Error("WhatsApp socket not available");
    try {
        const finalOptions = { quoted: shonux, ...options };
        const sendPromise = sock.sendMessage(jid, msgParams, finalOptions);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload Timeout")), timeoutMs));
        return await Promise.race([sendPromise, timeoutPromise]);
    } catch (error) {
        throw error;
    }
}

// ════════════════════════════════════════════════════════
// 📋 STRICT FIFO SEQUENTIAL TASK QUEUE
// ════════════════════════════════════════════════════════
const taskQueue = {
    queue: [], active: [], maxActive: 1,
    add: function(task) { this.queue.push(task); this.processNext(); },
    processNext: async function() {
        if (this.active.length >= this.maxActive || this.queue.length === 0) return;
        const task = this.queue.shift();
        this.active.push(task);
        try { await task.run(); } catch(e) { console.error("Task Error:", e.message); }
        finally {
            this.active = this.active.filter(t => t.id !== task.id);
            this.processNext();
        }
    }
};

router.get('/api/queue', (req, res) => {
    const activeTask = taskQueue.active[0];
    res.json({
        activeCount: taskQueue.active.length,
        pendingCount: taskQueue.queue.length,
        active: activeTask ? { 
            ...activeTask.info, 
            progress: activeTask.progress || null 
        } : null,
        queue: taskQueue.queue.map(t => t.info)
    });
});

// ════════════════════════════════════════════════════════
// 🔍 1. SEARCH API ROUTE
// ════════════════════════════════════════════════════════
router.post('/api/search', async (req, res) => {
    const { query, source = 'cinesubz' } = req.body;
    try {
        if (source === 'moviebox') {
            const cleanQ = (query || '').trim();
            let searchUrl;
            if (!cleanQ || cleanQ === '__trending__' || cleanQ.toLowerCase() === 'trending') {
                searchUrl = `${MOVIEBOX_API_BASE}/search?q=movie&api_key=${MOVIEBOX_KEY}`;
            } else {
                searchUrl = `${MOVIEBOX_API_BASE}/search?q=${encodeURIComponent(cleanQ)}&api_key=${MOVIEBOX_KEY}`;
            }
            const searchRes = await axios.get(searchUrl, {
                headers: { 'X-API-Key': MOVIEBOX_KEY, 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });
            const items = searchRes.data?.items || searchRes.data?.data || [];
            if (items.length > 0) {
                const results = items.slice(0, 36).map(mv => ({
                    title: mv.name || mv.title || 'Movie',
                    url: mv.slug || mv.subject_id,
                    img: mv.poster_url || mv.cover || '',
                    source: 'moviebox',
                    type: mv.type || 'movie',
                    year: mv.year || '',
                    rating: mv.rating || '',
                    subject_id: mv.subject_id
                }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }

        if (source === 'cinesubz2') {
            try {
                const searchRes = await axios.get(`${CZ2_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000, headers: HEADERS });
                const data = searchRes.data || {};
                const list = data.data || data.result || [];
                if (list.length > 0) {
                    const results = list.slice(0, 10).map(mv => ({
                        title: mv.title || mv.name || 'Movie',
                        url: mv.url || mv.link,
                        img: mv.img || mv.image || '',
                        source: 'cinesubz2',
                        year: mv.year || mv.date || '',
                        imdb: mv.imdb || '',
                        runtime: mv.runtime || ''
                    }));
                    cacheVerifiedMovies(results);
                    return res.json({ success: true, results });
                }
            } catch (cz2Err) {
                console.error("[CZ2] Search API error:", cz2Err.message);
            }
            return res.json({ success: false });
        }

        if (source === 'sinhalasub2') {
            const results = await searchSinhalasub(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 10) });
            }
            return res.json({ success: false });
        }

        if (source === 'kdrama') {
            const results = await searchThenkiri(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === 'animost') {
            const results = await searchAnimost(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === 'piratelk') {
            const results = await searchPirateLK(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === 'helaflix') {
            const results = await getHelaflixPosts(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === 'slcartoons') {
            const results = await searchSinhalaCartoons(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === 'cartoonslk') {
            const results = await searchCartoonsLk(query);
            if (results.length > 0) {
                cacheVerifiedMovies(results);
                return res.json({ success: true, results: results.slice(0, 15) });
            }
            return res.json({ success: false });
        }

        if (source === '1tamilmv') {
            const searchUrl = `https://www.1tamilmv.rocks/index.php?/search/&q=${encodeURIComponent(query)}`;
            const searchRes = await axios.get(searchUrl, { headers: HEADERS, timeout: 20000 });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('a').each((i, el) => {
                let href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if (href.includes('forums/topic/') && text.length > 5 && !text.includes('Languages') && !href.includes('?do=findComment')) {
                    href = href.split('&do=findComment')[0].split('?do=findComment')[0].split('#comment')[0];
                    if (!results.find(r => r.url === href) && results.length < 8) results.push({ title: text, url: href, img: '', source: '1tamilmv' });
                }
            });
            if(results.length > 0) {
                await Promise.allSettled(results.slice(0, 5).map(async (r) => {
                    try {
                        const pageRes = await axios.get(r.url, { headers: { ...HEADERS, 'Referer': 'https://www.1tamilmv.rocks/' }, timeout: 4000 });
                        const $p = cheerio.load(pageRes.data);
                        let foundImg = null;
                        $p('img.ipsImage, img.bbc_img, [data-role="commentContent"] img').each((_, el) => {
                            let s = $p(el).attr('data-src') || $p(el).attr('src');
                            if (s && s.startsWith('http') && !s.includes('data:image') && !foundImg) foundImg = s;
                        });
                        if (foundImg) r.img = foundImg;
                    } catch(_) {}
                }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }

        if (source === 'dinkamovies') {
            const searchRes = await axios.get(`https://kavindu-download-web.vercel.app/api/dinkamovies/movie/search?q=${encodeURIComponent(query)}`);
            if (searchRes.data?.status && searchRes.data.data?.length > 0) {
                const results = searchRes.data.data.slice(0, 8).map(mv => ({
                    title: mv.title || "Unknown",
                    url: mv.link || mv.url,
                    img: mv.poster || '', 
                    source: 'dinkamovies'
                }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }

        // Default: CINESUBZ Pure Native Scraper
        const results = await scrapeSearchDirect(query);
        if (results.length > 0) {
            cacheVerifiedMovies(results);
            return res.json({ success: true, results: results.slice(0, 10) });
        }
        res.json({ success: false });

    } catch (error) {
        console.error("[SEARCH ERROR]:", error.message);
        res.json({ success: false });
    }
});

// ════════════════════════════════════════════════════════
// 🔗 2. DOWNLOAD LINKS & EPISODES API ROUTE
// ════════════════════════════════════════════════════════
router.post('/api/links', async (req, res) => {
    const { url, source = 'cinesubz' } = req.body;
    try {
        if (source === 'moviebox') {
            try {
                let detailUrl;
                if (url.startsWith('http')) {
                    detailUrl = url;
                } else if (url.includes('/') || url.includes('-')) {
                    detailUrl = `${MOVIEBOX_API_BASE}/detail/${url}?api_key=${MOVIEBOX_KEY}`;
                } else {
                    detailUrl = `${MOVIEBOX_API_BASE}/detail/${url}?api_key=${MOVIEBOX_KEY}`;
                }

                const dRes = await axios.get(detailUrl, {
                    headers: { 'X-API-Key': MOVIEBOX_KEY, 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });
                const detail = dRes.data?.data || dRes.data?.detail || dRes.data || {};
                const subjectId = detail.subject_id || detail.id || url;
                const isSeries = detail.type === 'tv' || detail.type === 'tvshows' || (detail.episodes && detail.episodes.length > 0);

                if (isSeries && Array.isArray(detail.episodes) && detail.episodes.length > 0) {
                    const downloads = detail.episodes.map(ep => ({
                        meta: `S${ep.season || 1} E${ep.episode || ep.episode_number}: ${ep.title || ''}`.trim(),
                        resolvedUrl: `moviebox://${subjectId}/${ep.episode_id || ep.id || ep.episode}`,
                        direct: false
                    }));
                    return res.json({ success: true, downloads, isSeries: true, thumbnail: detail.poster_url || detail.cover });
                }

                const qualities = ['1080p', '720p', '480p'];
                const downloads = qualities.map(q => ({
                    meta: `MovieBox ${q}`,
                    resolvedUrl: `moviebox://${subjectId}?quality=${q}`,
                    direct: false
                }));
                return res.json({ success: true, downloads, thumbnail: detail.poster_url || detail.cover });
            } catch (err) {
                console.error("[MOVIEBOX LINKS ERROR]:", err.message);
            }
            return res.json({ success: false });
        }

        if (source === 'cinesubz2') {
            try {
                const dlRes = await axios.get(`${CZ2_API}/dl-links?url=${encodeURIComponent(url)}`, { timeout: 20000, headers: HEADERS });
                const dlData = dlRes.data || {};

                if (dlData.allEpisodes && Array.isArray(dlData.allEpisodes) && dlData.allEpisodes.length > 0) {
                    const downloads = dlData.allEpisodes.map(ep => ({
                        meta: `Episode ${ep.episode}: ${ep.title || ''}`.trim(),
                        resolvedUrl: ep.url,
                        direct: false
                    }));
                    return res.json({ success: true, downloads, isSeries: true });
                }

                const arr = dlData.downloadLinks || dlData.result || dlData.data || [];
                let downloads = [];
                arr.forEach(item => {
                    let resolvedUrl = item.direct_mp4_url || item.url || item.link;
                    if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http')) {
                        resolvedUrl = resolvedUrl.replace('avatarzone.online', 'terracloud2.site');
                        let q = item.quality || item.resolution || item.name || '';
                        if (!q) {
                            if (resolvedUrl.includes('480p')) q = '480p';
                            else if (resolvedUrl.includes('720p')) q = '720p';
                            else if (resolvedUrl.includes('1080p')) q = '1080p';
                            else q = 'HD';
                        }
                        const sizeStr = item.fileSize || item.size;
                        const metaLabel = `${q} ${sizeStr && sizeStr !== 'Unknown' ? `(${sizeStr})` : ''}`.trim();
                        downloads.push({ meta: metaLabel, resolvedUrl: resolvedUrl, direct: true });
                    }
                });
                if (downloads.length > 0) {
                    return res.json({ success: true, downloads });
                }
            } catch (cz2DlErr) {
                console.error("[CZ2] Links API error:", cz2DlErr.message);
            }
            return res.json({ success: false });
        }

        if (source === 'sinhalasub2') {
            if (url.includes('/tvshows/')) {
                const tvData = await getSinhalasubTvEpisodes(url);
                const downloads = tvData.episodes.map(ep => ({
                    meta: ep.title,
                    resolvedUrl: ep.url,
                    direct: false
                }));
                return res.json({ success: downloads.length > 0, downloads, thumbnail: tvData.poster, isSeries: true });
            } else {
                const details = await getSinhalasubDetails(url);
                const downloads = details.downloadOptions.map(opt => ({
                    meta: `${opt.quality} (${opt.server} - ${opt.size})`,
                    resolvedUrl: opt.linkPageUrl,
                    direct: true
                }));
                return res.json({ success: downloads.length > 0, downloads, thumbnail: details.poster });
            }
        }

        if (source === 'kdrama') {
            const data = await getThenkiriDetails(url);
            const isSeries = data.downloads.length > 1;
            return res.json({ success: data.downloads.length > 0, downloads: data.downloads, thumbnail: data.poster, isSeries });
        }

        if (source === 'animost') {
            const data = await getAnimostDownloadOptions(url);
            const isSeries = data.downloads.length > 1;
            return res.json({ success: data.downloads.length > 0, downloads: data.downloads, thumbnail: data.poster, isSeries });
        }

        if (source === 'piratelk') {
            const data = await getPirateLKDetails(url);
            return res.json({ success: data.downloads.length > 0, downloads: data.downloads, thumbnail: data.poster });
        }

        if (source === 'helaflix') {
            const data = await resolveUniversalDownloadHela(url);
            const downloads = [{
                meta: 'Direct Video Stream',
                resolvedUrl: data.downloadUrl || url,
                direct: true
            }];
            return res.json({ success: true, downloads });
        }

        if (source === 'slcartoons') {
            const data = await getSinhalaCartoonsDetails(url);
            return res.json({ success: data.downloads.length > 0, downloads: data.downloads, isSeries: data.isSeries, thumbnail: data.poster });
        }

        if (source === 'cartoonslk') {
            const data = await getCartoonsLkDetails(url);
            return res.json({ success: data.downloads.length > 0, downloads: data.downloads, isSeries: data.isSeries, thumbnail: data.poster });
        }

        if (source === '1tamilmv') {
            const dlRes = await axios.get(url, { headers: { ...HEADERS, 'Referer': 'https://www.1tamilmv.rocks/' }, timeout: 20000 });
            const $ = cheerio.load(dlRes.data);
            let img = null;
            $('img.ipsImage, img.bbc_img, [data-role="commentContent"] img').each((i, el) => {
                let src = $(el).attr('data-src') || $(el).attr('src'); 
                if (src && src.startsWith('http') && !src.includes('data:image') && !img) img = src; 
            });
            let downloads = [], currentTitle = "Movie", currentSizeMB = 0;
            $('[data-role="commentContent"] *').each((i, el) => {
                const text = $(el).text().trim();
                if (el.tagName !== 'a' && el.tagName !== 'img' && text.length > 5) {
                    if (text.match(/([0-9.]+(MB|GB))|([0-9]{3,4}p)|(Episode [0-9]+)/i) && text.length < 150) {
                        currentTitle = text.split('\n')[0].replace(/www\.1TamilMV\.[a-z]+ - /, '').trim();
                        let sizeMatch = currentTitle.match(/([0-9\.]+)\s*(GB|MB)/i);
                        if (sizeMatch) currentSizeMB = (sizeMatch[2].toUpperCase() === 'GB') ? parseFloat(sizeMatch[1]) * 1024 : parseFloat(sizeMatch[1]);
                    }
                }
                if (el.tagName === 'a' && $(el).attr('href')?.includes('cyberloom.best/l/')) {
                    if (!downloads.find(q => q.resolvedUrl === $(el).attr('href'))) {
                        downloads.push({ meta: currentSizeMB > 1900 ? `⚠️ (Over 2GB) ${currentTitle}` : currentTitle, resolvedUrl: $(el).attr('href'), direct: true, size_mb: currentSizeMB });
                    }
                }
            });
            if (downloads.length > 0) {
                if (img) {
                    try {
                        const normUrl = url.toLowerCase().trim();
                        verifiedMoviesCache.set(normUrl, { title: downloads[0].meta, img, source: '1tamilmv' });
                    } catch(e) {}
                }
                return res.json({ success: true, downloads, thumbnail: img });
            }
            return res.json({ success: false });
        }

        if (source === 'dinkamovies') {
            const dlRes = await axios.get(`https://kavindu-download-web.vercel.app/api/dinkamovies/movie/dl?url=${encodeURIComponent(url)}`);
            if (dlRes.data?.status && dlRes.data.downloads) {
                const downloads = dlRes.data.downloads.map(dl => ({
                    meta: dl.quality || 'Download',
                    resolvedUrl: dl.direct_link || dl.link || dl.gdrive_link || '',
                    direct: true,
                    size: dl.size || ''
                })).filter(l => l.resolvedUrl);
                return res.json({ success: true, downloads, thumbnail: dlRes.data.poster || '' });
            }
            return res.json({ success: false });
        }

        // Default: CINESUBZ Pure Native Scraper
        const details = await scrapeCineSubzDetails(url);
        if (details.isTV && details.episodes.length > 0) {
            const downloads = details.episodes.map(ep => ({
                meta: ep.title,
                resolvedUrl: ep.href,
                direct: false
            }));
            return res.json({ success: true, downloads, isSeries: true, thumbnail: details.poster });
        }

        if (details.downloadQualities.length > 0) {
            const downloads = details.downloadQualities.map(q => ({
                meta: q.label,
                resolvedUrl: q.ztUrl,
                direct: true
            }));
            return res.json({ success: true, downloads, thumbnail: details.poster });
        }

        res.json({ success: false });
    } catch (error) {
        console.error("[LINKS ERROR]:", error.message);
        res.json({ success: false });
    }
});

router.post('/api/send-movie', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }
    if (typeof clientIp === 'string' && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
    }

    if (isIpSuspicious(clientIp)) {
        console.warn(`[SECURITY] 🚨 Blocked request from flagged IP: ${clientIp}`);
        return res.status(403).json({ success: false, message: 'Too many suspicious requests. Try again later.' });
    }

    const payload = decryptPayload(req.body) || {};
    const { 
        title, url, quality, userNum, userName, reqNum, reqName, img, botNumber, groupJid, batchIndex, batchTotal,
        year, genres, imdb, runtime, source, admin_id 
    } = payload;

    const cleanTitle = sanitizeText(title, 1000);
    const cleanQuality = formatQuality(quality);
    const cleanReqNum = sanitizeText(reqNum || userNum, 30);
    const cleanReqName = sanitizeText(reqName || userName, 1000) || 'Anonymous';

    if (!cleanTitle || cleanTitle.length < 2) {
        return res.status(400).json({ success: false, message: 'Invalid movie title.' });
    }

    const suspiciousTitle = /(?:hacked|anonymous|pwned|defaced|root@|\/etc|\bcat\b|<script|curl)/i;
    if (suspiciousTitle.test(cleanTitle)) {
        console.warn(`[SECURITY] 🚨 Blocked suspicious title "${cleanTitle}" from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(400).json({ success: false, message: '❌ Invalid movie title.' });
    }

    const cleanImg = isValidMovieImage(img) ? img : null;
    const normKey = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    let verifiedMovie = verifiedMoviesCache.get(normKey);

    if (!verifiedMovie && (!source || source === 'cinesubz')) {
        try {
            const list = await scrapeSearchDirect(cleanTitle.substring(0, 30));
            if (list.length > 0) {
                const found = list[0];
                verifiedMovie = {
                    title: found.title.trim(),
                    img: found.img,
                    year: found.year || '',
                    genres: '',
                    imdb: found.imdb || '',
                    runtime: ''
                };
                verifiedMoviesCache.set(normKey, verifiedMovie);
            }
        } catch (_) {}
    }

    if (!verifiedMovie) {
        verifiedMovie = {
            title: cleanTitle,
            img: cleanImg || '',
            year: year || '',
            genres: genres || '',
            imdb: imdb || '',
            runtime: runtime || ''
        };
    }

    const movieYear = sanitizeText(year || verifiedMovie.year || '', 20);
    const movieGenres = sanitizeText(genres || verifiedMovie.genres || '', 1000);
    const movieImdb = sanitizeText(imdb || verifiedMovie.imdb || '', 20);
    const movieRuntime = sanitizeText(runtime || verifiedMovie.runtime || '', 30);
    const verifiedTitle = verifiedMovie.title;
    const finalPoster = isValidMovieImage(verifiedMovie.img) ? verifiedMovie.img : (cleanImg || null);

    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('moviebox://') && !url.startsWith('cartoonslk://'))) {
        recordSuspiciousRequest(clientIp);
        return res.status(400).json({ success: false, message: 'Invalid download URL format.' });
    }

    const taskId = crypto.randomBytes(4).toString('hex');
    let dynamicBotNumber = FALLBACK_BOT_NUMBER;
    let dynamicGroupJid = FALLBACK_GROUP_JID;
    let dynamicFooter = "";

    const targetAdminId = (admin_id || '').trim();
    let adminData = null;
    if (targetAdminId) {
        try {
            adminData = await Admin.findOne({
                $or: [
                    { username: targetAdminId },
                    { username: new RegExp(`^${targetAdminId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                ]
            });
        } catch(err) {
            console.log(`[DB] Error fetching admin ${targetAdminId}:`, err.message);
        }
    }
    if (!adminData) {
        try {
            adminData = await Admin.findOne({ username: 'sade' }) || await Admin.findOne({});
        } catch(err) {
            console.log("[DB] Fallback admin fetch error:", err.message);
        }
    }

    if (adminData) {
        if (adminData.bot_number) dynamicBotNumber = adminData.bot_number.replace(/[^0-9]/g, '');
        if (adminData.group_jid) dynamicGroupJid = adminData.group_jid.trim();
        if (adminData.footer_text) dynamicFooter = adminData.footer_text.trim();
    }

    if (groupJid && typeof groupJid === 'string' && (groupJid.endsWith('@g.us') || groupJid.endsWith('@s.whatsapp.net'))) {
        dynamicGroupJid = groupJid.trim();
    }
    if (botNumber && typeof botNumber === 'string') {
        dynamicBotNumber = botNumber.replace(/[^0-9]/g, '');
    }

    console.log(`[ROUTE] Target Group JID: ${dynamicGroupJid} | Target Bot: ${dynamicBotNumber} | Footer: ${dynamicFooter}`);

    taskQueue.add({
        id: taskId,
        info: {
            title: verifiedTitle,
            quality: cleanQuality,
            userNum: cleanReqNum,
            userName: cleanReqName,
            status: 'queued'
        },
        progress: { percent: 0, transferredMB: '0.0', totalMB: '0.0', status: 'queued' },
        run: async function() {
            const currentTask = this;
            currentTask.info.status = 'running';

            const sock = await getReadySocket(dynamicBotNumber, 15000);
            if (!sock) {
                console.error("[QUEUE] No active WhatsApp socket available. Task aborted.");
                return;
            }

            if (!sock._groupWarmed) {
                try {
                    await Promise.race([
                        sock.groupMetadata(dynamicGroupJid),
                        new Promise(r => setTimeout(r, 6000))
                    ]).catch(() => {});
                    sock._groupWarmed = true;
                } catch(e) {}
            }

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const baseMovieKey = cleanTitle
                    .toLowerCase()
                    .replace(/sinhala subtitles|සිංහල උපසිරැසි|sinhala sub|subtitles|\(\d{4}\)|\d{4}/gi, '')
                    .replace(/[^a-z0-9]/g, '')
                    .trim();
                const detailsKey = `${baseMovieKey || normKey}_${dynamicGroupJid}`;

                let cachedPosterThumbnail = null;

                // 1. Send details card (tracked for ALL requests with 15min TTL to eliminate duplicate card deliveries)
                const shouldSendDetailsCard = isBatch 
                    ? (batchIndex === 0 && !sentDetailsCardTracker.has(detailsKey)) 
                    : !sentDetailsCardTracker.has(detailsKey);

                if (shouldSendDetailsCard) {
                    sentDetailsCardTracker.add(detailsKey);
                    setTimeout(() => sentDetailsCardTracker.delete(detailsKey), 15 * 60 * 1000);

                    const exactBotJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (dynamicBotNumber + '@s.whatsapp.net');
                    const adminInboxText = `📌 *New Request Started!*\n🎬 *Title:* ${verifiedTitle}\n✨ *Quality:* ${cleanQuality}\n👤 *By:* ${cleanReqName}\n📞 *Number:* ${cleanReqNum}\n🌐 *IP:* ${clientIp}`;
                    
                    sendMediaSafely(sock, exactBotJid, { text: adminInboxText }, 5000).catch(() => {});

                    // Generate complete AI summary with 15s max race
                    let aiSummary = "";
                    try {
                        const sumPromise = getGeminiSummary(verifiedTitle);
                        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(""), 15000));
                        aiSummary = await Promise.race([sumPromise, timeoutPromise]);
                    } catch(e) {}

                    let cap = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗠𝗢𝗩𝗜𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n`;
                    cap += `🎬 *Title:* ${verifiedTitle}\n`;
                    if (movieYear && movieYear !== 'N/A') cap += `📅 *Year:* ${movieYear}\n`;
                    if (movieGenres && movieGenres !== 'N/A') cap += `🎭 *Genres:* ${movieGenres}\n`;
                    if (movieImdb && movieImdb !== 'N/A') cap += `⭐ *IMDB:* ${movieImdb}\n`;
                    if (movieRuntime && movieRuntime !== 'N/A') cap += `⏱ *Runtime:* ${movieRuntime}\n`;
                    cap += `✨ *Quality:* ${cleanQuality}\n`;
                    if (aiSummary) cap += `\n📖 *සාරාංශය (Overview):*\n${aiSummary}\n`;
                    if (dynamicFooter) {
                        cap += `\n👤 *Required By:* ${cleanReqName}\n\n> *${dynamicFooter}*`;
                    } else {
                        cap += `\n👤 *Required By:* ${cleanReqName}`;
                    }

                    let cardSent = false;
                    let attemptedImageSend = false;
                    if (finalPoster) {
                        let posterBuffer = null;
                        try {
                            const pHeaders = { ...HEADERS };
                            if (finalPoster.includes('tamilmv') || source === '1tamilmv') {
                                pHeaders['Referer'] = 'https://www.1tamilmv.rocks/';
                            } else if (finalPoster.includes('cinesubz')) {
                                pHeaders['Referer'] = 'https://cinesubz.net/';
                            }
                            const imgRes = await axios.get(finalPoster, { responseType: 'arraybuffer', timeout: 10000, headers: pHeaders });
                            if (imgRes.data && imgRes.data.length > 500) {
                                const rawBuf = Buffer.from(imgRes.data);
                                posterBuffer = await ensureJpegBuffer(rawBuf);
                                cachedPosterThumbnail = await createDocumentThumbnail(posterBuffer);
                            }
                        } catch (fetchErr) {
                            console.log("[SEND] Poster image buffer fetch note:", fetchErr.message);
                        }

                        try {
                            attemptedImageSend = true;
                            const imgPayload = posterBuffer 
                                ? { image: posterBuffer, caption: cap, mimetype: 'image/jpeg' } 
                                : { image: { url: finalPoster }, caption: cap, mimetype: 'image/jpeg' };
                            await sendMediaSafely(sock, dynamicGroupJid, imgPayload, 50000);
                            cardSent = true;
                        } catch (sendErr) {
                            console.log("[SEND] Poster image send note:", sendErr.message);
                        }
                    }
                    // Only send text card if there was NO poster available to send
                    if (!cardSent && !attemptedImageSend) {
                        try {
                            await sendMediaSafely(sock, dynamicGroupJid, { text: cap }, 20000);
                            cardSent = true;
                        } catch(e) {}
                    }
                }

                // 2. Direct Video Stream & Upload with 3-attempt auto-retry
                let streamUploaded = false;
                let lastError = null;
                const maxRetries = 3;

                for (let attempt = 1; attempt <= maxRetries && !streamUploaded; attempt++) {
                    try {
                        if (attempt > 1) {
                            console.log(`[STREAM] ⏳ Connection drop or error. Waiting 10 seconds before auto-retry (${attempt}/${maxRetries})...`);
                            await new Promise(r => setTimeout(r, 10000));
                        }

                        console.log(`[STREAM] 🚀 Attempt ${attempt}/${maxRetries} starting for: ${verifiedTitle} (${cleanQuality})`);
                        let finalVidUrl = url;
                        let extraStreamHeaders = {};

                        if (finalVidUrl.startsWith('moviebox://')) {
                            try {
                                const parsedMb = new URL(finalVidUrl.replace('moviebox://', 'https://mbx/'));
                                const subjectId = parsedMb.hostname === 'mbx' ? parsedMb.pathname.replace(/^\//, '').split('/')[0] : parsedMb.hostname;
                                const qualityReq = parsedMb.searchParams.get('quality') || '720p';
                                const dlApi = `${MOVIEBOX_API_BASE}/api/download/${subjectId}?quality=${qualityReq}&api_key=${MOVIEBOX_KEY}`;
                                const mbRes = await axios.get(dlApi, {
                                    headers: { 'X-API-Key': MOVIEBOX_KEY, 'User-Agent': 'Mozilla/5.0' },
                                    timeout: 15000
                                });
                                const streamLink = mbRes.data?.data?.url || mbRes.data?.url || mbRes.data?.download_url;
                                if (streamLink && streamLink.startsWith('http')) {
                                    finalVidUrl = streamLink;
                                } else {
                                    const stApi = `${MOVIEBOX_API_BASE}/api/stream/${subjectId}?api_key=${MOVIEBOX_KEY}`;
                                    const stRes = await axios.get(stApi, {
                                        headers: { 'X-API-Key': MOVIEBOX_KEY, 'User-Agent': 'Mozilla/5.0' },
                                        timeout: 15000
                                    });
                                    const altLink = stRes.data?.data?.url || stRes.data?.url || stRes.data?.stream_url;
                                    if (altLink && altLink.startsWith('http')) finalVidUrl = altLink;
                                }
                            } catch (mbErr) {
                                console.error("[STREAM MOVIEBOX ERROR]:", mbErr.message);
                            }
                        }

                        // 1. CINESUBZ PURE NATIVE RESOLUTION
                        if (source === 'cinesubz' || finalVidUrl.includes('cinesubz.net') || finalVidUrl.includes('zt-links') || finalVidUrl.includes('wodocloud') || finalVidUrl.includes('supercloud') || finalVidUrl.includes('/server') || finalVidUrl.includes('/api-')) {
                            try {
                                if (finalVidUrl.includes('cinesubz.net/episodes/')) {
                                    console.log(`[STREAM CZ] Scraping episode detail page: ${finalVidUrl}`);
                                    try {
                                        const epDetails = await scrapeCineSubzDetails(finalVidUrl);
                                        if (epDetails.downloadQualities && epDetails.downloadQualities.length > 0) {
                                            const qClean = cleanQuality.toLowerCase();
                                            const chosenDl = epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes(qClean)) ||
                                                             epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('720p')) ||
                                                             epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('480p')) ||
                                                             epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('1080p')) ||
                                                             epDetails.downloadQualities[0];
                                            if (chosenDl?.ztUrl) {
                                                finalVidUrl = chosenDl.ztUrl;
                                                console.log(`[STREAM CZ] Selected episode quality link: ${chosenDl.label} -> ${finalVidUrl}`);
                                            }
                                        }
                                    } catch (epScrapeErr) {
                                        console.warn("[STREAM CZ] Episode scrape note:", epScrapeErr.message);
                                    }
                                    // Fallback: direct page element search for download button / api link
                                    if (finalVidUrl.includes('cinesubz.net/episodes/')) {
                                        const epPage = await axios.get(finalVidUrl, { headers: HEADERS, timeout: 20000 });
                                        const $ep = cheerio.load(epPage.data);
                                        const zt = $ep('a[href*="/api-"]').attr('href') || $ep('.movie-download-button').attr('href') || $ep('a[href*="zt-links"]').attr('href') || $ep('a[href*="/download/"]').attr('href');
                                        if (zt) finalVidUrl = zt;
                                    }
                                }
                                if (finalVidUrl.includes('zt-links') || finalVidUrl.includes('/server') || finalVidUrl.includes('cinesubz.net/api-') || finalVidUrl.includes('cinesubz.net/movies/') || finalVidUrl.includes('/download/')) {
                                    const resolved = await resolveDirectVideo(finalVidUrl);
                                    if (resolved?.url) {
                                        finalVidUrl = resolved.url;
                                        if (resolved.headers) {
                                            extraStreamHeaders = { ...extraStreamHeaders, ...resolved.headers };
                                        }
                                    }
                                }
                                // Fallback: If still an HTML URL or resolve failed, try CZ2 dl-links API
                                if (finalVidUrl.includes('cinesubz.net') && !finalVidUrl.match(/\.(mp4|mkv)(\?|$)/i)) {
                                    try {
                                        console.log(`[CZ STREAM FALLBACK] Attempting CZ2 resolution for: ${finalVidUrl}`);
                                        const epRes = await axios.get(`${CZ2_API}/dl-links?url=${encodeURIComponent(finalVidUrl)}`, { timeout: 20000, headers: HEADERS });
                                        const arr = epRes.data?.downloadLinks || epRes.data?.result || epRes.data?.data || [];
                                        for (let item of arr) {
                                            let u = item.direct_mp4_url || item.url || item.link;
                                            if (u && typeof u === 'string' && u.startsWith('http')) {
                                                finalVidUrl = u;
                                                break;
                                            }
                                        }
                                    } catch (_) {}
                                }
                            } catch (czErr) {
                                console.warn("[STREAM CZ RESOLVE NOTE]:", czErr.message);
                            }
                        }

                        // 2. CINESUBZ 2 RESOLUTION
                        if (source === 'cinesubz2') {
                            if (finalVidUrl.includes('cinesubz.net') || finalVidUrl.includes('/episodes/') || !finalVidUrl.match(/\.(mp4|mkv)(\?|$)/i)) {
                                try {
                                    console.log(`[CZ2] Resolving direct stream link for: ${finalVidUrl}`);
                                    const epRes = await axios.get(`${CZ2_API}/dl-links?url=${encodeURIComponent(finalVidUrl)}`, { timeout: 25000, headers: HEADERS });
                                    const arr = epRes.data?.downloadLinks || epRes.data?.result || epRes.data?.data || [];
                                    for (let item of arr) {
                                        let u = item.direct_mp4_url || item.url || item.link;
                                        if (u && typeof u === 'string' && u.startsWith('http')) {
                                            finalVidUrl = u.replace('avatarzone.online', 'terracloud2.site');
                                            break;
                                        }
                                    }
                                } catch (epErr) {
                                    console.error("[CZ2] Failed to resolve link:", epErr.message);
                                }
                            }
                            if (finalVidUrl.includes('avatarzone.online')) {
                                finalVidUrl = finalVidUrl.replace('avatarzone.online', 'terracloud2.site');
                            }
                        }

                        // 3. SINHALASUB NATIVE RESOLUTION
                        if (source === 'sinhalasub2' || finalVidUrl.includes('sinhalasub.lk')) {
                            try {
                                if (finalVidUrl.includes('/episodes/') || finalVidUrl.includes('/movies/')) {
                                    const det = await getSinhalasubDetails(finalVidUrl);
                                    if (det.downloadOptions && det.downloadOptions.length > 0) {
                                        const pref = det.downloadOptions.find(o => o.linkPageUrl.includes('pixeldrain') || o.server.toLowerCase().includes('pixel')) || det.downloadOptions[0];
                                        finalVidUrl = pref.linkPageUrl;
                                    }
                                }
                                if (finalVidUrl.includes('/links/')) {
                                    const resolved = await resolveSinhalasubLink(finalVidUrl);
                                    if (resolved) finalVidUrl = resolved;
                                }
                            } catch (_) {}
                        }

                        // CARTOONS.LK RESOLUTION
                        if (source === 'cartoonslk' || finalVidUrl.startsWith('cartoonslk://')) {
                            try {
                                const parsedU = new URL(finalVidUrl);
                                const pId = parsedU.hostname || parsedU.pathname.replace(/^\/\//, '');
                                const nonce = parsedU.searchParams.get('nonce');
                                const type = parsedU.searchParams.get('type') || 'single';
                                const epIdx = parsedU.searchParams.get('episodeIndex') || '0';
                                const lIdx = parsedU.searchParams.get('linkIndex') || '0';
                                const pUrl = parsedU.searchParams.get('pageUrl') || 'https://cartoons.lk/';

                                const streamUrl = await resolveCartoonsLkStream({
                                    pageUrl: decodeURIComponent(pUrl),
                                    postId: pId,
                                    nonce,
                                    type,
                                    episodeIndex: parseInt(epIdx),
                                    linkIndex: parseInt(lIdx)
                                });
                                if (streamUrl) finalVidUrl = streamUrl;
                            } catch (clkErr) {
                                console.error("[STREAM CARTOONSLK ERROR]:", clkErr.message);
                            }
                            if (finalVidUrl.startsWith('cartoonslk://')) {
                                throw new Error('Cartoons.lk stream link could not be resolved');
                            }
                        }

                        // SINHALACARTOONS RESOLUTION
                        if (source === 'slcartoons' && !finalVidUrl.match(/\.(mp4|mkv)(\?|$)/i)) {
                            try {
                                const scDet = await getSinhalaCartoonsDetails(finalVidUrl);
                                if (scDet.downloads.length > 0) {
                                    finalVidUrl = scDet.downloads[0].resolvedUrl;
                                }
                            } catch (_) {}
                        }

                        // 4. THENKIRI KDRAMA RESOLUTION
                        if (source === 'kdrama' || finalVidUrl.includes('downloadwella.com')) {
                            try {
                                const direct = await getDirectLinkThenkiri(finalVidUrl, HEADERS['User-Agent']);
                                if (direct) finalVidUrl = direct;
                            } catch (_) {}
                        }

                        // 5. HELAFLIX RESOLUTION
                        if (source === 'helaflix') {
                            try {
                                const hela = await resolveUniversalDownloadHela(finalVidUrl);
                                if (hela?.downloadUrl) finalVidUrl = hela.downloadUrl;
                            } catch (_) {}
                        }

                        // 6. PIRATELK RESOLUTION
                        if (source === 'piratelk') {
                            if (finalVidUrl.includes('pixeldrain.com/u/')) {
                                finalVidUrl = finalVidUrl.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
                            }
                            const gId = extractGdriveFileId(finalVidUrl);
                            if (gId) {
                                finalVidUrl = `https://drive.usercontent.google.com/download?id=${gId}&export=download&authuser=0`;
                            }
                        }

                        // 7. DINKAMOVIES RESOLUTION
                        if (source === 'dinkamovies') {
                            let fileId = extractGdriveFileId(finalVidUrl);
                            if (fileId) {
                                finalVidUrl = `https://sadew.sadewrashmika069.workers.dev/download?key=sadew123&id=${fileId}`;
                            }
                        }

                        const mimeType = (finalVidUrl.includes('.mkv')) ? 'video/x-matroska' : 'video/mp4';
                        const fileExt = mimeType === 'video/x-matroska' ? 'mkv' : 'mp4';
                        
                        const safeMovieTitle = verifiedTitle.substring(0, 35).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() || 'Movie';
                        const safeQualityForFile = cleanQuality.replace(/[^a-zA-Z0-9\-.]/g, ' ').replace(/\s+/g, ' ').trim() || 'HD';
                        let fileName = `${safeMovieTitle} - ${safeQualityForFile}.${fileExt}`;
                        let smallCaption = isBatch && !isFirstInBatch 
                            ? `🎬 *${cleanQuality}*\n👤 *Required By:* ${cleanReqName}${dynamicFooter ? `\n> *${dynamicFooter}*` : ''}` 
                            : `🎬 *${verifiedTitle}*${dynamicFooter ? `\n> *${dynamicFooter}*` : ''}`;

                        console.log(`[STREAM] 🚀 Live streaming to WhatsApp: ${fileName}`);
                        const streamHeaders = {
                            'User-Agent': HEADERS['User-Agent'],
                            'Referer': (source && source.startsWith('cinesubz')) ? 'https://cinesubz.net/' : ((source === 'sinhalasub2') ? 'https://sinhalasub.lk/' : ((source === '1tamilmv') ? 'https://www.1tamilmv.rocks/' : 'https://google.com/')),
                            'Accept': '*/*',
                            'X-API-Key': MOVIEBOX_KEY,
                            ...extraStreamHeaders
                        };

                        const streamRes = await axios({
                            method: 'GET',
                            url: finalVidUrl,
                            responseType: 'stream',
                            timeout: 0,
                            headers: streamHeaders,
                            maxRedirects: 10,
                            httpsAgent
                        });

                        const ct = streamRes.headers['content-type'] || '';
                        if (ct.includes('text/html')) {
                            try { streamRes.data.destroy(); } catch(e){}
                            throw new Error("Server returned HTML page instead of video file");
                        }

                        const cl = parseInt(streamRes.headers['content-length'] || '0');
                        if (cl > 2 * 1024 * 1024 * 1024) {
                            try { streamRes.data.destroy(); } catch(e){}
                            await sendMediaSafely(sock, dynamicGroupJid, { text: `⚠️ *File Too Large (>2GB)*\n🎬 ${verifiedTitle}\n🔗 ${url}` });
                            streamUploaded = true;
                            break;
                        }

                        const totalMB = cl > 0 ? (cl / (1024 * 1024)).toFixed(1) : 'Unknown';
                        let transferredBytes = 0;
                        let lastUpdate = 0;

                        if (currentTask) {
                            currentTask.progress = { percent: 0, transferredMB: '0.0', totalMB, status: 'uploading' };
                        }

                        streamRes.data.on('data', (chunk) => {
                            transferredBytes += chunk.length;
                            const now = Date.now();
                            if (now - lastUpdate > 300) {
                                lastUpdate = now;
                                const percent = cl > 0 ? Math.min(99, Math.round((transferredBytes / cl) * 100)) : 0;
                                const transferredMB = (transferredBytes / (1024 * 1024)).toFixed(1);
                                if (currentTask) {
                                    currentTask.progress = { percent, transferredMB, totalMB, status: 'uploading' };
                                }
                            }
                        });

                        if (!cachedPosterThumbnail && finalPoster) {
                            try {
                                const pHeaders = { ...HEADERS };
                                if (finalPoster.includes('tamilmv') || source === '1tamilmv') {
                                    pHeaders['Referer'] = 'https://www.1tamilmv.rocks/';
                                } else if (finalPoster.includes('cinesubz')) {
                                    pHeaders['Referer'] = 'https://cinesubz.net/';
                                }
                                const imgRes = await axios.get(finalPoster, { responseType: 'arraybuffer', timeout: 5000, headers: pHeaders });
                                if (imgRes.data && imgRes.data.length > 500) {
                                    cachedPosterThumbnail = await createDocumentThumbnail(Buffer.from(imgRes.data));
                                }
                            } catch (_) {}
                        }

                        const docPayload = {
                            document: { stream: streamRes.data },
                            mimetype: mimeType,
                            fileName: fileName,
                            caption: smallCaption
                        };
                        if (cachedPosterThumbnail && Buffer.isBuffer(cachedPosterThumbnail) && cachedPosterThumbnail.length > 50 && cachedPosterThumbnail.length <= 25000) {
                            docPayload.jpegThumbnail = cachedPosterThumbnail;
                        }

                        await sendMediaSafely(sock, dynamicGroupJid, docPayload, 1800000);

                        try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch (err) {}
                        if (currentTask) {
                            currentTask.progress = { percent: 100, transferredMB: totalMB, totalMB, status: 'completed' };
                        }
                        setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

                        streamUploaded = true;
                        console.log(`[STREAM] ✅ Successfully live streamed: ${verifiedTitle} (${cleanQuality})`);
                        break;

                    } catch (err) {
                        lastError = err;
                        console.warn(`[STREAM] ⚠️ Attempt ${attempt} failed: ${err.message}`);
                    }
                }

                if (!streamUploaded) {
                    const errMsg = lastError?.response ? `HTTP ${lastError.response.status}` : (lastError?.message || 'Upload failed');
                    console.error(`[STREAM] ❌ All ${maxRetries} attempts failed for ${verifiedTitle}: ${errMsg}`);
                    // Per user request: DO NOT send failure message to sender's group. Only notify admin inbox quietly.
                    try {
                        const exactBotJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (dynamicBotNumber + '@s.whatsapp.net');
                        await sendMediaSafely(sock, exactBotJid, { text: `⚠️ *Request Failed after ${maxRetries} retries:* ${verifiedTitle} (${cleanQuality})\n_Error: ${errMsg}_` }, 15000);
                    } catch(e){}
                }

            } catch (outerErr) {
                console.error("[QUEUE] Outer Error:", outerErr.message);
            }
        }
    });
    res.json({ success: true, taskId, position: taskQueue.queue.length });
});

// ════════════════════════════════════════════════════════
// 🎭 4. ANIME HEAVEN ROUTES
// ════════════════════════════════════════════════════════
router.post('/api/anime-search', async (req, res) => {
    const { query } = req.body;
    try {
        const html = (await axios.get(`${ANIME_BASE}/search.php?s=${encodeURIComponent(query)}`, { headers: HEADERS })).data;
        const matches = [...html.matchAll(/<a href=['"](anime\.php\?[^'"]+)['"]>.*?<img class=['"]coverimg['"] src=['"]([^'"]*)['"] alt=['"]([^'"]*)['"]/gi)];
        const seen = new Set(), results = [];
        for (const m of matches) {
            if (results.length >= 10) break;
            const id = m[1].replace('anime.php?', '');
            if (seen.has(id)) continue; seen.add(id);
            results.push({ id, title: m[3].trim(), img: m[2].startsWith('http') ? m[2] : ANIME_BASE+'/'+m[2], source: 'animeheaven' });
        }
        res.json({ success: results.length > 0, results });
    } catch (e) { res.json({ success: false }); }
});

router.post('/api/anime-episodes', async (req, res) => {
    const { id } = req.body;
    try {
        const html = (await axios.get(`${ANIME_BASE}/anime.php?${id}`, { headers: HEADERS })).data;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let videoname = titleMatch ? titleMatch[1].replace('Anime | AnimeHeaven.Me', '').trim() : "Anime";
        const thumbMatch = html.match(/<div class=['"]infoimg['"]><img[^>]+src=['"]([^'"]+)['"]/i);
        let thumbnail = thumbMatch ? (thumbMatch[1].startsWith('http') ? thumbMatch[1] : ANIME_BASE + '/' + thumbMatch[1]) : "";
        const epRegex = /gatea\(\s*['"]([^'"]+)['"]\s*\)[\s\S]*?<div\s+class=\s*['"]\s*watch2 bc\s*['"]\s*>(\d+)<\/div>/gi;
        const episodes = [];
        let epMatch;
        while ((epMatch = epRegex.exec(html)) !== null) episodes.push({ hash: epMatch[1], num: parseInt(epMatch[2]) });
        episodes.sort((a, b) => a.num - b.num);
        res.json({ success: true, videoname, thumbnail, episodes: episodes.slice(0, 1000) });
    } catch (e) { res.json({ success: false }); }
});

router.post('/api/anime-send', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }
    if (typeof clientIp === 'string' && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
    }

    if (isIpSuspicious(clientIp)) {
        return res.status(403).json({ success: false, message: 'Too many suspicious requests. Try again later.' });
    }

    const payload = decryptPayload(req.body) || {};
    const { id, epNum, hash, videoname, userNum, userName, reqNum, reqName, botNumber, groupJid, thumbnail, batchIndex, admin_id } = payload;

    const cleanVideoname = sanitizeText(videoname, 1000);
    const cleanEpNum = parseInt(epNum) || 1;
    const cleanReqNum = sanitizeText(reqNum || userNum, 30);
    const cleanReqName = sanitizeText(reqName || userName, 1000) || 'Anonymous';

    if (!cleanVideoname || cleanVideoname.length < 2) {
        return res.status(400).json({ success: false, message: 'Invalid anime title.' });
    }

    const taskId = crypto.randomBytes(4).toString('hex');
    let dynamicBotNumber = FALLBACK_BOT_NUMBER;
    let dynamicGroupJid = FALLBACK_GROUP_JID;
    let dynamicFooter = "";

    const targetAdminId = (admin_id || '').trim();
    let adminData = null;
    if (targetAdminId) {
        try {
            adminData = await Admin.findOne({
                $or: [
                    { username: targetAdminId },
                    { username: new RegExp(`^${targetAdminId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                ]
            });
        } catch(err) {
            console.log(`[DB] Anime Error fetching admin ${targetAdminId}:`, err.message);
        }
    }
    if (!adminData) {
        try {
            adminData = await Admin.findOne({ username: 'sade' }) || await Admin.findOne({});
        } catch(err) {
            console.log("[DB] Fallback admin fetch error:", err.message);
        }
    }

    if (adminData) {
        if (adminData.bot_number) dynamicBotNumber = adminData.bot_number.replace(/[^0-9]/g, '');
        if (adminData.group_jid) dynamicGroupJid = adminData.group_jid.trim();
        if (adminData.footer_text) dynamicFooter = adminData.footer_text.trim();
    }

    if (groupJid && typeof groupJid === 'string' && (groupJid.endsWith('@g.us') || groupJid.endsWith('@s.whatsapp.net'))) {
        dynamicGroupJid = groupJid.trim();
    }
    if (botNumber && typeof botNumber === 'string') {
        dynamicBotNumber = botNumber.replace(/[^0-9]/g, '');
    }

    taskQueue.add({
        id: taskId,
        info: {
            title: `${cleanVideoname} - Ep ${cleanEpNum}`,
            quality: 'HD',
            userNum: cleanReqNum,
            userName: cleanReqName,
            status: 'queued'
        },
        progress: { percent: 0, transferredMB: '0.0', totalMB: '0.0', status: 'queued' },
        run: async function() {
            const currentTask = this;
            currentTask.info.status = 'running';

            const sock = await getReadySocket(dynamicBotNumber, 15000);
            if (!sock) return;

            try {
                const exactBotJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (dynamicBotNumber + '@s.whatsapp.net');
                try {
                    await sendMediaSafely(sock, exactBotJid, { text: `📌 *New Anime Requested!*\n🎬 *Title:* ${cleanVideoname} - Ep ${cleanEpNum}\n👤 *By:* ${cleanReqName}\n📞 *Number:* ${cleanReqNum}\n🌐 *IP:* ${clientIp}` }, 30000);
                } catch(e) {}

                let aiSummary = "";
                try {
                    const sumPromise = getGeminiSummary(cleanVideoname);
                    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(""), 20000));
                    aiSummary = await Promise.race([sumPromise, timeoutPromise]);
                } catch(e) {}

                let posterBuffer = null;
                let microThumb = null;
                let thumbUrl = thumbnail;
                if (!thumbUrl && id) {
                    try {
                        const aRes = await axios.get(`${ANIME_BASE}/anime.php?${id}`, { headers: HEADERS, timeout: 8000 });
                        const tMatch = aRes.data.match(/<div class=['"]infoimg['"]><img[^>]+src=['"]([^'"]+)['"]/i);
                        if (tMatch) thumbUrl = tMatch[1].startsWith('http') ? tMatch[1] : ANIME_BASE + '/' + tMatch[1];
                    } catch (_) {}
                }

                if (thumbUrl && typeof thumbUrl === 'string' && thumbUrl.startsWith('http')) {
                    try {
                        const tRes = await axios.get(thumbUrl, {
                            responseType: 'arraybuffer',
                            timeout: 10000,
                            headers: { ...HEADERS, 'Referer': ANIME_BASE }
                        });
                        if (tRes.data && tRes.data.length > 500) {
                            const rawBuf = Buffer.from(tRes.data);
                            posterBuffer = await ensureJpegBuffer(rawBuf);
                            microThumb = await createDocumentThumbnail(posterBuffer || rawBuf);
                        }
                    } catch (tErr) {
                        console.log("[ANIME] Thumbnail fetch note:", tErr.message);
                    }
                }

                // Send Image Details Card with Anime Poster & Summary to WhatsApp Group
                const isBatch = typeof batchIndex !== 'undefined';
                const animeBaseKey = cleanVideoname.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                const detailsKey = `anime_${animeBaseKey}_${dynamicGroupJid}`;
                const shouldSendDetailsCard = isBatch 
                    ? (batchIndex === 0 && !sentDetailsCardTracker.has(detailsKey)) 
                    : !sentDetailsCardTracker.has(detailsKey);

                if (shouldSendDetailsCard) {
                    sentDetailsCardTracker.add(detailsKey);
                    setTimeout(() => sentDetailsCardTracker.delete(detailsKey), 15 * 60 * 1000);

                    let cap = `*↳ ❝ [🎌 𝗡𝗘𝗪 𝗔𝗡𝗜𝗠𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎌] ¡! ❞*\n\n`;
                    cap += `🎬 *Title:* ${cleanVideoname}\n`;
                    if (aiSummary) cap += `\n📖 *සාරාංශය (Overview):*\n${aiSummary}\n`;
                    if (dynamicFooter) {
                        cap += `\n👤 *Required By:* ${cleanReqName}\n\n> *${dynamicFooter}*`;
                    } else {
                        cap += `\n👤 *Required By:* ${cleanReqName}`;
                    }

                    let cardSent = false;
                    let attemptedImage = false;
                    if (posterBuffer) {
                        try {
                            attemptedImage = true;
                            await sendMediaSafely(sock, dynamicGroupJid, {
                                image: posterBuffer,
                                caption: cap,
                                mimetype: 'image/jpeg'
                            }, 50000);
                            cardSent = true;
                        } catch (imgErr) {
                            console.log("[ANIME] Image card send note:", imgErr.message);
                        }
                    }
                    if (!cardSent && !attemptedImage) {
                        try {
                            await sendMediaSafely(sock, dynamicGroupJid, { text: cap }, 20000);
                        } catch (_) {}
                    }
                }

                let streamUploaded = false;
                let lastError = null;
                const maxRetries = 3;

                for (let attempt = 1; attempt <= maxRetries && !streamUploaded; attempt++) {
                    const tempAnimePath = path.join(tempDir, `anime_${taskId}_${Date.now()}.mp4`);
                    try {
                        const directUrl = await getAnimeStreamUrl(id, cleanEpNum, hash);
                        if (!directUrl) throw new Error("Could not retrieve stream URL");

                        const writer = fs.createWriteStream(tempAnimePath);
                        const streamRes = await axios({
                            method: 'GET',
                            url: directUrl,
                            responseType: 'stream',
                            timeout: 120000,
                            headers: { ...HEADERS, 'Referer': ANIME_BASE }
                        });

                        streamRes.data.pipe(writer);
                        await new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });

                        const stats = fs.statSync(tempAnimePath);
                        if (stats.size < 500 * 1024) {
                            throw new Error(`Downloaded file too small (${(stats.size / 1024).toFixed(1)} KB), skipping dummy teaser`);
                        }

                        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(1);
                        const fileName = `${cleanVideoname.replace(/[^a-zA-Z0-9 ]/g, '')} - Ep ${cleanEpNum}.mp4`;
                        const smallCaption = isBatch && batchIndex > 0
                            ? `🎬 *${cleanVideoname} - Ep ${cleanEpNum}*\n👤 *Required By:* ${cleanReqName}${dynamicFooter ? `\n> *${dynamicFooter}*` : ''}`
                            : `🎬 *${cleanVideoname} - Ep ${cleanEpNum}*${dynamicFooter ? `\n> *${dynamicFooter}*` : ''}`;

                        const animeDocPayload = {
                            document: { url: tempAnimePath },
                            mimetype: 'video/mp4',
                            fileName,
                            caption: smallCaption
                        };
                        if (microThumb && Buffer.isBuffer(microThumb) && microThumb.length > 50 && microThumb.length <= 25000) {
                            animeDocPayload.jpegThumbnail = microThumb;
                        }

                        await sendMediaSafely(sock, dynamicGroupJid, animeDocPayload, 1800000);

                        streamUploaded = true;
                        break;
                    } catch (err) {
                        lastError = err;
                    } finally {
                        if (fs.existsSync(tempAnimePath)) {
                            try { fs.unlinkSync(tempAnimePath); } catch (_) {}
                        }
                    }
                }

                if (!streamUploaded) {
                    const errMsg = lastError?.message || 'Upload failed';
                    console.error(`[ANIME QUEUE] ❌ Failed for ${cleanVideoname} - Ep ${cleanEpNum}: ${errMsg}`);
                    // Per user request: DO NOT spam failure message to sender's group. Only notify admin inbox quietly.
                    try {
                        const exactBotJid = sock.user?.id ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (dynamicBotNumber + '@s.whatsapp.net');
                        await sendMediaSafely(sock, exactBotJid, { text: `⚠️ *Anime Ep Failed:* ${cleanVideoname} - Ep ${cleanEpNum}\n_Error: ${errMsg}_` }, 15000);
                    } catch(e){}
                }

            } catch (outerErr) {
                console.error("[ANIME QUEUE] Outer Error:", outerErr.message);
            }
        }
    });
    res.json({ success: true, taskId });
});

async function getAnimeStreamUrl(id, ep, hash) {
    try {
        let epHash = hash;
        if (!epHash && id) {
            const animeHtml = (await axios.get(`${ANIME_BASE}/anime.php?${id}`, { headers: HEADERS, timeout: 15000 })).data;
            const epRegex = new RegExp(`gatea\\(\\s*['"]([^'"]+)['"]\\s*\\)[\\s\\S]*?<div\\s+class=\\s*['"]\\s*watch2 bc\\s*['"]\\s*>${ep}<\\/div>`, 'i');
            const m = animeHtml.match(epRegex);
            if (m) epHash = m[1];
            if (!epHash) {
                const anyMatch = animeHtml.match(/gatea\(\s*['"]([^'"]+)['"]\s*\)/i);
                if (anyMatch) epHash = anyMatch[1];
            }
        }
        if (!epHash) return null;

        const gateRes = await axios.get(`${ANIME_BASE}/gate.php`, {
            headers: {
                ...HEADERS,
                'Referer': `${ANIME_BASE}/anime.php?${id || ''}`,
                'Cookie': `key=${epHash}`
            },
            timeout: 15000
        });

        const gateHtml = typeof gateRes.data === 'string' ? gateRes.data : '';
        const allSources = [...gateHtml.matchAll(/<source[^>]+src=['"]([^'"]+)['"]/gi)].map(m => m[1]);

        // 🚫 Strictly filter out ax.animeheaven.me / gif teaser dummy videos (which are only ~88KB!)
        const realSources = allSources.filter(u => {
            if (!u || typeof u !== 'string') return false;
            if (u.includes('ax.animeheaven.me')) return false;
            if (u.includes('gif')) return false;
            if (u.includes('&error')) return false;
            return u.includes('.mp4');
        });

        // Prefer the source that contains the exact episode hash, or the first valid real CDN source
        const bestSource = realSources.find(u => u.includes(epHash)) || 
                           realSources[0] || 
                           allSources.find(u => !u.includes('ax.animeheaven.me') && !u.includes('gif'));

        return bestSource || null;
    } catch (e) {
        console.error("[ANIME STREAM URL ERROR]:", e.message);
        return null;
    }
}

// ════════════════════════════════════════════════════════
// 🌐 5. DINKAMOVIES API
// ════════════════════════════════════════════════════════
const DINKA_API = "https://kavindu-download-web.vercel.app/api/dinkamovies/movie";

router.post('/api/dinkamovies/search', async (req, res) => {
    const { query } = req.body;
    try {
        const searchRes = await axios.get(`${DINKA_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data?.status && searchRes.data.data?.length > 0) {
            const results = searchRes.data.data.slice(0, 8).map(mv => ({
                title: mv.title || "Unknown",
                url: mv.link || mv.url,
                img: mv.poster || '', 
                source: 'dinkamovies'
            }));
            cacheVerifiedMovies(results);
            return res.json({ success: true, results });
        }
        res.json({ success: false });
    } catch (error) {
        res.json({ success: false });
    }
});

router.post('/api/dinkamovies/links', async (req, res) => {
    const { url } = req.body;
    try {
        const dlRes = await axios.get(`${DINKA_API}/dl?url=${encodeURIComponent(url)}`);
        if (dlRes.data?.status && dlRes.data.downloads) {
            const downloads = dlRes.data.downloads.map(dl => ({
                meta: dl.quality || 'Download',
                resolvedUrl: dl.direct_link || dl.link || dl.gdrive_link || '',
                direct: true,
                size: dl.size || ''
            })).filter(l => l.resolvedUrl);

            return res.json({ success: true, downloads, thumbnail: dlRes.data.poster || '' });
        }
        res.json({ success: false });
    } catch (error) {
        res.json({ success: false });
    }
});

module.exports = router;
