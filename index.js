const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/livestats', (req, res) => { res.json({ success: true }); });
app.get('/react', async (req, res) => { res.json({ success: true }); });
app.get('/follow', async (req, res) => { res.json({ success: true }); });

// ════════════ 🎬 CONSTANTS ════════════
const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API = "https://api.zanta-mini.store/api/sinhalasub";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";
const GROUP_JID = '120363425721300928@g.us'; 
const BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

// 🔥 Helper to get active bot socket safely 🔥
function getActiveSocket() {
    const activeSockets = global.activeSockets;
    if (!activeSockets || activeSockets.size === 0) return null;
    const sessionData = activeSockets.get(BOT_NUMBER) || Array.from(activeSockets.values())[0];
    return sessionData.socket || sessionData;
}

// 🔥 Promise.race to prevent Baileys from hanging forever during Direct Streaming 🔥
async function sendMediaSafely(sock, jid, msgParams, timeoutMs = 600000) {
    const sendPromise = sock.sendMessage(jid, msgParams);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload Timeout - Stream Stalled")), timeoutMs));
    return Promise.race([sendPromise, timeoutPromise]);
}

// ════════════ 🚀 GLOBAL QUEUE MANAGER ════════════
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
            console.error(`[QUEUE] Error in Task:`, e.message);
        }
        
        console.log(`[QUEUE] Waiting 10 seconds before next task...`);
        await new Promise(r => setTimeout(r, 10000)); 
        this.active = null;
        this.processNext();
    }
};

app.get('/api/queue', (req, res) => {
    res.json({ active: taskQueue.active ? taskQueue.active.info : null, queue: taskQueue.queue.map(t => t.info) });
});

// ── SEARCH ──
app.post('/api/search', async (req, res) => {
    const { query, source } = req.body;
    try {
        if (source === 'sinhalasub2') {
            const searchRes = await axios.get(`${ZANTA_API}/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 8).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source: 'sinhalasub2' }));
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        
        if (source === 'sinhalasub1') {
            const searchRes = await axios.get(`https://sinhalasub.lk/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('.result-item, .item, article, .post').each((i, el) => {
                if(results.length >= 8) return;
                const a = $(el).find('a').first();
                const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');
                const title = a.attr('title') || $(el).find('.title').text().trim() || a.text().trim();
                const href = a.attr('href');
                if (href && href.includes('sinhalasub') && title && title.length > 2) results.push({ title, url: href, img: img || '', source: 'sinhalasub1' });
            });
            if(results.length > 0) return res.json({ success: true, results });
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

        if (source === 'moviesublk') {
            const searchRes = await axios.get(`https://www.moviesublk.com/search?q=${encodeURIComponent(query)}`, { headers: HEADERS });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('.post-outer, .post').each((i, el) => {
                if(results.length >= 8) return;
                const titleEl = $(el).find('.post-title a').first() || $(el).find('h3 a').first();
                if(!titleEl.length) return;
                const title = titleEl.text().trim();
                const href = titleEl.attr('href');
                let img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src') || '';
                if(img.startsWith('//')) img = 'https:' + img;
                if (href && title) results.push({ title, url: href, img, source: 'moviesublk' });
            });
            if(results.length > 0) return res.json({ success: true, results });
            return res.json({ success: false });
        }
        
        // CINESUBZ (DEFAULT)
        const searchRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data.success && searchRes.data.result?.length > 0) {
            const results = searchRes.data.result.slice(0, 8).map(mv => ({ ...mv, source: 'cinesubz' }));
            return res.json({ success: true, results });
        }
        res.json({ success: false });
    } catch (error) { res.json({ success: false }); }
});

