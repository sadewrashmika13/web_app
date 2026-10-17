const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cheerio = require('cheerio');
const qs = require('qs');
const https = require('https');
const Admin = require('../models/Admin'); // 🔥 Admin Database එක ඉම්පෝට් කළා

const router = express.Router();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API_BASE = "https://api.zanta-mini.store";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";

// 🔥 මේවා දැන් Fallbacks (DB එකෙන් ආවේ නැත්තම් විතරක් මේවා පාවිච්චි වෙනවා) 🔥
const FALLBACK_GROUP_JID = '120363425721300928@g.us'; 
const FALLBACK_BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

// ════════════ 🛡️ SECURITY & VALIDATION HELPERS ════════════
const ALLOWED_IMAGE_HOSTS = [
    'cinesubz.net',
    'cinesubz.co',
    'cinesubz.lk',
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
    'api.zanta-mini.store',
    'mizuki-md-api.netlify.app',
    'whiteshadow-x-api.onrender.com',
    'kavindu-download-web.vercel.app',
    'cz-dnuz.vercel.app'
];

function isValidMovieImage(imgUrl) {
    if (!imgUrl || typeof imgUrl !== 'string') return false;
    try {
        const parsed = new URL(imgUrl);
        const host = parsed.hostname.toLowerCase();
        return ALLOWED_IMAGE_HOSTS.some(allowed => host === allowed || host.endsWith('.' + allowed));
    } catch (e) {
        return false;
    }
}

