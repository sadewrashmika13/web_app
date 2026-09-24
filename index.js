require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const qs = require('qs');
const https = require('https');
const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.get('/livestats', (req, res) => { res.json({ success: true }); });
app.get('/react', async (req, res) => { res.json({ success: true }); });
app.get('/follow', async (req, res) => { res.json({ success: true }); });

const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API_BASE = "https://api.zanta-mini.store";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";
const GROUP_JID = '120363425721300928@g.us'; 
const BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

// 🔥 අලුත් ක්‍රමයට API Keys ගැනීම (Github Secrets හරහා) 🔥
const GEMINI_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
    process.env.GEMINI_KEY_4,
    process.env.GEMINI_KEY_5,
    process.env.GEMINI_KEY_6
].filter(Boolean);

// 🔥 ඔයාගේ 3.1-flash-lite එක (කිසිම ෆිල්ම් එකක් Block වෙන්නේ නැති වෙන්න හැදුවා) 🔥
async function getGeminiSummary(movieTitle) {
    const prompt = `Write a short, engaging summary and description (max 4 sentences) for the movie, tv series or anime "${movieTitle}". Do not include spoilers. Write it beautifully in Sinhala language mixed with English words. Add matching emojis.`;
    
    for (let key of GEMINI_KEYS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
            const response = await axios.post(url, { 
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            }, { timeout: 15000 });
            
            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text.trim();
            }
        } catch (err) { }
    }
    return ""; 
}

function getActiveSocket() {
    const activeSockets = global.activeSockets;
    if (!activeSockets || activeSockets.size === 0) return null;
    const sessionData = activeSockets.get(BOT_NUMBER) || Array.from(activeSockets.values())[0];
    return sessionData.socket || sessionData;
}

async function sendMediaSafely(sock, jid, msgParams, timeoutMs = 600000) {
    const sendPromise = sock.sendMessage(jid, msgParams);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload Timeout")), timeoutMs));
    return Promise.race([sendPromise, timeoutPromise]);
}

// ════════════ 🚀 STRICTLY SEQUENTIAL QUEUE ════════════
const taskQueue = {
    queue: [],
    active: null,
    add: function(task) { 
        this.queue.push(task); 
        this.processNext(); 
    },
    processNext: async function() {
        if (this.active || this.queue.length === 0) return;
        this.active = this.queue.shift();
        try {
            console.log(`[QUEUE] Starting Task: ${this.active.info.title}`);
            await this.active.run();
        } catch (e) { 
            console.error(`[QUEUE] Error:`, e.message); 
        }
        this.active = null;
        this.processNext();
    }
};

app.get('/api/queue', (req, res) => { res.json({ active: taskQueue.active ? taskQueue.active.info : null, queue: taskQueue.queue.map(t => t.info) }); });

// ── SEARCH ──
app.post('/api/search', async (req, res) => {
    const { query, source } = req.body;
    try {
        if (source === 'sinhalasub2') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/sinhalasub/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) return res.json({ success: true, results: searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source })) });
            return res.json({ success: false });
        }

        if (source === 'slcartoons') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/slcartoons/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) return res.json({ success: true, results: searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source })) });
            return res.json({ success: false });
        }

        if (source === 'moviesublk') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/moviesub/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) return res.json({ success: true, results: searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source })) });
            return res.json({ success: false });
        }

        if (source === 'baiscopes') {
            const searchRes = await axios.get(`https://mizuki-md-api.netlify.app/api/movie/baiscopes/search?q=${encodeURIComponent(query)}&apiKey=slk_feb4c1b4888e42998f43b746336ca25e`, { headers: HEADERS });
            if (searchRes.data?.status && searchRes.data.data?.length > 0) return res.json({ success: true, results: searchRes.data.data.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.image, source })) });
            return res.json({ success: false });
        }

        if (source === 'sublk') {
            const searchRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/movie/sublk/search?q=${encodeURIComponent(query)}&apitoken=4ehG6P`, { headers: HEADERS });
            if (searchRes.data?.status && searchRes.data.result?.length > 0) return res.json({ success: true, results: searchRes.data.result.slice(0, 8).map(mv => ({ title: mv.title, url: mv.link, img: mv.image, source })) });
            return res.json({ success: false });
        }

        if (source === 'kdrama') {
            const searchRes = await axios.get(`${ZANTA_API_BASE}/api/kdrama/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) return res.json({ success: true, results: searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source })) });
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
            if(results.length > 0) return res.json({ success: true, results });
            return res.json({ success: false });
        }
        
        const searchRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data.success && searchRes.data.result?.length > 0) return res.json({ success: true, results: searchRes.data.result.slice(0, 8).map(mv => ({ ...mv, source: 'cinesubz' })) });
        res.json({ success: false });
    } catch (error) { res.json({ success: false }); }
});