// ── QUALITY / DOWNLOAD LINKS ──
app.post('/api/links', async (req, res) => {
    const { url, source } = req.body;
    try {
        if (source === 'sinhalasub2') {
            const dlRes = await axios.get(`${ZANTA_API}/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success) return res.json({ success: false });
            const pixelLinks = (dlRes.data.results.links || []).filter(l => l.quality === 'Pixeldrain');
            if (!pixelLinks.length) return res.json({ success: false });
            const downloads = pixelLinks.map(l => ({ meta: l.size, resolvedUrl: l.direct_link, direct: true }));
            return res.json({ success: true, downloads, thumbnail: dlRes.data.results.thumbnail, rating: dlRes.data.results.rating });
        }

        if (source === 'sinhalasub1') {
            const dlRes = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(dlRes.data);
            let downloads = [];
            $('a').each((i, el) => {
                let href = $(el).attr('href');
                let text = $(el).text().trim() || 'Download Link';
                if (href && (href.includes('links.sinhalasub') || href.includes('pixeldrain.com') || href.includes('drive.google.com') || text.toLowerCase().includes('download'))) {
                    if(!href.includes('whatsapp') && !href.includes('facebook') && !href.includes('t.me')) {
                        downloads.push({ meta: text.substring(0,35), resolvedUrl: href, direct: true });
                    }
                }
            });
            const unique = [];
            downloads.forEach(d => { if(!unique.find(u => u.resolvedUrl === d.resolvedUrl)) unique.push(d); });
            if(unique.length > 0) return res.json({ success: true, downloads: unique });
            return res.json({ success: false });
        }

        if (source === '1tamilmv') {
            const dlRes = await axios.get(url, { headers: HEADERS, timeout: 20000 });
            const $ = cheerio.load(dlRes.data);
            let img = null;
            $('img.ipsImage, img.bbc_img').each((i, el) => {
                let src = $(el).attr('data-src') || $(el).attr('src');
                if (src && src.startsWith('http') && !src.includes('data:image') && !img) img = src;
            });
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

        if (source === 'moviesublk') {
            const dlRes = await axios.get(url, { headers: HEADERS });
            const html = dlRes.data;
            let downloads = [];
            
            // TV Series Array Search
            const gdRegex = /gd:\s*['"](https:\/\/drive\.usercontent\.google\.com\/download\?[^'"]+)['"]/g;
            let match, epCount = 1;
            while((match = gdRegex.exec(html)) !== null) {
                if (!downloads.find(d => d.resolvedUrl === match[1])) {
                    downloads.push({ meta: `Episode ${epCount}`, resolvedUrl: match[1], direct: true });
                    epCount++;
                }
            }
            
            // Regular Movie Search
            const $ = cheerio.load(html);
            $('a').each((i, el) => {
                let href = $(el).attr('href');
                if (href && (href.includes('drive.usercontent') || href.includes('drive.google'))) {
                     if (!downloads.find(d => d.resolvedUrl === href)) downloads.push({ meta: $(el).text().trim().substring(0,35) || 'Google Drive Link', resolvedUrl: href, direct: true });
                }
            });
            if(downloads.length > 0) return res.json({ success: true, downloads });
            return res.json({ success: false });
        }

        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) { res.json({ success: false }); }
});

// ── SEND TO GROUP (DIRECT STREAM + TIMEOUT SAFEGUARD) ──
app.post('/api/send-movie', async (req, res) => {
    const data = req.body;
    const { title, url, quality, reqName, reqNum, source, img, imdb, batchIndex } = data;
    const taskId = crypto.randomBytes(4).toString('hex');
    
    taskQueue.add({
        id: taskId,
        info: { title, quality, reqName, userNum: reqNum },
        run: async () => {
            const sock = getActiveSocket();
            if (!sock) return;

            try {
                let cap = `🎬 *${title}*\n✨ *Quality:* ${quality}\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                if (isFirstInBatch) {
                    await sendMediaSafely(sock, BOT_NUMBER + '@s.whatsapp.net', { text: `📌 *New Request Started!*\n🎬 *Title:* ${title}\n👤 *By:* ${reqName}` }, 30000);
                    if (img) await sendMediaSafely(sock, GROUP_JID, { image: { url: img }, caption: cap }, 60000);
                    else await sendMediaSafely(sock, GROUP_JID, { text: cap }, 30000);
                }

                let fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.mp4`;
                let finalVidUrl = url;

                let streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 0, headers: HEADERS });
                
                // GDrive Bypass (Memory safe)
                const ct = streamRes.headers['content-type'] || '';
                if (source === 'moviesublk' && ct.includes('text/html')) {
                    let htmlData = '';
                    for await (const chunk of streamRes.data) { htmlData += chunk.toString(); if(htmlData.length > 50000) break; }
                    try { streamRes.data.destroy(); } catch(e){} 
                    
                    const confirmMatch = htmlData.match(/name="confirm"\s+value="([^"]+)"/i);
                    const uuidMatch = htmlData.match(/name="uuid"\s+value="([^"]+)"/i);
                    
                    if (confirmMatch) {
                        finalVidUrl = `${url}&confirm=${confirmMatch[1]}${uuidMatch ? '&uuid=' + uuidMatch[1] : ''}`;
                        streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 0, headers: HEADERS });
                    }
                }

                if (streamRes.headers['content-length'] && parseInt(streamRes.headers['content-length']) > 2 * 1024 * 1024 * 1024) {
                    try{ streamRes.data.destroy(); }catch(e){}
                    await sendMediaSafely(sock, GROUP_JID, { text: `⚠️ *File Too Large (>2GB)*\n🔗 ${finalVidUrl}` });
                    return;
                }

                let smallCaption = isBatch && !isFirstInBatch ? `🎬 *${quality}*\n> *Sadew Web Sender*` : cap;

                // 🔥 DIRECT STREAM WITH PROMISE.RACE (Prevent Hanging) 🔥
                await sendMediaSafely(sock, GROUP_JID, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName, caption: smallCaption });
                
            } catch (err) {
                console.error("Task Error:", err.message);
                try { await sendMediaSafely(sock, GROUP_JID, { text: `❌ *Failed:* ${title} - ${quality}\n_Stream Error / Timeout_` }, 30000); } catch(e){}
            }
        }
    });

    res.json({ success: true, taskId, position: taskQueue.queue.length });
});

// ════════════ 🎌 ANIME HAVEN API ════════════
app.post('/api/anime-search', async (req, res) => {
    const { query } = req.body;
    try {
        const searchUrl = `${ANIME_BASE}/search.php?s=${encodeURIComponent(query)}`;
        const html = (await axios.get(searchUrl, { headers: HEADERS })).data;
        const matches = [...html.matchAll(/<a href=['"](anime\.php\?[^'"]+)['"]>.*?<img class=['"]coverimg['"] src=['"]([^'"]*)['"] alt=['"]([^'"]*)['"]/gi)];
        const seen = new Set(), results = [];
        for (const m of matches) {
            if (results.length >= 10) break;
            const id = m[1].replace('anime.php?', '');
            if (seen.has(id)) continue;
            seen.add(id);
            results.push({ id, title: m[3].trim(), img: m[2].startsWith('http') ? m[2] : ANIME_BASE+'/'+m[2], source: 'animeheaven' });
        }
        res.json({ success: results.length > 0, results });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/anime-episodes', async (req, res) => {
    const { id } = req.body;
    try {
        const seriesUrl = `${ANIME_BASE}/anime.php?${id}`;
        const html = (await axios.get(seriesUrl, { headers: HEADERS })).data;
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
    const data = req.body;
    const { id, hash, epNum, videoname, thumbnail, reqName, reqNum, batchIndex } = data;
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
                    const cardText = `🎬 *${videoname}*\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;
                    if (thumbnail) await sendMediaSafely(sock, GROUP_JID, { image: { url: thumbnail }, caption: cardText }, 60000);
                    else await sendMediaSafely(sock, GROUP_JID, { text: cardText }, 30000);
                }

                const seriesUrl = `${ANIME_BASE}/anime.php?${id}`;
                const gateHtml = (await axios.get(`${ANIME_BASE}/gate.php`, { headers: { ...HEADERS, 'Referer': seriesUrl, 'Cookie': `key=${hash}` } })).data;
                const downloadRegex = /<a\s+href=['"](https?:\/\/[a-z0-9]+\.animeheaven\.me\/video\.mp4\?[^'"]+)['"]/gi;
                let dlMatch = downloadRegex.exec(gateHtml);
                if (!dlMatch) throw new Error("Anime DL link not found");

                const streamRes = await axios({ url: dlMatch[1], method: 'GET', responseType: 'stream', timeout: 300000 });
                const ct = streamRes.headers['content-type'] || '';
                
                // HTML Error Guard!
                if (ct.includes('text/html')) {
                    try { streamRes.data.destroy(); } catch(e){}
                    throw new Error("AnimeHaven blocked the stream or link expired.");
                }

                const fileName = `${videoname.replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Ep ${epNum} [SADEW].mp4`;

                // 🔥 DIRECT STREAM WITH PROMISE.RACE (Prevent Hanging) 🔥
                await sendMediaSafely(sock, GROUP_JID, { document: { stream: streamRes.data }, mimetype: 'video/mp4', fileName, caption: `🎬 Episode ${epNum}\n> *Sadew Web Sender*` });
                
            } catch (err) {
                console.error("Task Error:", err.message);
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