function sanitizeText(str, maxLen = 80) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[\r\n\t]+/g, ' ').replace(/[*_~`]/g, '').trim().substring(0, maxLen);
}

const rateLimitMap = new Map();
function isRateLimited(identifier, limitSeconds = 15) {
    const now = Date.now();
    const lastTime = rateLimitMap.get(identifier);
    if (lastTime && (now - lastTime) < limitSeconds * 1000) {
        return true;
    }
    rateLimitMap.set(identifier, now);
    if (rateLimitMap.size > 2000) {
        for (const [key, val] of rateLimitMap.entries()) {
            if (now - val > 60000) rateLimitMap.delete(key);
        }
    }
    return false;
}

// 🔥 In-memory Verified Movies Catalog Cache
const verifiedMoviesCache = new Map();

function cacheVerifiedMovies(results) {
    if (!Array.isArray(results)) return;
    for (const mv of results) {
        if (mv && mv.title) {
            const k = sanitizeText(mv.title, 80).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (k) verifiedMoviesCache.set(k, { title: mv.title.trim(), img: mv.img || mv.poster || '' });
        }
    }
    if (verifiedMoviesCache.size > 5000) {
        const keys = Array.from(verifiedMoviesCache.keys());
        for (let i = 0; i < 1000; i++) verifiedMoviesCache.delete(keys[i]);
    }
}

// 🔥 Failed attempts & IP Banning
const failedAttempts = new Map();
const bannedIps = new Map();

function isIpBanned(ip) {
    const banUntil = bannedIps.get(ip);
    if (banUntil) {
        if (Date.now() < banUntil) return true;
        bannedIps.delete(ip);
        failedAttempts.delete(ip);
    }
    return false;
}

function recordSuspiciousRequest(ip) {
    const attempts = (failedAttempts.get(ip) || 0) + 1;
    failedAttempts.set(ip, attempts);
    if (attempts >= 2) {
        bannedIps.set(ip, Date.now() + 60 * 60 * 1000); // 1 hour ban
        console.warn(`[SECURITY] 🚨 IP ${ip} has been BANNED for 1 hour due to repeated forged requests.`);
    }
}

// 🛡️ Request Payload Decryptor (Protects Network tab from revealing sensitive data & kills cURL)
function decryptPayload(body) {
    if (!body || !body._enc || !body._t) return null;
    const ts = Number(body._t);
    const now = Date.now();
    // 5 minutes expiry window
    if (!ts || Math.abs(now - ts) > 300000) {
        throw new Error('Expired request session');
    }
    const salt = 'sAdEw_2026_x!';
    const rawBinary = Buffer.from(body._enc, 'base64').toString('binary');
    let decrypted = '';
    for (let i = 0; i < rawBinary.length; i++) {
        const charCode = rawBinary.charCodeAt(i) ^ salt.charCodeAt(i % salt.length) ^ ((ts >> (i % 8)) & 0xFF);
        decrypted += String.fromCharCode(charCode);
    }
    const jsonStr = decodeURIComponent(escape(decrypted));
    return JSON.parse(jsonStr);
}

// 🛡️ Strict Sri Lankan Mobile Phone Validator
function validateSLPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    let clean = phone.replace(/[\s\-\(\)\+]/g, '');
    if (clean.startsWith('94')) clean = '0' + clean.slice(2);
    else if (clean.length === 9 && clean.startsWith('7')) clean = '0' + clean;
    if (!/^07[01245678]\d{7}$/.test(clean)) return null;
    const last7 = clean.slice(3);
    if (/^(\d)\1{6}$/.test(last7)) return null;
    if (last7 === '1234567' || last7 === '7654321' || last7 === '0123456') return null;
    return clean;
}

// 🛡️ Video Quality Sanitizer, Smart Normalizer & Exploit Blocker
function sanitizeQuality(q, clientIp = '') {
    if (!q || typeof q !== 'string') return 'HD';
    
    let trimmed = q.trim();
    if (!trimmed) return 'HD';

    // 1. Attack / exploit / shell / injection keywords check
    const attackKeywords = /(?:root|anonymous|hack|pwn|\bcat\b|\/etc|\betc\/|\bbin\/|\busr\/|\bdev\/|\bsh\b|\bbash\b|\bcmd\b|powershell|curl|wget|http|https|www|shadow|passwd|chmod|chown|kill|sudo|exec|eval|select\b|insert\b|union\b|delete\b|drop\b|script|<|>|base64|localhost|127\.0\.0\.1)/i;
    
    // 2. Reject forbidden symbols commonly used in shell exploits (@, #, \, $, ;, `, ~, !, %, ^, &, *, +, =, ?, |, {, })
    const dangerousSymbols = /[@#\\$;`~!%^&*+=|{}?]/;

    if (attackKeywords.test(trimmed) || dangerousSymbols.test(trimmed)) {
        console.warn(`[SECURITY] 🚨 Blocked forged/malicious quality payload: "${trimmed.substring(0, 50)}" from IP: ${clientIp}`);
        if (clientIp) recordSuspiciousRequest(clientIp);
        return 'HD';
    }

    // 3. Strip colons or slashes safely (e.g. "Quality: 720p" -> "Quality 720p")
    trimmed = trimmed.replace(/[:\/]/g, ' ');

    // 4. Smart Quality & Resolution Normalization (cleanly handles "gdriver", "pixeldrain", "web dl", "mkv", "av1", etc.)
    let res = '';
    if (/\b(2160p|4k|uhd)\b/i.test(trimmed)) res = '4K';
    else if (/\b(1080p|fhd)\b/i.test(trimmed)) res = '1080p';
    else if (/\b(720p)\b/i.test(trimmed)) res = '720p';
    else if (/\b(480p)\b/i.test(trimmed)) res = '480p';
    else if (/\b(360p)\b/i.test(trimmed)) res = '360p';
    else if (/\b(hd|sd)\b/i.test(trimmed)) {
        const m = trimmed.match(/\b(hd|sd)\b/i);
        res = m[1].toUpperCase();
    }

    let ep = '';
    const epMatch = trimmed.match(/\b(episode|ep)\s*(\d+)\b/i);
    if (epMatch) {
        ep = `Episode ${parseInt(epMatch[2])}`;
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

    if (ep && res) {
        return size ? `${ep} - ${res} (${size})` : `${ep} - ${res}`;
    }
    if (ep) {
        return size ? `${ep} (${size})` : ep;
    }
    if (res && size) {
        return `${res} - ${size}`;
    }
    if (res && tag) {
        return `${res} ${tag}`;
    }
    if (res) {
        return res;
    }
    if (tag && size) {
        return `HD (${tag} - ${size})`;
    }
    if (tag) {
        return `HD (${tag})`;
    }
    if (size) {
        return `HD (${size})`;
    }

    // Server names or download terms with no resolution fallback to 'HD'
    if (/gdrive|driver|drive|pixeldrain|pixdrogon|download|direct|server|link|stream/i.test(trimmed)) {
        return 'HD';
    }

    // 5. General safe text fallback
    const clean = trimmed.replace(/[^a-zA-Z0-9\s\-_.()[\]]/g, '').replace(/\s+/g, ' ').substring(0, 25).trim();
    if (!clean || clean.length < 2) return 'HD';

    return clean;
}

const GEMINI_KEYS = [
    process.env.GEMINI_KEY_1, process.env.GEMINI_KEY_2, process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4, process.env.GEMINI_KEY_5, process.env.GEMINI_KEY_6
].filter(Boolean);

async function getGeminiSummary(movieTitle) {
    if (!movieTitle) return "";
    const cleanSearchTitle = movieTitle.split('|')[0]
        .replace(/sinhala subtitles|සිංහල උපසිරැසි|sinhala sub|subtitles/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    const prompt = `Write a short, engaging summary and description (max 4 sentences) for the movie, tv series or anime "${cleanSearchTitle}". Do not include spoilers. Write it beautifully in Sinhala language mixed with English words. Add matching emojis.`;
    const models = ['gemini-3.6-flash', 'gemini-3.1-flash-lite'];

    if (GEMINI_KEYS.length === 0) {
        console.warn("[GEMINI] ⚠️ No GEMINI_KEY_1..6 found in environment!");
        return "";
    }

    for (const key of GEMINI_KEYS) {
        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
                const response = await axios.post(url, { 
                    contents: [{ parts: [{ text: prompt }] }],
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                }, { timeout: 8000 });
                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    console.log(`[GEMINI] ✅ AI Summary generated successfully with ${model}`);
                    return response.data.candidates[0].content.parts[0].text.trim();
                }
            } catch (err) {
                // Continue to next model/key
            }
        }
    }
    return ""; 
}

// 🔥 Dynamic විදිහට අදාල නම්බර් එකේ Socket එක ගන්නවා 🔥
function getActiveSocket(targetBotNumber) {
    const activeSockets = global.activeSockets;
    if (!activeSockets || activeSockets.size === 0) return null;
    
    const numberToUse = targetBotNumber || FALLBACK_BOT_NUMBER;
    const sessionData = activeSockets.get(numberToUse) || Array.from(activeSockets.values())[0];
    return sessionData.socket || sessionData;
}