// ── QUALITY / DOWNLOAD LINKS ──
app.post('/api/links', async (req, res) => {
    const { url, source } = req.body;
    try {
        // 🔥 Sinhalasub2 වල Pixeldrain ෆිල්ටර් එක අයින් කරලා තියෙන ඔක්කොම ලින්ක් පෙන්නන්න හැදුවා 🔥
        if (source === 'sinhalasub2') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/sinhalasub/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success) return res.json({ success: false });
            
            const links = dlRes.data.results.links || [];
            if (!links.length) return res.json({ success: false });
            
            const downloads = links.map(l => ({ 
                meta: `${l.quality || 'Download'} - ${l.size || ''}`, 
                resolvedUrl: l.direct_link || l.link, 
                direct: true 
            })).filter(l => l.resolvedUrl); // හිස් ලින්ක් අයින් කරයි
            
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
                data.download_links.forEach((dl, idx) => {
                    if (dl.final_link || dl.url || dl.link) {
                        downloads.push({ meta: dl.info || dl.quality || `Link ${idx+1}`, resolvedUrl: dl.final_link || dl.url || dl.link, direct: true });
                    }
                });
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
                    let downloads = resData.data.data.dl_links.map(l => ({ 
                        meta: l.size ? `${l.size}` : (l.quality || 'Download'), 
                        resolvedUrl: l.direct || l.link || l.url, 
                        direct: true 
                    })).filter(l => l.resolvedUrl); 
                    return res.json({ success: true, downloads, thumbnail: resData.data.data.poster });
                }
            } catch (err) {}
            return res.json({ success: false });
        }

        if (source === 'sublk') {
            try {
                const resData = await axios.get(`https://whiteshadow-x-api.onrender.com/api/movie/sublk?url=${encodeURIComponent(url)}&apitoken=4ehG6P`, { headers: HEADERS });
                if (resData.data?.result?.downloadLinks) {
                    let downloads = resData.data.result.downloadLinks.map(l => ({ 
                        meta: `${l.quality} - ${l.size}`, 
                        resolvedUrl: l.downloadUrl || l.link, 
                        direct: false 
                    }));
                    return res.json({ success: true, downloads, thumbnail: resData.data.result.image });
                }
            } catch (err) {}
            return res.json({ success: false });
        }

        if (source === 'kdrama') {
            const dlRes = await axios.get(`${ZANTA_API_BASE}/api/kdrama/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success || !dlRes.data.results?.episodes_list?.length) return res.json({ success: false });
            
            const episodes = dlRes.data.results.episodes_list;
            let downloads = episodes.map(ep => ({
                meta: ep.title || 'Episode',
                resolvedUrl: ep.download_link,
                direct: false
            }));
            
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

        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) { res.json({ success: false }); }
});

// ── SEND TO GROUP (DIRECT STREAM + AI) ──
app.post('/api/send-movie', async (req, res) => {
    const { title, url, quality, reqName, reqNum, source, img, imdb, batchIndex } = req.body;
    const taskId = crypto.randomBytes(4).toString('hex');
    
    taskQueue.add({
        id: taskId,
        info: { title, quality, reqName, userNum: reqNum },
        run: async () => {
            const sock = getActiveSocket();
            if (!sock) return;

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                let finalVidUrl = url;

                if (source === 'moviesublk' && (url.includes('drive.google') || url.includes('drive.usercontent'))) {
                    let match = url.match(/\/file\/d\/([^\/]+)/) || url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^\/]+)/);
                    if (match) {
                        const fileId = match[1];
                        const wsRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/download/gdrive?url=${encodeURIComponent(`https://drive.google.com/file/d/${fileId}/view`)}&apitoken=4ehG6P`);
                        if (wsRes.data?.success && wsRes.data.downloadUrl) {
                            finalVidUrl = wsRes.data.downloadUrl;
                        }
                    }
                }

                if (source === 'sublk' && (url.includes('drive.google') || url.includes('drive.usercontent'))) {
                    let match = url.match(/\/file\/d\/([^\/]+)/) || url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^\/]+)/);
                    if (match) {
                        const fileId = match[1];
                        const wsRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/download/gdrive?url=${encodeURIComponent(`https://drive.google.com/file/d/${fileId}/view`)}&apitoken=4ehG6P`);
                        if (wsRes.data?.success && wsRes.data.downloadUrl) {
                            finalVidUrl = wsRes.data.downloadUrl;
                        }
                    }
                }

                if (source === 'kdrama') {
                    const page1 = await axios.get(url, { httpsAgent });
                    const $1 = cheerio.load(page1.data);
                    const formData = {};
                    $1('form').first().find('input[type="hidden"]').each((i, el) => {
                        formData[$1(el).attr('name')] = $1(el).attr('value');
                    });

                    const page2 = await axios.post(url, qs.stringify(formData), {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Referer': url,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        },
                        httpsAgent
                    });
                    const $2 = cheerio.load(page2.data);
                    
                    let directLink = $2('a').filter((i, el) => $2(el).text().trim() === 'Start download').attr('href');
                    if (!directLink) directLink = $2('.btn-success').attr('href') || $2('a[href*=".mkv"]').attr('href') || $2('a[href*=".mp4"]').attr('href');

                    if (directLink) {
                        finalVidUrl = directLink;
                    } else {
                        throw new Error("KDrama Direct Link Bypass Failed");
                    }
                }

                if (isFirstInBatch) {
                    await sendMediaSafely(sock, BOT_NUMBER + '@s.whatsapp.net', { text: `📌 *New Request Started!*\n🎬 *Title:* ${title}\n👤 *By:* ${reqName}\n📞 *Number:* ${reqNum}` }, 30000);
                    
                    const aiSummary = await getGeminiSummary(title);
                    
                    let cap = `🎬 *${title}*\n✨ *Quality:* ${quality}\n\n`;
                    if (aiSummary) cap += `📖 *Summary:*\n${aiSummary}\n\n`;
                    cap += `👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;

                    if (img) await sendMediaSafely(sock, GROUP_JID, { image: { url: img }, caption: cap }, 60000);
                    else await sendMediaSafely(sock, GROUP_JID, { text: cap }, 30000);
                }

                if (source === 'baiscopes' && finalVidUrl.includes('t.me')) {
                    const teleText = `📥 *Telegram Link Detected!*\n🎬 *Title:* ${title}\n✨ *Quality:* ${quality}\n\nකරුණාකර පහත ලින්ක් එකෙන් ගොස් Telegram හරහා චිත්‍රපටය ලබාගන්න:\n🔗 ${finalVidUrl}\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;
                    await sendMediaSafely(sock, GROUP_JID, { text: teleText }, 30000);
                    return; 
                }

                let streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 0, headers: HEADERS, httpsAgent });
                
                if (streamRes.headers['content-length'] && parseInt(streamRes.headers['content-length']) > 2 * 1024 * 1024 * 1024) {
                    try{ streamRes.data.destroy(); }catch(e){}
                    await sendMediaSafely(sock, GROUP_JID, { text: `⚠️ *File Too Large (>2GB)*\n🔗 ${url}` });
                    return;
                }

                const mimeType = (finalVidUrl.includes('.mkv') || (streamRes.headers['content-type'] && streamRes.headers['content-type'].includes('matroska'))) ? 'video/x-matroska' : 'video/mp4';
                const fileExt = mimeType === 'video/x-matroska' ? 'mkv' : 'mp4';
                let fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.${fileExt}`;
                
                let smallCaption = isBatch && !isFirstInBatch ? `🎬 *${quality}*\n👤 *Required By:* ${reqName}\n> *Sadew Web Sender*` : `🎬 *${title}*\n> *Sadew Web Sender*`;

                await sendMediaSafely(sock, GROUP_JID, { document: { stream: streamRes.data }, mimetype: mimeType, fileName, caption: smallCaption });
                
            } catch (err) {
                // 🔥 දැන් අපිට මොකක්ද අවුල කියලා හරියටම බලාගන්න පුළුවන් 🔥
                const errMsg = err.response ? `HTTP ${err.response.status}` : err.message;
                try { await sendMediaSafely(sock, GROUP_JID, { text: `❌ *Failed:* ${title} - ${quality}\n_Error: ${errMsg}_` }, 30000); } catch(e){}
            }
        }
    });

    res.json({ success: true, taskId, position: taskQueue.queue.length });
});

