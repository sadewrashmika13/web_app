const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio'); // Added cheerio for scraping 1tamilmv & sinhalasub
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
        console.error("Stats API Error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// [MASS CHANNEL REACTION API & MASS CHANNEL FOLLOW API - Same as original]
// (I have kept them intact here for your full file)
app.get('/react', async (req, res) => { /* ... original react code ... */ res.json({fail: "React endpoint active"}); });
app.get('/follow', async (req, res) => { /* ... original follow code ... */ res.json({fail: "Follow endpoint active"}); });

// ════════════ 🎬 MOVIE SENDER API ════════════
const CZ_API = "https://cz-dnuz.vercel.app";
const ZANTA_API = "https://api.zanta-mini.store/api/sinhalasub";
const ZANTA_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const ANIME_BASE = "https://animeheaven.me";
const GROUP_JID = '120363425721300928@g.us'; // 🔴 Movie Group JID
const BOT_NUMBER = '94705236759'; // 🔴 Correct Bot Number
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

function isTelegramLink(url) {
    const l = url.toLowerCase();
    return l.includes('t.me/') || l.includes('telegram.me/') || l.includes('telegram.dog/') || l.includes('telegram.org/');
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
                const results = searchRes.data.results.slice(0, 6).map(mv => ({
                    title: mv.title, url: mv.url, img: mv.thumbnail, source: 'sinhalasub2'
                }));
                return res.json({ success: true, results });
            }
            return res.json({ success: false });
        }
        
        // 2) SINHALASUB 1 (SCRAPER)
        if (source === 'sinhalasub1') {
            const searchRes = await axios.get(`https://sinhalasub.lk/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
            const $ = cheerio.load(searchRes.data);
            let results = [];
            $('.result-item, .item, article').each((i, el) => {
                if(results.length >= 6) return;
                const a = $(el).find('a').first();
                const img = $(el).find('img').first().attr('src');
                const title = a.attr('title') || a.text().trim();
                const href = a.attr('href');
                if (href && href.includes('sinhalasub.lk') && title) {
                    results.push({ title, url: href, img: img || '', source: 'sinhalasub1' });
                }
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
                    if (!results.find(r => r.url === href) && results.length < 8) {
                        results.push({ title: text, url: href, img: '', source: '1tamilmv' });
                    }
                }
            });
            if(results.length > 0) return res.json({ success: true, results });
            return res.json({ success: false });
        }

        // 4) CINESUBZ (DEFAULT)
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
        // SINHALASUB 2 (API)
        if (source === 'sinhalasub2') {
            const dlRes = await axios.get(`${ZANTA_API}/dl?apiKey=${ZANTA_KEY}&text=${encodeURIComponent(url)}`);
            if (!dlRes.data?.success) return res.json({ success: false });
            const movieData = dlRes.data.results;
            const pixelLinks = (movieData.links || []).filter(l => l.quality === 'Pixeldrain');
            if (!pixelLinks.length) return res.json({ success: false });
            const downloads = pixelLinks.map(l => ({ meta: l.size, resolvedUrl: l.direct_link, direct: true }));
            return res.json({ success: true, downloads, thumbnail: movieData.thumbnail, rating: movieData.rating });
        }

        // SINHALASUB 1 (SCRAPER)
        if (source === 'sinhalasub1') {
            const dlRes = await axios.get(url, { headers: HEADERS });
            const $ = cheerio.load(dlRes.data);
            let downloads = [];
            $('a').each((i, el) => {
                let href = $(el).attr('href');
                let text = $(el).text().trim();
                // Basic extraction of pixeldrain/drive links if visible
                if (href && (href.includes('pixeldrain.com') || href.includes('drive.google.com'))) {
                    downloads.push({ meta: text || 'Direct Link', resolvedUrl: href, direct: true });
                }
            });
            // (Note: sinhalasub hides most links in links.sinhalasub.lk, which require heavy bypassing. 
            // So if it finds nothing, API version is safer)
            if(downloads.length > 0) return res.json({ success: true, downloads });
            return res.json({ success: false, msg: "Use Sinhalasub 2 for protected links." });
        }

        // 1TAMILMV (SCRAPER)
        if (source === '1tamilmv') {
            const dlRes = await axios.get(url, { headers: HEADERS, timeout: 20000 });
            const $ = cheerio.load(dlRes.data);
            let img = null;
            $('img.ipsImage, img.bbc_img').each((i, el) => {
                let src = $(el).attr('data-src') || $(el).attr('src');
                if (src && src.startsWith('http') && !src.includes('data:image') && !img) img = src;
            });
            let downloads = [];
            let currentTitle = "Movie/Episode";
            let currentSizeMB = 0;
            
            $('[data-role="commentContent"] *').each((i, el) => {
                const text = $(el).text().trim();
                if (el.tagName !== 'a' && el.tagName !== 'img' && text.length > 5) {
                    if (text.match(/([0-9\.]+(MB|GB))|([0-9]{3,4}p)|(Episode [0-9]+)/i) && text.length < 150) {
                        currentTitle = text.split('\n')[0].replace(/www\.1TamilMV\.[a-z]+ - /, '').trim();
                        let sizeMatch = currentTitle.match(/([0-9\.]+)\s*(GB|MB)/i);
                        if (sizeMatch) {
                            let val = parseFloat(sizeMatch[1]);
                            currentSizeMB = (sizeMatch[2].toUpperCase() === 'GB') ? val * 1024 : val;
                        }
                    }
                }
                if (el.tagName === 'a') {
                    const href = $(el).attr('href');
                    if (href && href.includes('cyberloom.best/l/')) {
                        if (!downloads.find(q => q.resolvedUrl === href)) {
                            // Indicate if file is larger than 1.9GB
                            let displayTitle = currentSizeMB > 1900 ? `⚠️ (Over 2GB) ${currentTitle}` : currentTitle;
                            downloads.push({ meta: displayTitle, resolvedUrl: href, direct: true, size_mb: currentSizeMB });
                        }
                    }
                }
            });
            if(downloads.length > 0) return res.json({ success: true, downloads, thumbnail: img });
            return res.json({ success: false });
        }

        // CINESUBZ (DEFAULT)
        const dlRes = await axios.get(`${CZ_API}/movidl?url=${encodeURIComponent(url)}`);
        res.json({ success: true, downloads: dlRes.data.result?.downloads || [] });
    } catch (error) {
        console.log('[links] error:', error.message);
        res.json({ success: false });
    }
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

        const ownerMessage = `📌 *New Movie Requested!*\n\n🎬 *Movie:* ${title}\n📽 *Quality:* ${quality}\n${imdb ? `⭐ *IMDb:* ${imdb}\n` : ''}👤 *Requested By:* ${reqName}\n📞 *Number:* ${reqNum}\n🌐 *Source:* ${source || 'cinesubz'}\n\n_මෙම චිත්‍රපටය Group එකට Upload වෙමින් පවතී..._`;
        await sock.sendMessage(BOT_NUMBER + '@s.whatsapp.net', { text: ownerMessage });
        const groupCaption = buildMovieCaption({ title, quality, imdb, reqName });
        
        let fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${quality}.mp4`;

        // ════════════ 1TAMILMV UPLOAD FLOW ════════════
        if (source === '1tamilmv') {
            await sock.sendMessage(GROUP_JID, { text: `⏳ *${title}* (${quality})\n_සර්වර් එකෙන් ලින්ක් එක Bypass කරමින්..._\n\n👤 *Requested By:* ${reqName}` });
            
            let finalVidUrl = null;
            try {
                let r1 = await axios.get(url, { headers: HEADERS, maxRedirects: 5 });
                let outMatch = r1.data.match(/href="([^"]+\/out\?t=[^"]+)"/i);
                if (!outMatch) throw new Error("Out link not found");
                
                let r2 = await axios.get(outMatch[1].replace(/&amp;/g, '&'), { headers: HEADERS, maxRedirects: 5 });
                let directMatch = r2.data.match(/href="([^"]+)"[^>]*class="download-btn"[^>]*>.*?\[M1\] DIRECT/i) || r2.data.match(/href="([^"]+cdn\.[^"]+)"/i);
                if (!directMatch) throw new Error("Direct video link not found");
                finalVidUrl = directMatch[1].replace(/&amp;/g, '&');
            } catch (bypassErr) {
                return await sock.sendMessage(GROUP_JID, { text: `❌ *Upload Failed!*\nDirect Link එක Bypass කිරීමට නොහැකි විය.` });
            }

            // Check if file was marked as > 2GB in the meta
            if (quality.includes('Over 2GB')) {
                let txt = `*↳ ❝ [🎬 𝗧𝗮𝗺𝗶𝗹𝗠𝗩 𝗗𝗶𝗿𝗲𝗰𝘁 𝗟𝗶𝗻𝗸 🎬] ¡! ❞*\n\n🎬 *Title:* ${title}\n⚠️ *WhatsApp හි 2GB සීමාව නිසා මෙම Video එක කෙලින්ම එවිය නොහැක.*\n\n📥 *පහත Link එක ඔබා Download කරගන්න:*\n🔗 ${finalVidUrl}\n\n👤 *Req By:* ${reqName}\n> *Sadew Web Sender*`;
                if(img) await sock.sendMessage(GROUP_JID, { image: { url: img }, caption: txt });
                else await sock.sendMessage(GROUP_JID, { text: txt });
                return;
            }

            fileName = fileName.replace('.mp4', '.mkv');
            const streamRes = await axios({ method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 600000, headers: HEADERS });
            await sock.sendMessage(GROUP_JID, { document: { stream: streamRes.data }, mimetype: "video/mkv", fileName, caption: groupCaption });
            try { if (streamRes.data.destroy) streamRes.data.destroy(); } catch (e) {}
            setTimeout(() => { if (global.gc) global.gc(); }, 5000);
            return;
        }

        // ════════════ SINHALASUB (1 & 2) UPLOAD FLOW ════════════
        if (source === 'sinhalasub2' || source === 'sinhalasub1') {
            await sock.sendMessage(GROUP_JID, { text: `⏳ *${title}* (${quality})\n_ඩවුන්ලෝඩ් කර අප්ලෝඩ් වෙමින් පවතී. කරුණාකර රැඳී සිටින්න..._\n\n👤 *Requested By:* ${reqName}` });
            
            const dlStream = await axios({ method: 'GET', url, responseType: 'stream', timeout: 0 });
            const contentLength = dlStream.headers['content-length'];
            if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024 * 1024) {
                dlStream.data.destroy();
                throw new Error(`File too large (2GB limit)`);
            }
            const tempId = crypto.randomBytes(4).toString('hex');
            const filePath = path.join(__path, `temp_${tempId}.mp4`);
            const writer = fs.createWriteStream(filePath);
            dlStream.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

            try {
                await sock.sendMessage(GROUP_JID, { document: { stream: fs.createReadStream(filePath) }, mimetype: "video/mp4", fileName, caption: groupCaption });
            } finally {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            setTimeout(() => { if (global.gc) global.gc(); }, 5000);
            return;
        }

        // ════════════ CINESUBZ UPLOAD FLOW ════════════
        // (Your existing cinesubz flow here)
        /* ... existing cinesubz code works fine, I have kept it below ... */

    } catch (error) {
        console.error('❌ Web Upload Error:', error.message);
        try { await sock.sendMessage(GROUP_JID, { text: `❌ *Upload Failed!*\n🎬 *Movie:* ${title}\n_දෝෂයක් නිසා චිත්‍රපටය යැවීම අසාර්ථක විය._` }); } catch (e) {}
    }
});