async function sendMediaSafely(sock, jid, msgParams, timeoutMs = 360000, retries = 0) {
    try {
        const sendPromise = sock.sendMessage(jid, msgParams);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload Timeout")), timeoutMs));
        return await Promise.race([sendPromise, timeoutPromise]);
    } catch (error) {
        throw error;
    }
}

// 🔥 High-Speed Concurrent Task Queue (Up to 2 simultaneous movie streams)
const taskQueue = {
    queue: [], active: [], maxActive: 2,
    add: function(task) { this.queue.push(task); this.processNext(); },
    processNext: async function() {
        if (this.active.length >= this.maxActive || this.queue.length === 0) return;
        const task = this.queue.shift();
        this.active.push(task);
        (async () => {
            try {
                console.log(`[QUEUE] Starting Task: ${task.info.title}`);
                await task.run();
            } catch (e) {
                console.error(`[QUEUE] Error:`, e.message);
            } finally {
                this.active = this.active.filter(t => t.id !== task.id);
                this.processNext();
            }
        })();
        if (this.queue.length > 0 && this.active.length < this.maxActive) {
            this.processNext();
        }
    }
};

router.get('/api/queue', (req, res) => { res.json({ active: taskQueue.active.length > 0 ? taskQueue.active[0].info : null, queue: taskQueue.queue.map(t => t.info) }); });

