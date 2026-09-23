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

// ════════════ 📊 SERVER LIVE STATS API ════════════
app.get('/livestats', (req, res) => {
    try {
        const uptime = process.uptime();
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const sessionsCount = (global.activeSockets && global.activeSockets.size) ? global.activeSockets.size : 0;
        res.json({ uptime, ramUsed, sessionsCount });
    } catch (error) { res.status(500).json({ error: "Failed to fetch stats" }); }
});

app.get('/react', async (req, res) => { res.json({ success: true, status: "Active" }); });
app.get('/follow', async (req, res) => { res.json({ success: true, status: "Active" }); });

// ════════════ 🎬 CONSTANTS ════════════
const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API = "https://api.zanta-mini.store/api/sinhalasub";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";
const GROUP_JID = '120363425721300928@g.us'; 
const BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

function isTelegramLink(url) { return url.toLowerCase().includes('t.me/'); }

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
        this.active = null;
        this.processNext();
    }
};

app.get('/api/queue', (req, res) => {
    res.json({
        active: taskQueue.active ? taskQueue.active.info : null,
        queue: taskQueue.queue.map(t => t.info)
    });
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
                const titleEl = $(el).find('.post-title a').first();
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
            return res.json({ success: false, msg: "Protected Links Only. Use SinhalaSub API." });
        }

        if (source === 'moviesublk') {
            const dlRes = await axios.get(url, { headers: HEADERS });
            const html = dlRes.data;
            let downloads = [];
            
            // Extract Episodes from JS
            const gdRegex = /gd:\s*['"](https:\/\/drive\.usercontent\.google\.com\/download\?[^'"]+)['"]/g;
            let match;
            let epCount = 1;
            while((match = gdRegex.exec(html)) !== null) {
                let dlink = match[1];
                if (!downloads.find(d => d.resolvedUrl === dlink)) {
                    downloads.push({ meta: `Episode ${epCount}`, resolvedUrl: dlink, direct: true });
                    epCount++;
                }
            }

            // Normal HTML Links
            const $ = cheerio.load(html);
            $('a').each((i, el) => {
                let href = $(el).attr('href');
                if (href && (href.includes('drive.usercontent') || href.includes('drive.google'))) {
                     if (!downloads.find(d => d.resolvedUrl === href)) {
                         downloads.push({ meta: $(el).text().trim().substring(0,35) || 'Google Drive Link', resolvedUrl: href, direct: true });
                     }
                }
            });
            if(downloads.length > 0) return res.json({ success: true, downloads });
            return res.json({ success: false });
        }

        // CINESUBZ (DEFAULT)
        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) { res.json({ success: false }); }
});

// ── SEND TO GROUP (USING QUEUE SYSTEM) ──
app.post('/api/send-movie', async (req, res) => {
    const data = req.body;
    const { title, url, quality, reqName, reqNum, source, img, imdb, batchIndex, batchTotal } = data;
    const taskId = crypto.randomBytes(4).toString('hex');
    
    // Add to Global Queue!
    taskQueue.add({
        id: taskId,
        info: { title, quality, reqName, userNum: reqNum },
        run: async () => {
            const activeSockets = global.activeSockets;
            if (!activeSockets || !activeSockets.has(BOT_NUMBER)) return;
            const sock = activeSockets.get(BOT_NUMBER).socket || activeSockets.get(BOT_NUMBER);

            try {
                let cap = `🎬 *${title}*\n✨ *Quality/Details:* ${quality}`;
                if (imdb) cap += `\n⭐ *IMDb:* ${imdb}`;
                cap += `\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;

                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                // Send Image Thumbnail + Details ONLY if it's the first in batch!
                if (isFirstInBatch) {
                    const ownerMessage = `📌 *New Request Started!*\n🎬 *Title:* ${title}\n👤 *By:* ${reqName} (${reqNum})`;
                    await sock.sendMessage(BOT_NUMBER + '@s.whatsapp.net', { text: ownerMessage });
                    if (img) await sock.sendMessage(GROUP_JID, { image: { url: img }, caption: cap });
                    else await sock.sendMessage(GROUP_JID, { text: cap });
                }

                let fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.mp4`;
                let finalVidUrl = url;

                // Moviesublk GDrive Bypass
                if (source === 'moviesublk' && (url.includes('drive.usercontent') || url.includes('drive.google'))) {
                    try {
                        const warnRes = await axios.get(url, { headers: HEADERS });
                        const warnHtml = warnRes.data;
                        const confirmMatch = warnHtml.match(/name="confirm" value="([^"]+)"/);
                        const uuidMatch = warnHtml.match(/name="uuid" value="([^"]+)"/);
                        if(confirmMatch) finalVidUrl = `${url}&confirm=${confirmMatch[1]}${uuidMatch ? '&uuid=' + uuidMatch[1] : ''}`;
                    } catch (e) {}
                }

                // File download and upload
                const streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 0, headers: HEADERS });
                
                // File Size Check
                if (streamRes.headers['content-length'] && parseInt(streamRes.headers['content-length']) > 2 * 1024 * 1024 * 1024) {
                    streamRes.data.destroy();
                    await sock.sendMessage(GROUP_JID, { text: `⚠️ *File Too Large (>2GB)*\n🔗 ${finalVidUrl}` });
                    return;
                }

                const tempFilePath = path.join(__path, `temp_${taskId}.mp4`);
                const writer = fs.createWriteStream(tempFilePath);
                streamRes.data.pipe(writer);
                await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                let smallCaption = isBatch ? `🎬 *${quality}*\n> *Sadew Web Sender*` : cap;

                try {
                    await sock.sendMessage(GROUP_JID, { document: { stream: fs.createReadStream(tempFilePath) }, mimetype: "video/mp4", fileName, caption: smallCaption });
                } finally {
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                }
                
                setTimeout(() => { if (global.gc) global.gc(); }, 5000);
            } catch (err) {
                console.error("Task Error:", err.message);
                try { await sock.sendMessage(GROUP_JID, { text: `❌ *Failed:* ${title} - ${quality}` }); } catch(e){}
            }
        }
    });

    res.json({ success: true, taskId, position: taskQueue.queue.length });
});