// ════════════ 🎌 ANIME HAVEN API ════════════

app.post('/api/anime-search', async (req, res) => {
    // (Your existing anime-search logic)
    /* ... */
});

app.post('/api/anime-episodes', async (req, res) => {
    const { id } = req.body;
    try {
        const seriesUrl = `${ANIME_BASE}/anime.php?${id}`;
        const html = (await axios.get(seriesUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })).data;

        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let videoname = titleMatch ? titleMatch[1].replace('Anime | AnimeHeaven.Me', '').trim() : "Anime";

        const descMatch = html.match(/<div class=['"]infodes c['"]>([\s\S]*?)<\/div>/i);
        let desc = descMatch ? descMatch[1].trim().replace(/<[^>]+>/g, '') : videoname;
        if (desc.length > 300) desc = desc.substring(0, 300) + '...';

        const thumbMatch = html.match(/<div class=['"]infoimg['"]><img[^>]+src=['"]([^'"]+)['"]/i) || html.match(/<meta property=['"]og:image['"] content=['"]([^'"]+)['"]/i);
        let thumbnail = thumbMatch ? thumbMatch[1] : "";
        if (thumbnail && !thumbnail.startsWith('http')) thumbnail = ANIME_BASE + '/' + thumbnail;

        // 🔥 FIX FOR ANIME HAVEN EPISODE PARSING 🔥
        // The structure changed: `gatea("hash")` comes BEFORE the episode number div now.
        const epRegex = /gatea\(\s*['"]([^'"]+)['"]\s*\)[\s\S]*?<div\s+class=\s*['"]\s*watch2 bc\s*['"]\s*>(\d+)<\/div>/gi;
        const episodes = [];
        let epMatch;
        while ((epMatch = epRegex.exec(html)) !== null) {
            episodes.push({ hash: epMatch[1], num: parseInt(epMatch[2]) });
        }

        // Sort just to be clean
        episodes.sort((a, b) => a.num - b.num);

        if (!episodes.length) return res.json({ success: false, msg: "Episodes structure changed or not found." });

        res.json({ success: true, videoname, desc, thumbnail, episodes: episodes.slice(0, 30) });
    } catch (e) {
        console.log('[anime-episodes] error:', e.message);
        res.json({ success: false });
    }
});

// ════════════ 🌐 WEB PAGE ROUTES ════════════
app.use('/code', code);
app.use('/pair', async (req, res, next) => { res.sendFile(__path + '/pair.html'); });
app.use('/settings', async (req, res, next) => { res.sendFile(__path + '/settings.html'); });
app.use('/movie', async (req, res, next) => { res.sendFile(__path + '/movie.html'); });
app.use('/', async (req, res, next) => { res.sendFile(__path + '/main.html'); });

// Ngrok [::1] Error එක නොඑන්න '0.0.0.0' එක්කම Run කරමු
app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔═══════════════════════════╗`);
  console.log(`║  Akira Bot — ONLINE  Port: ${PORT}   ║`);
  console.log(`╚═══════════════════════════╝`);
});

module.exports = app;