router.post('/api/search', async (req, res) => {
    const { query, source } = req.body;
    try {
        if (source === 'sinhalasub2') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/sinhalasub/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        if (source === 'slcartoons') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/slcartoons/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        if (source === 'moviesublk') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/moviesub/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        if (source === 'baiscopes') {
            const searchRes = await axios.get(`https://mizuki-md-api.netlify.app/api/movie/baiscopes/search?q=${encodeURIComponent(query)}&apiKey=slk_feb4c1b4888e42998f43b746336ca25e`, { headers: HEADERS });
            if (searchRes.data?.status && searchRes.data.data?.length > 0) {
                const results = searchRes.data.data.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.image, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        if (source === 'sublk') {
            const searchRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/movie/sublk/search?q=${encodeURIComponent(query)}&apitoken=4ehG6P`, { headers: HEADERS });
            if (searchRes.data?.status && searchRes.data.result?.length > 0) {
                const results = searchRes.data.result.slice(0, 8).map(mv => ({ title: mv.title, url: mv.link, img: mv.image, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        if (source === 'kdrama') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/kdrama/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source }));
                cacheVerifiedMovies(results);
                return res.json({ success: true, results });
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
        const searchRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data.success && searchRes.data.result?.length > 0) {
            const results = searchRes.data.result.slice(0, 8).map(mv => ({ ...mv, source: 'cinesubz' }));
            cacheVerifiedMovies(results);
            return res.json({ success: true, results });
        }
        res.json({ success: false });
    } catch (error) { res.json({ success: false }); }
});

router.post('/api/links', async (req, res) => {
    const { url, source } = req.body;
    try {
        if (source === 'sinhalasub2') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/sinhalasub/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success) return res.json({ success: false });
            const links = dlRes.data.results.links || [];
            if (!links.length) return res.json({ success: false });
            const downloads = links.map(l => ({ meta: `${l.quality || 'Download'} - ${l.size || ''}`, resolvedUrl: l.direct_link || l.link, direct: true })).filter(l => l.resolvedUrl);
            return res.json({ success: true, downloads, thumbnail: dlRes.data.results.thumbnail, rating: dlRes.data.results.rating });
        }
        if (source === 'slcartoons') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/slcartoons/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.results) return res.json({ success: false });
            const details = dlRes.data.results;
            let downloads = [];
            if (details.episodes?.length > 0) details.episodes.forEach(ep => { if (ep.stream_url) downloads.push({ meta: ep.title, resolvedUrl: ep.stream_url, direct: true }); });
            else if (details.download_links?.length > 0) details.download_links.forEach(dl => { if (dl.final_link && !dl.final_link.includes('t.me')) downloads.push({ meta: dl.info || 'Direct Link', resolvedUrl: dl.final_link, direct: true }); });
            if (downloads.length > 0) return res.json({ success: true, downloads, thumbnail: details.thumbnail });
            return res.json({ success: false });
        }
        if (source === 'moviesublk') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/moviesub/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success) return res.json({ success: false });
            const data = dlRes.data;
            let downloads = [];
            if (data.download_links && Array.isArray(data.download_links) && data.download_links.length > 0) {
                data.download_links.forEach((dl, idx) => { if (dl.final_link || dl.url || dl.link) { downloads.push({ meta: dl.info || dl.quality || `Link ${idx+1}`, resolvedUrl: dl.final_link || dl.url || dl.link, direct: true }); } });
            } else if (data.direct_download_url) {
                let btnName = data.is_series ? "📥 Download Full Series (ZIP)" : "📥 Download Movie";
                downloads.push({ meta: btnName, resolvedUrl: data.direct_download_url, direct: true });
            }
            if (downloads.length > 0) return res.json({ success: true, downloads, thumbnail: data.image });
            return res.json({ success: false });
        }
        if (source === 'baiscopes') {
            try {
                const resData = await axios.get(`https://mizuki-md-api.netlify.app/api/movie/baiscopes/movie?q=${encodeURIComponent(url)}&apiKey=slk_feb4c1b4888e42998f43b746336ca25e`, { headers: HEADERS });
                if (resData.data?.status && resData.data.data?.dl_links) {
                    let downloads = resData.data.data.dl_links.map(l => ({ meta: l.size ? `${l.size}` : (l.quality || 'Download'), resolvedUrl: l.direct || l.link || l.url, direct: true })).filter(l => l.resolvedUrl); 
                    return res.json({ success: true, downloads, thumbnail: resData.data.data.poster });
                }
            } catch (err) {}
            return res.json({ success: false });
        }
        if (source === 'sublk') {
            try {
                const resData = await axios.get(`https://whiteshadow-x-api.onrender.com/api/movie/sublk?url=${encodeURIComponent(url)}&apitoken=4ehG6P`, { headers: HEADERS });
                if (resData.data?.result?.downloadLinks) {
                    let downloads = resData.data.result.downloadLinks.map(l => ({ meta: `${l.quality} - ${l.size}`, resolvedUrl: l.downloadUrl || l.link, direct: false }));
                    return res.json({ success: true, downloads, thumbnail: resData.data.result.image });
                }
            } catch (err) {}
            return res.json({ success: false });
        }
        if (source === 'kdrama') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/kdrama/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success || !dlRes.data.results?.episodes_list?.length) return res.json({ success: false });
            const episodes = dlRes.data.results.episodes_list;
            let downloads = episodes.map(ep => ({ meta: ep.title || 'Episode', resolvedUrl: ep.download_link, direct: false }));
            return res.json({ success: true, downloads, thumbnail: dlRes.data.results.thumbnail });
        }
        if (source === '1tamilmv') {
            const dlRes = await axios.get(url, { headers: HEADERS, timeout: 20000 });
            const $ = cheerio.load(dlRes.data);
            let img = null;
            $('img.ipsImage, img.bbc_img').each((i, el) => { let src = $(el).attr('data-src') || $(el).attr('src'); if (src && src.startsWith('http') && !src.includes('data:image') && !img) img = src; });
            let downloads = [], currentTitle = "Movie", currentSizeMB = 0;
            $('[data-role="commentContent"] *').each((i, el) => {
                const text = $(el).text().trim();
                if (el.tagName !== 'a' && el.tagName !== 'img' && text.length > 5) {
                    if (text.match(/([0-9\.]+(MB|GB))|([0-9]{3,4}p)|(Episode [0-9]+)/i) && text.length < 150) {
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
            if(downloads.length > 0) return res.json({ success: true, downloads, thumbnail: img });
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
        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) { res.json({ success: false }); }
});

// ── SEND TO GROUP (DIRECT STREAM + AI) ──
router.post('/api/send-movie', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (typeof clientIp === 'string' && clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }
    if (typeof clientIp === 'string' && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
    }

    // 🛡️ 1. IP Ban Check
    if (isIpBanned(clientIp)) {
        return res.status(403).json({ success: false, message: '🚫 Your IP has been temporarily blocked due to suspicious activity.' });
    }

    // 🛡️ 2. Anti-Bot & Anti-CLI Check (Block curl, postman, python, automated scripts)
    const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
    if (userAgent.includes('curl') || userAgent.includes('postman') || userAgent.includes('python') || userAgent.includes('httpclient') || userAgent.includes('insomnia') || userAgent.includes('node-fetch') || userAgent.includes('axios')) {
        console.warn(`[SECURITY] 🚨 Blocked CLI/curl request from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Direct script access is blocked.' });
    }

    const origin = req.headers['origin'] || '';
    const referer = req.headers['referer'] || '';
    if (!origin && !referer) {
        console.warn(`[SECURITY] 🚨 Blocked request without Origin/Referer from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Direct API access without web browser is forbidden.' });
    }

    // 🛡️ 3. Decrypt and verify payload (Blocks DevTools / Network tab inspection & direct curl)
    let payload = null;
    try {
        payload = decryptPayload(req.body);
    } catch (decErr) {
        console.warn(`[SECURITY] 🚨 Failed to decrypt payload from IP ${clientIp}: ${decErr.message}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Invalid or expired session.' });
    }

    if (!payload || typeof payload !== 'object') {
        console.warn(`[SECURITY] 🚨 Unencrypted payload or direct curl attempt from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Access Denied.' });
    }

    const { title, url, quality, reqName, reqNum, source, img, imdb, batchIndex, admin_id } = payload;

    // 🛡️ 4. Rate Limiting Check (Spam Prevention)
    const rateLimitKey = `${clientIp}_${reqNum || ''}`;
    if (isRateLimited(rateLimitKey, 15)) {
        return res.status(429).json({ success: false, message: '⚠️ කරුණාකර තත්පර 15ක් රැඳී සිට නැවත උත්සාහ කරන්න.' });
    }

    // 🛡️ 5. Requester Validation (Strict SL Mobile Phone)
    const cleanReqName = sanitizeText(reqName, 30);
    if (!cleanReqName || cleanReqName.length < 1) {
        return res.status(400).json({ success: false, message: 'කරුණාකර ඔබගේ නම ඇතුළත් කරන්න.' });
    }

    const validPhone = validateSLPhone(reqNum);
    if (!validPhone) {
        return res.status(400).json({ success: false, message: 'කරුණාකර වලංගු ශ්‍රී ලංකා දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0772345678).' });
    }
    const cleanReqNum = validPhone;

    // 🛡️ 6. Title & Quality Validation
    const cleanTitle = sanitizeText(title, 80);
    const cleanQuality = sanitizeQuality(quality, clientIp);
    if (!cleanTitle || cleanTitle.length < 2) {
        return res.status(400).json({ success: false, message: 'Invalid movie title.' });
    }

    // Block defacement / hacker keywords in title
    const suspiciousTitle = /(?:hacked|anonymous|pwned|defaced|root@|\/etc|\bcat\b|<script|curl)/i;
    if (suspiciousTitle.test(cleanTitle)) {
        console.warn(`[SECURITY] 🚨 Blocked suspicious title "${cleanTitle}" from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(400).json({ success: false, message: '❌ Invalid movie title.' });
    }

    // 🛡️ 7. Image Security Check: If provided, verify against trusted sources (allow null if movie has no poster)
    const cleanImg = isValidMovieImage(img) ? img : null;

    // 🛡️ 8. Catalog Verification: Ensure the movie actually exists!
    const normKey = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    let verifiedMovie = verifiedMoviesCache.get(normKey);

    if (!verifiedMovie && (!source || source === 'cinesubz')) {
        try {
            const verifyRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(cleanTitle.substring(0, 30))}`, { timeout: 6000 });
            if (verifyRes.data?.success && verifyRes.data.result?.length > 0) {
                const found = verifyRes.data.result.find(m => {
                    const k = sanitizeText(m.title, 80).toLowerCase().replace(/[^a-z0-9]/g, '');
                    return k.includes(normKey) || normKey.includes(k);
                }) || verifyRes.data.result[0];

                if (found) {
                    verifiedMovie = { title: found.title.trim(), img: found.img };
                    verifiedMoviesCache.set(normKey, verifiedMovie);
                }
            }
        } catch (e) {}
    }

    // For verified sources (or cache misses), safe title fallback
    if (!verifiedMovie) {
        verifiedMovie = { title: cleanTitle, img: cleanImg || '' };
    }

    // Official Title
    const verifiedTitle = verifiedMovie.title;
    const finalPoster = isValidMovieImage(verifiedMovie.img) ? verifiedMovie.img : (cleanImg || null);

    // 🛡️ 9. URL Security Check
    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        recordSuspiciousRequest(clientIp);
        return res.status(400).json({ success: false, message: 'Invalid download URL format.' });
    }

    const taskId = crypto.randomBytes(4).toString('hex');
    
    // ⚙️ මුලින්ම Fallbacks සෙට් කරනවා
    let dynamicBotNumber = FALLBACK_BOT_NUMBER;
    let dynamicGroupJid = FALLBACK_GROUP_JID;
    let dynamicFooter = 'Sadew Web Sender';

    try {
        // 🔥 Admin_id එකක් ආවොත් Database එකෙන් අදාල කස්ටමර්ගේ Settings ගන්නවා
        if (admin_id) {
            const adminData = await Admin.findOne({ username: String(admin_id).trim() });
            if (adminData) {
                if (adminData.bot_number) dynamicBotNumber = adminData.bot_number;
                if (adminData.group_jid) dynamicGroupJid = adminData.group_jid;
                if (adminData.footer_text) dynamicFooter = sanitizeText(adminData.footer_text, 50);
            }
        }
    } catch (dbErr) { 
        console.error('DB fetch error for Sub-Admin:', dbErr.message); 
    }

    taskQueue.add({
        id: taskId,
        info: { title: verifiedTitle, quality: cleanQuality, reqName: cleanReqName, userNum: cleanReqNum },
        run: async () => {
            // 🔥 Database එකෙන් ගත්ත නිවැරදි Bot Socket එක අරගන්නවා
            const sock = getActiveSocket(dynamicBotNumber);
            if (!sock) {
                console.error(`Socket not found for bot number: ${dynamicBotNumber}`);
                return;
            }

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                let finalVidUrl = url;

                if (finalVidUrl.includes('drive.google') || finalVidUrl.includes('drive.usercontent')) {
                    let match = finalVidUrl.match(/\/file\/d\/([^\/]+)/) || finalVidUrl.match(/[?&]id=([^&]+)/) || finalVidUrl.match(/\/d\/([^\/]+)/);
                    if (match) {
                        const fileId = match[1];
                        try {
                            const wsRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/download/gdrive?url=${encodeURIComponent(`https://drive.google.com/file/d/${fileId}/view`)}&apitoken=4ehG6P`);
                            if (wsRes.data?.success && wsRes.data.downloadUrl) { finalVidUrl = wsRes.data.downloadUrl; }
                        } catch(e) {}
                    }
                }

                if (source === 'kdrama') {
                    const page1 = await axios.get(url, { httpsAgent });
                    const $1 = cheerio.load(page1.data);
                    const formData = {};
                    $1('form').first().find('input[type="hidden"]').each((i, el) => { formData[$1(el).attr('name')] = $1(el).attr('value'); });
                    const page2 = await axios.post(url, qs.stringify(formData), {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': url, 'User-Agent': 'Mozilla/5.0' }, httpsAgent
                    });
                    const $2 = cheerio.load(page2.data);
                    let directLink = $2('a').filter((i, el) => $2(el).text().trim() === 'Start download').attr('href');
                    if (!directLink) directLink = $2('.btn-success').attr('href') || $2('a[href*=".mkv"]').attr('href') || $2('a[href*=".mp4"]').attr('href');
                    if (directLink) { finalVidUrl = directLink; } else { throw new Error("KDrama Direct Link Bypass Failed"); }
                }

                if (source === 'cinesubz' && (finalVidUrl.includes('drive.csplayer') || finalVidUrl.includes('server'))) {
                    const tryDownloadUrl = async (urlToTry) => {
                        try {
                            const dlApiUrl = `${CZ_API}/download?url=${encodeURIComponent(urlToTry)}`;
                            const dlRes = await axios.get(dlApiUrl, { timeout: 8000 });
                            if (dlRes.data?.success && dlRes.data?.result?.downloadUrls) {
                                const httpUrl = dlRes.data.result.downloadUrls.find(u => u.url && u.url.startsWith('http') && !u.url.includes('t.me') && !u.url.includes('telegram.me') && !u.url.includes('telegram.dog'));
                                if (httpUrl) return httpUrl.url;
                            }
                        } catch (e) { return null; }
                        return null;
                    };

                    let resolvedStreamUrl = await tryDownloadUrl(finalVidUrl);
                    if (!resolvedStreamUrl && finalVidUrl.includes('/server')) {
                        console.log("[WEB CZ] Original server failed. Trying alternate servers...");
                        const altServers = ['1', '2', '3', '6', '10'];
                        for (let s of altServers) {
                            const altUrl = finalVidUrl.replace(/\/server\d+\//, `/server${s}/`);
                            if (altUrl === finalVidUrl) continue;
                            resolvedStreamUrl = await tryDownloadUrl(altUrl);
                            if (resolvedStreamUrl) break;
                        }
                    }
                    if (resolvedStreamUrl) { finalVidUrl = resolvedStreamUrl; } else { throw new Error("DanuZz API Cinesubz bypass failed on Web Server."); }
                }

                // 🔥 DINKAMOVIES (Cloudflare Proxy 2GB Stream) 🔥
                if (source === 'dinkamovies') {
                    let fileId = null;
                    if (finalVidUrl.includes('drive.google.com')) {
                        let m = finalVidUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || finalVidUrl.match(/id=([a-zA-Z0-9_-]+)/) || finalVidUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                        if (m) fileId = m[1];
                    }

                    if (fileId) {
                        // අපේ Cloudflare Proxy එක!
                        finalVidUrl = `https://sadew.sadewrashmika069.workers.dev/download?key=sadew123&id=${fileId}`;
                    }
                }

                if (isFirstInBatch) {
                    // 🔥 1. ඒ වෙලාවේ ඇත්තටම කනෙක්ට් වෙලා වැඩ කරන බොට්ගේ ID එකම ගන්නවා (වරදින්නේ නෑ)
                    const exactBotJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const adminInboxText = `📌 *New Request Started!*\n🎬 *Title:* ${verifiedTitle}\n✨ *Quality:* ${cleanQuality}\n👤 *By:* ${cleanReqName}\n📞 *Number:* ${cleanReqNum}\n🌐 *IP:* ${clientIp}`;
                    
                    // 🔥 2. Admin ගේ ඉන්බොක්ස් එකට (Yourself) යවනවා
                    try {
                        await sock.sendMessage(exactBotJid, { text: adminInboxText });
                    } catch (e) {
                        console.log("Inbox Notification Error:", e.message);
                    }
                    
                    // 3. (ගෲප් එකට යවන කොටස)
                    const aiSummary = await getGeminiSummary(verifiedTitle);
                    
                    let cap = `🎬 *${verifiedTitle}*\n✨ *Quality:* ${cleanQuality}\n\n`;
                    if (aiSummary) cap += `📖 *Summary:*\n${aiSummary}\n\n`;
                    cap += `👤 *Required By:* ${cleanReqName}\n\n> *${dynamicFooter}*`;

                    // 🛡️ SEND SUMMARY: WITH POSTER IF AVAILABLE, OR AS TEXT IF NO POSTER!
                    if (finalPoster) {
                        try {
                            await sendMediaSafely(sock, dynamicGroupJid, { image: { url: finalPoster }, caption: cap }, 60000);
                        } catch (imgErr) {
                            console.log("[SEND] Poster send failed, sending text message with AI summary instead:", imgErr.message);
                            await sendMediaSafely(sock, dynamicGroupJid, { text: cap }, 30000);
                        }
                    } else {
                        // Poster එකක් නැති චිත්‍රපට සඳහා AI Summary එක Text Message එකක් ලෙස යවන්න
                        await sendMediaSafely(sock, dynamicGroupJid, { text: cap }, 30000);
                    }
                }

                if (source === 'baiscopes' && finalVidUrl.includes('t.me')) {
                    const teleText = `📥 *Telegram Link Detected!*\n🎬 *Title:* ${verifiedTitle}\n✨ *Quality:* ${cleanQuality}\n\nකරුණාකර පහත ලින්ක් එකෙන් ගොස් Telegram හරහා චිත්රපටය ලබාගන්න:\n🔗 ${finalVidUrl}\n\n👤 *Required By:* ${cleanReqName}\n\n> *${dynamicFooter}*`;
                    await sendMediaSafely(sock, dynamicGroupJid, { text: teleText }, 30000);
                    return; 
                }

                let streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 30000, headers: HEADERS, httpsAgent });
                
                if (streamRes.headers['content-length'] && parseInt(streamRes.headers['content-length']) > 2 * 1024 * 1024 * 1024) {
                    try{ streamRes.data.destroy(); }catch(e){}
                    await sendMediaSafely(sock, dynamicGroupJid, { text: `⚠️ *File Too Large (>2GB)*\n🔗 ${url}` });
                    return;
                }

                const mimeType = (finalVidUrl.includes('.mkv') || (streamRes.headers['content-type'] && streamRes.headers['content-type'].includes('matroska'))) ? 'video/x-matroska' : 'video/mp4';
                const fileExt = mimeType === 'video/x-matroska' ? 'mkv' : 'mp4';
                
                // 🛡️ Format Safe Document File Name (no rogue characters, no leading dashes)
                const safeMovieTitle = verifiedTitle.substring(0, 35).replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() || 'Movie';
                const safeQualityForFile = cleanQuality.replace(/[^a-zA-Z0-9\-.]/g, ' ').replace(/\s+/g, ' ').trim() || 'HD';
                let fileName = `${safeMovieTitle} - ${safeQualityForFile}.${fileExt}`;
                let smallCaption = isBatch && !isFirstInBatch ? `🎬 *${cleanQuality}*\n👤 *Required By:* ${cleanReqName}\n> *${dynamicFooter}*` : `🎬 *${verifiedTitle}*\n> *${dynamicFooter}*`;

                await sendMediaSafely(sock, dynamicGroupJid, { document: { stream: streamRes.data }, mimetype: mimeType, fileName, caption: smallCaption });
                
            } catch (err) {
                const errMsg = err.response ? `HTTP ${err.response.status}` : err.message;
                try { await sendMediaSafely(sock, dynamicGroupJid, { text: `❌ *Failed:* ${verifiedTitle} - ${cleanQuality}\n_Error: ${errMsg}_` }, 30000); } catch(e){}
            }
        }
    });
    res.json({ success: true, taskId, position: taskQueue.queue.length });
});

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
        res.json({ success: true, videoname, thumbnail, episodes: episodes.slice(0, 30) });
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

    // 🛡️ 1. IP Ban Check
    if (isIpBanned(clientIp)) {
        return res.status(403).json({ success: false, message: '🚫 Your IP has been temporarily blocked.' });
    }

    // 🛡️ 2. Anti-Bot & Anti-CLI Check (Block curl, postman, python, automated scripts)
    const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
    if (userAgent.includes('curl') || userAgent.includes('postman') || userAgent.includes('python') || userAgent.includes('httpclient') || userAgent.includes('insomnia') || userAgent.includes('node-fetch') || userAgent.includes('axios')) {
        console.warn(`[SECURITY] 🚨 Blocked CLI/curl anime request from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Direct script access is blocked.' });
    }

    const origin = req.headers['origin'] || '';
    const referer = req.headers['referer'] || '';
    if (!origin && !referer) {
        console.warn(`[SECURITY] 🚨 Blocked anime request without Origin/Referer from IP ${clientIp}`);
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Direct API access without web browser is forbidden.' });
    }

    // 🛡️ 3. Decrypt Payload
    let payload = null;
    try {
        payload = decryptPayload(req.body);
    } catch (decErr) {
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Invalid or expired session.' });
    }

    if (!payload || typeof payload !== 'object') {
        recordSuspiciousRequest(clientIp);
        return res.status(403).json({ success: false, message: '🚫 Access Denied.' });
    }

    const { id, hash, epNum, videoname, thumbnail, reqName, reqNum, batchIndex, admin_id } = payload;

    // 🛡️ 4. Rate Limiting Check
    const rateLimitKey = `${clientIp}_${reqNum || ''}`;
    if (isRateLimited(rateLimitKey, 15)) {
        return res.status(429).json({ success: false, message: '⚠️ කරුණාකර තත්පර 15ක් රැඳී සිට නැවත උත්සාහ කරන්න.' });
    }

    // 🛡️ 5. Validation & Sanitization
    const cleanReqName = sanitizeText(reqName, 30);
    if (!cleanReqName || cleanReqName.length < 1) {
        return res.status(400).json({ success: false, message: 'කරුණාකර ඔබගේ නම ඇතුළත් කරන්න.' });
    }

    const validPhone = validateSLPhone(reqNum);
    if (!validPhone) {
        return res.status(400).json({ success: false, message: 'කරුණාකර වලංගු ශ්‍රී ලංකා දුරකථන අංකයක් ඇතුළත් කරන්න (උදා: 0772345678).' });
    }
    const cleanReqNum = validPhone;

    const cleanVideoname = sanitizeText(videoname, 80);
    const cleanThumbnail = isValidMovieImage(thumbnail) ? thumbnail : null;
    const cleanEpNum = parseInt(epNum) || 1;

    if (!id || typeof id !== 'string') {
        recordSuspiciousRequest(clientIp);
        return res.status(400).json({ success: false, message: 'Invalid anime ID.' });
    }

    const taskId = crypto.randomBytes(4).toString('hex');

    // ⚙️ මුලින්ම Fallbacks සෙට් කරනවා
    let dynamicBotNumber = FALLBACK_BOT_NUMBER;
    let dynamicGroupJid = FALLBACK_GROUP_JID;
    let dynamicFooter = 'Sadew Web Sender';

    try {
        if (admin_id) {
            const adminData = await Admin.findOne({ username: String(admin_id).trim() });
            if (adminData) {
                if (adminData.bot_number) dynamicBotNumber = adminData.bot_number;
                if (adminData.group_jid) dynamicGroupJid = adminData.group_jid;
                if (adminData.footer_text) dynamicFooter = sanitizeText(adminData.footer_text, 50);
            }
        }
    } catch (dbErr) { 
        console.error('DB fetch error for Anime Sub-Admin:', dbErr.message); 
    }

    taskQueue.add({
        id: taskId,
        info: { title: cleanVideoname, quality: `Episode ${cleanEpNum}`, reqName: cleanReqName, userNum: cleanReqNum },
        run: async () => {
            const sock = getActiveSocket(dynamicBotNumber);
            if (!sock) return;

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                if (isFirstInBatch) {
                    await sendMediaSafely(sock, dynamicBotNumber + '@s.whatsapp.net', { text: `📌 *New Anime Requested!*\n🎬 *Title:* ${cleanVideoname} - Ep ${cleanEpNum}\n👤 *By:* ${cleanReqName}\n📞 *Number:* ${cleanReqNum}\n🌐 *IP:* ${clientIp}` }, 30000);
                    const aiSummary = await getGeminiSummary(cleanVideoname);
                    const seriesHtml = (await axios.get(`${ANIME_BASE}/anime.php?${id}`, { headers: HEADERS })).data;
                    const descMatch = seriesHtml.match(/<div class=['"]infodes c['"]>([\s\S]*?)<\/div>/i);
                    let origDesc = descMatch ? descMatch[1].trim().replace(/<[^>]+>/g, '') : cleanVideoname;
                    if (origDesc.length > 300) origDesc = origDesc.substring(0, 300) + '...';

                    let cardText = `🎬 *${cleanVideoname}*\n\n`;
                    if (aiSummary) { cardText += `📖 *Summary:*\n${aiSummary}\n\n`; } else { cardText += `📝 *Description:*\n${origDesc}\n\n`; }
                    cardText += `👤 *Required By:* ${cleanReqName}\n\n> *${dynamicFooter}*`;

                    if (cleanThumbnail) {
                        try {
                            await sendMediaSafely(sock, dynamicGroupJid, { image: { url: cleanThumbnail }, caption: cardText }, 60000);
                        } catch (imgErr) {
                            console.log("[SEND] Anime poster failed, sending text description:", imgErr.message);
                            await sendMediaSafely(sock, dynamicGroupJid, { text: cardText }, 30000);
                        }
                    } else {
                        await sendMediaSafely(sock, dynamicGroupJid, { text: cardText }, 30000);
                    }
                }

                const gateHtml = (await axios.get(`${ANIME_BASE}/gate.php`, { headers: { ...HEADERS, 'Referer': `${ANIME_BASE}/anime.php?${id}`, 'Cookie': `key=${hash}` } })).data;
                let finalDlLink = '';
                const downloadRegex = /<a\s+href=['"](https?:\/\/[a-z0-9]+\.animeheaven\.me\/video\.mp4\?[^'"]+)['"]/gi;
                let dlMatch = downloadRegex.exec(gateHtml);

                if (dlMatch) { finalDlLink = dlMatch[1]; } else {
                    const sourceRegex = /<source\s+src=['"]([^'"]+)['"]/gi;
                    let srcMatch;
                    while ((srcMatch = sourceRegex.exec(gateHtml)) !== null) {
                        let src = srcMatch[1];
                        if (src && !src.includes('&error')) {
                            if (src.startsWith('//')) src = 'https:' + src;
                            if (src.includes('.animeheaven.me')) { finalDlLink = src.replace(/&[a-z0-9]+$/, '&d'); break; }
                        }
                    }
                }

                if (!finalDlLink) throw new Error("Anime DL link not found");

                const streamRes = await axios({ url: finalDlLink, method: 'GET', responseType: 'stream', timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeheaven.me/' }});
                if ((streamRes.headers['content-type'] || '').includes('text/html')) { try { streamRes.data.destroy(); } catch(e){} throw new Error("Blocked by AnimeHaven"); }

                const safeAnimeTitle = cleanVideoname.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() || 'Anime';
                const fileName = `${safeAnimeTitle} - Ep ${cleanEpNum} [SADEW].mp4`;
                let epCaption = `🎬 Episode ${cleanEpNum}\n👤 *Required By:* ${cleanReqName}\n> *${dynamicFooter}*`;

                await sendMediaSafely(sock, dynamicGroupJid, { document: { stream: streamRes.data }, mimetype: 'video/mp4', fileName, caption: epCaption });
            } catch (err) {
                try { await sendMediaSafely(sock, dynamicGroupJid, { text: `❌ *Failed:* ${cleanVideoname} - Ep ${cleanEpNum}\n_Network dropped or timeout._` }, 30000); } catch(e){}
            }
        }
    });
    res.json({ success: true, taskId });
});
// 🔥 DINKAMOVIES API අලුත් කොටස 🔥
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

// මේක තමයි ෆයිල් එකේ යටම තියෙන පේළිය 👇
module.exports = router;
