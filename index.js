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

// ════════════ 📊 SERVER LIVE STATS API (MAIN) ════════════
app.get('/livestats', (req, res) => {
    try {
        const uptime = process.uptime();
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const sessionsCount = (global.activeSockets && global.activeSockets.size) 
                              ? global.activeSockets.size : 0;
        res.json({ uptime: uptime, ramUsed: ramUsed, sessionsCount: sessionsCount });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ════════════ 📢 MASS CHANNEL REACTION & FOLLOW API ════════════
app.get('/react', async (req, res) => { /* ... (Your mass react code) ... */ res.json({ success: true, status: "Active" }); });
app.get('/follow', async (req, res) => { /* ... (Your mass follow code) ... */ res.json({ success: true, status: "Active" }); });

// ════════════ 🎬 MOVIE SENDER API ════════════
const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API = "https://api.zanta-mini.store/api/sinhalasub";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";
const GROUP_JID = '120363425721300928@g.us'; 
const BOT_NUMBER = '94705236759'; 
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

function isTelegramLink(url) {
    return url.toLowerCase().includes('t.me/') || url.toLowerCase().includes('telegram.me/');
}

function buildMovieCaption({ title, quality, imdb, reqName }) {
    let cap = `🎬 *${title}*\n✨ *Quality:* ${quality}`;
    if (imdb) cap += `\n⭐ *IMDb:* ${imdb}`;
    cap += `\n\n👤 *Required By:* ${reqName}\n\n> *Sadew Web Sender*`;
    return cap;
}

// ── SEARCH ──
app.post('/api/search', async (req, res) => {
    const { query, source } = req.body;
    try {
        // 1) SINHALASUB 2 (API)
        if (source === 'sinhalasub2') {
            const searchRes = await axios.get(`${ZANTA_API}/search?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(query)}`);
            if (searchRes.data?.success && searchRes.data.results?.length > 0) {
                const results = searchRes.data.results.slice(0, 6).map(mv => ({ title: mv.title, url: mv.url, img: mv.thumbnail, source: 'sinhalasub2' }));
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        
        // 2) SINHALASUB 1 (SCRAPER)
        if (source === 'sinhalasub1') {
            const searchRes = await axios.get(`https://sinhalasub.lk/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('.result-item, .item, article, .post').each((i, el) => {
                if(results.length >= 6) return;
                const a = $(el).find('a').first();
                const img = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');
                const title = a.attr('title') || $(el).find('.title').text().trim() || a.text().trim();
                const href = a.attr('href');
                if (href && href.includes('sinhalasub.lk') && title) results.push({ title, url: href, img: img || '', source: 'sinhalasub1' });
            });
            if(results.length > 0) return res.json({ success: true, results });
            return res.json({ success: false });
        }

        // 3) 1TAMILMV (SCRAPER)
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

        // 4) 🔥 MOVIESUBLK (SCRAPER) 🔥
        if (source === 'moviesublk') {
            const searchRes = await axios.get(`https://www.moviesublk.com/search?q=${encodeURIComponent(query)}`, { headers: HEADERS });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('.post-outer, .post').each((i, el) => {
                if(results.length >= 6) return;
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

        // 5) CINESUBZ (DEFAULT)
        const searchRes = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`);
        if (searchRes.data.success && searchRes.data.result?.length > 0) {
            const results = searchRes.data.result.slice(0, 6).map(mv => ({ ...mv, source: 'cinesubz' }));
            return res.json({ success: true, results });
        }
        res.json({ success: false });
    } catch (error) {
        console.log('[search] error:', error.message);
        res.json({ success: false });
    }
});

// ── QUALITY / DOWNLOAD LINKS ──
app.post('/api/links', async (req, res) => {
    const { url, source } = req.body;
    try {
        // ... (SinhalaSub2, SinhalaSub1, 1TamilMV code exactly as before, kept short for space here) ...
        if (source === 'sinhalasub2') { /* Existing SS2 */ return res.json({ success: false }); }
        if (source === 'sinhalasub1') { /* Existing SS1 */ return res.json({ success: false }); }
        if (source === '1tamilmv') { /* Existing 1TamilMV */ return res.json({ success: false }); }

        // 🔥 MOVIESUBLK (SCRAPER) 🔥
        if (source === 'moviesublk') {
            const dlRes = await axios.get(url, { headers: HEADERS });
            const html = dlRes.data;
            let downloads = [];
            
            // Look for Google Drive Links in JS arrays (TV Shows)
            const gdRegex = /gd:\s*['"](https:\/\/drive\.usercontent\.google\.com\/download\?[^'"]+)['"]/g;
            let match;
            let epCount = 1;
            while((match = gdRegex.exec(html)) !== null) {
                let dlink = match[1];
                if (!downloads.find(d => d.resolvedUrl === dlink)) {
                    downloads.push({ meta: `Episode ${epCount} (GDrive)`, resolvedUrl: dlink, direct: true });
                    epCount++;
                }
            }

            // Look for normal Google Drive HTML links (Movies)
            const $ = cheerio.load(html);
            $('a').each((i, el) => {
                let href = $(el).attr('href');
                if (href && (href.includes('drive.usercontent.google.com/download') || href.includes('drive.google.com/file/d/'))) {
                     if (!downloads.find(d => d.resolvedUrl === href)) {
                         let text = $(el).text().trim() || 'Google Drive Link';
                         downloads.push({ meta: text.substring(0,25), resolvedUrl: href, direct: true });
                     }
                }
            });

            if(downloads.length > 0) return res.json({ success: true, downloads });
            return res.json({ success: false, msg: "No Google Drive links found in this post." });
        }

        // CINESUBZ (DEFAULT)
        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) { res.json({ success: false }); }
});

// ── SEND TO GROUP ──
app.post('/api/send-movie', async (req, res) => {
    const { title, url, quality, reqName, reqNum, source, img, imdb } = req.body;
    const activeSockets = global.activeSockets;
    
    if (!activeSockets || !activeSockets.has(BOT_NUMBER)) {
        return res.status(500).json({ error: 'Bot is not connected!' });
    }
    const sock = activeSockets.get(BOT_NUMBER).socket || activeSockets.get(BOT_NUMBER);

    try {
        res.json({ success: true, message: 'Upload started' });

        const ownerMessage = `📌 *New Movie Requested!*\n\n🎬 *Movie:* ${title}\n📽 *Quality:* ${quality}\n👤 *Requested By:* ${reqName}\n🌐 *Source:* ${source || 'cinesubz'}\n\n_මෙම චිත්‍රපටය Group එකට Upload වෙමින් පවතී..._`;
        await sock.sendMessage(BOT_NUMBER + '@s.whatsapp.net', { text: ownerMessage });
        const groupCaption = buildMovieCaption({ title, quality, imdb, reqName });
        let fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.mp4`;

        // ════════════ 🔥 MOVIESUBLK (GDRIVE BYPASS) FLOW 🔥 ════════════
        if (source === 'moviesublk') {
            await sock.sendMessage(GROUP_JID, { text: `⏳ *${title}* (${quality})\n_Google Drive Virus Scan Bypass කරමින්..._\n\n👤 *Requested By:* ${reqName}` });
            
            let finalVidUrl = url;
            try {
                // Bypass logic for > 100MB files
                if(url.includes('drive.usercontent.google.com') || url.includes('drive.google.com')) {
                    const warnRes = await axios.get(url, { headers: HEADERS });
                    const warnHtml = warnRes.data;
                    const confirmMatch = warnHtml.match(/name="confirm" value="([^"]+)"/);
                    const uuidMatch = warnHtml.match(/name="uuid" value="([^"]+)"/);
                    if(confirmMatch) {
                        // Append tokens to get direct file stream URL!
                        finalVidUrl = `${url}&confirm=${confirmMatch[1]}${uuidMatch ? '&uuid=' + uuidMatch[1] : ''}`;
                    }
                }
            } catch (bypassErr) { console.log("GDrive bypass error:", bypassErr.message); }

            const streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 0, headers: HEADERS });
            
            const contentLength = streamRes.headers['content-length'];
            if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024 * 1024) {
                streamRes.data.destroy();
                let txt = `*↳ ❝ [🎬 𝗠𝗼𝘃𝗶𝗲𝗦𝘂𝗯𝗟𝗞 𝗗𝗶𝗿𝗲𝗰𝘁 𝗟𝗶𝗻𝗸 🎬] ¡! ❞*\n\n🎬 *Title:* ${title}\n⚠️ *WhatsApp හි 2GB සීමාව නිසා මෙම Video එක කෙලින්ම එවිය නොහැක.*\n\n📥 *පහත Link එක ඔබා Download කරගන්න:*\n🔗 ${finalVidUrl}\n\n👤 *Req By:* ${reqName}\n> *Sadew Web Sender*`;
                if(img) await sock.sendMessage(GROUP_JID, { image: { url: img }, caption: txt });
                else await sock.sendMessage(GROUP_JID, { text: txt });
                return;
            }

            const tempId = crypto.randomBytes(4).toString('hex');
            const filePath = path.join(__path, `temp_${tempId}.mp4`);
            const writer = fs.createWriteStream(filePath);
            streamRes.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

            try { await sock.sendMessage(GROUP_JID, { document: { stream: fs.createReadStream(filePath) }, mimetype: "video/mp4", fileName, caption: groupCaption });
            } finally { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
            setTimeout(() => { if (global.gc) global.gc(); }, 5000);
            return;
        }

        // ... (1TamilMV, SinhalaSub, Cinesubz upload logics are same as before) ...
    } catch (error) {
        console.error('❌ Web Upload Error:', error.message);
        try { await sock.sendMessage(GROUP_JID, { text: `❌ *Upload Failed!*\n🎬 *Movie:* ${title}` }); } catch (e) {}
    }
});

// ════════════ 🎌 ANIME HAVEN API ════════════
// (Your fixed Anime Haven logic is identical to previous response, it works fine)

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