// ════════════ 🎌 ANIME HAVEN API ════════════
app.post('/api/anime-search', async (req, res) => {
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

app.post('/api/anime-episodes', async (req, res) => {
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

app.post('/api/anime-send', async (req, res) => {
    const { id, hash, epNum, videoname, thumbnail, reqName, reqNum, batchIndex } = req.body;
    const taskId = crypto.randomBytes(4).toString('hex');

    taskQueue.add({
        id: taskId,
        info: { title: videoname, quality: `Episode ${epNum}`, reqName, userNum: reqNum },
        run: async () => {
            const sock = getActiveSocket();
            if (!sock) return;

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                if (isFirstInBatch) {
                    await sendMediaSafely(sock, BOT_NUMBER + '@s.whatsapp.net', { text: `📌 *New Anime Requested!*\n🎬 *Title:* ${videoname} - Ep ${epNum}\n👤 *By:* ${reqName}\n📞 *Number:* ${reqNum}` }, 30000);
                    
                    const aiSummary = await getGeminiSummary(videoname);
                    
                    const seriesHtml = (await axios.get(`${ANIME_BASE}/anime.php?${id}`, { headers: HEADERS })).data;
                    const descMatch = seriesHtml.match(/<div class=['"]infodes c['"]>([\s\S]*?)<\/div>/i);
                    let origDesc = descMatch ? descMatch[1].trim().replace(/<[^>]+>/g, '') : videoname;
                    if (origDesc.length > 300) origDesc = origDesc.substring(0, 300) + '...';

                    let cardText = `🎬 *${videoname}*\n\n`;
                    if (aiSummary) {
                        cardText += `📖 *Summary:*\n${aiSummary}\n\n`;
                    } else {
                        cardText += `📝 *Description:*\n${origDesc}\n\n`;
                    }
                    cardText += `👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;

                    if (thumbnail) await sendMediaSafely(sock, GROUP_JID, { image: { url: thumbnail }, caption: cardText }, 60000);
                    else await sendMediaSafely(sock, GROUP_JID, { text: cardText }, 30000);
                }

                const gateHtml = (await axios.get(`${ANIME_BASE}/gate.php`, { headers: { ...HEADERS, 'Referer': `${ANIME_BASE}/anime.php?${id}`, 'Cookie': `key=${hash}` } })).data;
                
                let finalDlLink = '';
                const downloadRegex = /<a\s+href=['"](https?:\/\/[a-z0-9]+\.animeheaven\.me\/video\.mp4\?[^'"]+)['"]/gi;
                let dlMatch = downloadRegex.exec(gateHtml);

                if (dlMatch) {
                    finalDlLink = dlMatch[1];
                } else {
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

                const streamRes = await axios({ 
                    url: finalDlLink, 
                    method: 'GET', 
                    responseType: 'stream', 
                    timeout: 0,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeheaven.me/' }
                });

                if ((streamRes.headers['content-type'] || '').includes('text/html')) {
                    try { streamRes.data.destroy(); } catch(e){}
                    throw new Error("Blocked by AnimeHaven");
                }

                const fileName = `${videoname.replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Ep ${epNum} [SADEW].mp4`;
                let epCaption = `🎬 Episode ${epNum}\n👤 *Required By:* ${reqName}\n> *Sadew Web Sender*`;

                await sendMediaSafely(sock, GROUP_JID, { document: { stream: streamRes.data }, mimetype: 'video/mp4', fileName, caption: epCaption });
                
            } catch (err) {
                try { await sendMediaSafely(sock, GROUP_JID, { text: `❌ *Failed:* ${videoname} - Ep ${epNum}\n_Network dropped or timeout._` }, 30000); } catch(e){}
            }
        }
    });
    res.json({ success: true, taskId });
});

app.use('/code', code);
app.use('/pair', async (req, res, next) => { res.sendFile(__path + '/pair.html'); });
app.use('/settings', async (req, res, next) => { res.sendFile(__path + '/settings.html'); });
app.use('/movie', async (req, res, next) => { res.sendFile(__path + '/movie.html'); });
app.use('/', async (req, res, next) => { res.sendFile(__path + '/main.html'); });

app.listen(PORT, '0.0.0.0', () => { console.log(`Akira Bot — ONLINE  Port: ${PORT}`); });
module.exports = app;
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-24T16:01:21+05:30.
</ADDITIONAL_METADATA>