// ════════════ 🎌 ANIME HAVEN API ════════════
app.post('/api/anime-search', async (req, res) => {
    // (Anime Search exactly same as before)
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
            let thumb = m[2];
            if (thumb && !thumb.startsWith('http')) thumb = ANIME_BASE + '/' + thumb;
            results.push({ id, title: m[3].trim(), img: thumb, source: 'animeheaven' });
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

// Anime Send Using Queue
app.post('/api/anime-send', async (req, res) => {
    const data = req.body;
    const { id, hash, epNum, videoname, thumbnail, reqName, reqNum, batchIndex } = data;
    const taskId = crypto.randomBytes(4).toString('hex');

    taskQueue.add({
        id: taskId,
        info: { title: videoname, quality: `Episode ${epNum}`, reqName, userNum: reqNum },
        run: async () => {
            const activeSockets = global.activeSockets;
            if (!activeSockets || !activeSockets.has(BOT_NUMBER)) return;
            const sock = activeSockets.get(BOT_NUMBER).socket || activeSockets.get(BOT_NUMBER);

            try {
                const isBatch = typeof batchIndex !== 'undefined';
                const isFirstInBatch = isBatch ? batchIndex === 0 : true;

                if (isFirstInBatch) {
                    const cardText = `🎬 *${videoname}*\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;
                    if (thumbnail) await sock.sendMessage(GROUP_JID, { image: { url: thumbnail }, caption: cardText });
                    else await sock.sendMessage(GROUP_JID, { text: cardText });
                }

                const seriesUrl = `${ANIME_BASE}/anime.php?${id}`;
                const gateHtml = (await axios.get(`${ANIME_BASE}/gate.php`, { headers: { ...HEADERS, 'Referer': seriesUrl, 'Cookie': `key=${hash}` } })).data;

                const downloadRegex = /<a\s+href=['"](https?:\/\/[a-z0-9]+\.animeheaven\.me\/video\.mp4\?[^'"]+)['"]/gi;
                let dlMatch = downloadRegex.exec(gateHtml);
                if (!dlMatch) throw new Error("Anime DL link not found");

                const streamRes = await axios({ url: dlMatch[1], method: 'GET', responseType: 'stream', timeout: 300000 });
                const fileName = `${videoname.replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Ep ${epNum} [SADEW].mp4`;

                await sock.sendMessage(GROUP_JID, {
                    document: { stream: streamRes.data },
                    mimetype: 'video/mp4', fileName,
                    caption: `🎬 Episode ${epNum}\n> *Sadew Web Sender*`
                });
            } catch (err) {}
        }
    });
    res.json({ success: true, taskId });
});

// ════════════ 🌐 WEB PAGE ROUTES ════════════
app.use('/code', code);
app.use('/pair', async (req, res, next) => { res.sendFile(__path + '/pair.html'); });
app.use('/settings', async (req, res, next) => { res.sendFile(__path + '/settings.html'); });
app.use('/movie', async (req, res, next) => { res.sendFile(__path + '/movie.html'); });
app.use('/', async (req, res, next) => { res.sendFile(__path + '/main.html'); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔═══════════════════════════╗`);
  console.log(`║  Akira Bot — ONLINE  Port: ${PORT}   ║`);
  console.log(`╚═══════════════════════════╝`);
});
module.exports = app;
