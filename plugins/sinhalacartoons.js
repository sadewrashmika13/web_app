const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const BASE_URL = 'https://sinhalacartoons.com';

// ⚡ DIRECT TMP TO SSD (AVOID RAM DISK /tmp)
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
process.env.TMPDIR = tempDir;
process.env.TEMP = tempDir;
process.env.TMP = tempDir;

function cleanTempDir() {
    try {
        if (!fs.existsSync(tempDir)) return;
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        for (const file of files) {
            const fp = path.join(tempDir, file);
            try {
                const stat = fs.statSync(fp);
                if (file.includes('-enc') || file.includes('-original') || (now - stat.mtimeMs > 300000)) {
                    fs.unlinkSync(fp);
                }
            } catch (_) {}
        }
    } catch (_) {}
}

let isCartoonAllDownloading = false;

// ════════════════════════════════════════════════════════
// 💾 GLOBAL CACHE & SESSION STORES
// ════════════════════════════════════════════════════════
if (!global.cartoonCache) global.cartoonCache = {};
if (!global.cartoonStore) global.cartoonStore = {};
const attachedSockets = new WeakSet();

function cleanJid(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0] + (jid.includes('@g.us') ? '@g.us' : '@s.whatsapp.net');
}

function storeCartoonData(data, ttlMs = 30 * 60 * 1000) {
    const id = crypto.randomBytes(4).toString('hex');
    global.cartoonCache[id] = data;
    setTimeout(() => { delete global.cartoonCache[id]; }, ttlMs);
    return id;
}

// ════════════════════════════════════════════════════════
// 🛠️ SCRAPER & HELPER FUNCTIONS
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

function parseTargetJid(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    const endMatch = raw.match(/(?:,|\s)*([0-9]+@g\.us|[0-9]+@s\.whatsapp\.net|\+?94[0-9]{9}|0[0-9]{9})$/i);
    if (endMatch) {
        let extracted = endMatch[1];
        let matchStr = endMatch[0];
        let matchIndex = raw.lastIndexOf(matchStr);
        if (matchIndex !== -1) query = raw.substring(0, matchIndex).replace(/,$/, '').trim();

        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) {
            targetJid = extracted;
        } else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            if (num.length >= 10) targetJid = num + '@s.whatsapp.net';
        }
    }

    if (!targetJid && raw.includes(',')) {
        let parts = raw.split(',');
        let lastPart = parts.pop().trim();
        let num = lastPart.replace(/[^0-9]/g, '');
        if (num.length >= 10 && num.length <= 15) {
            targetJid = num + '@s.whatsapp.net';
            query = parts.join(',').trim();
        } else if (num.length > 15) {
            targetJid = num + '@g.us';
            query = parts.join(',').trim();
        }
    }

    return { query, targetJid };
}

async function searchCartoons(query) {
    let url;
    if (!query || query.toLowerCase() === 'all') {
        url = `${BASE_URL}/wp-json/wp/v2/posts?per_page=100`;
    } else {
        url = `${BASE_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=100`;
    }

    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });
    
    return res.data.map(post => {
        let title = post.title?.rendered || 'Untitled';
        title = title
            .replace(/&#8217;/g, "'")
            .replace(/&#8216;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#038;/g, '&');
        return {
            id: post.id,
            title: title,
            link: post.link,
            date: post.date
        };
    });
}

let allCartoonsCache = null;
let allCartoonsCacheTime = 0;

async function fetchAllCartoonTitles() {
    const now = Date.now();
    if (allCartoonsCache && (now - allCartoonsCacheTime < 10 * 60 * 1000)) {
        return allCartoonsCache;
    }

    let page = 1;
    const allTitles = [];
    while (true) {
        try {
            const url = `${BASE_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}`;
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 15000
            });
            if (!res.data || res.data.length === 0) break;
            res.data.forEach(p => {
                let title = p.title?.rendered || 'Untitled';
                title = title
                    .replace(/&#8217;/g, "'")
                    .replace(/&#8216;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#038;/g, '&')
                    .trim();
                allTitles.push(title);
            });
            if (res.data.length < 100) break;
            page++;
        } catch (e) {
            break;
        }
    }

    if (allTitles.length > 0) {
        allCartoonsCache = allTitles;
        allCartoonsCacheTime = now;
    }
    return allTitles;
}

async function getCartoonDetails(postUrl) {
    const res = await axios.get(postUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });
    const html = res.data;
    const $ = cheerio.load(html);

    let title = $('h1.movie-title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    title = title.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'");

    const image = $('.info-poster img').attr('src') || $('meta[property="og:image"]').attr('content') || 'https://sinhalacartoons.com/wp-content/uploads/2026/03/SInhala__1_-removebg-preview-2.png';
    const desc = $('.cast-header:contains("Description")').next().text().trim() || $('meta[property="og:description"]').attr('content') || '';

    let imdb = 'N/A';
    let year = 'N/A';
    let quality = 'HD';
    let director = 'N/A';

    $('.details-list li').each((i, el) => {
        const text = $(el).text();
        if (text.includes('IMDb')) imdb = text.replace(/IMDb Rating:\s*/i, '').trim();
        if (text.includes('Release Year')) year = text.replace(/Release Year:\s*/i, '').trim();
        if (text.includes('Quality')) quality = text.replace(/Quality:\s*/i, '').trim();
        if (text.includes('Director')) director = text.replace(/Director:\s*/i, '').trim();
    });

    const isSeries = $('.episode-row').length > 0;

    if (isSeries) {
        const episodes = [];
        $('.episode-row').each((i, el) => {
            const rawDlUrl = $(el).attr('data-download-url') || '';
            const onclickAttr = $(el).attr('onclick') || '';
            const epNum = $(el).find('.ep-number').text().trim() || `${i + 1}`;

            const streamMatch = onclickAttr.match(/changeEpisode\(['"]([^'"]+)['"]/);
            const streamUrl = streamMatch ? streamMatch[1] : '';

            let directDownload = '';
            let telegramLink = '';
            let epTitle = '';
            const scMatch = rawDlUrl.match(/sc_data=([^"'\s&]+)/);
            if (scMatch) {
                const parsed = decodeScData(scMatch[1]);
                if (parsed) {
                    directDownload = parsed.direct || '';
                    telegramLink = parsed.telegram || '';
                    epTitle = parsed.title || '';
                }
            }

            episodes.push({
                episode: epNum,
                title: epTitle || `${title} - Episode ${epNum}`,
                streamUrl: streamUrl,
                directDownload: directDownload,
                telegramLink: telegramLink
            });
        });

        return {
            success: true,
            type: 'series',
            title,
            image,
            description: desc,
            imdb,
            year,
            quality,
            director,
            totalEpisodes: episodes.length,
            episodes
        };
    } else {
        let directDownload = '';
        let telegramLink = '';
        const scBtn = $('.sc-download-links-btn').attr('href') || '';
        const scMatch = scBtn.match(/sc_data=([^"'\s&]+)/) || html.match(/sc_data=([^"'\s&]+)/);
        if (scMatch) {
            const parsed = decodeScData(scMatch[1]);
            if (parsed) {
                directDownload = parsed.direct || '';
                telegramLink = parsed.telegram || '';
            }
        }

        let streamUrl = '';
        const videoSrc = $('#mainPlayer source').attr('src') || $('#mainPlayer').attr('src') || $('video source').attr('src') || $('video').attr('src');
        if (videoSrc) {
            streamUrl = videoSrc;
        } else {
            const iframeSrc = $('iframe#mainPlayer').attr('src') || $('iframe').attr('src');
            if (iframeSrc) streamUrl = iframeSrc;
        }

        if (!directDownload) {
            $('a').each((i, el) => {
                if (directDownload) return;
                const h = $(el).attr('href') || '';
                const lower = h.toLowerCase();
                if (lower.includes('pixeldrain.com') || lower.includes('drive.google.com') || lower.includes('mega.nz') || lower.includes('workers.dev') || lower.endsWith('.mp4') || lower.endsWith('.mkv')) {
                    directDownload = h;
                }
            });
            if (!directDownload && streamUrl && streamUrl.startsWith('http')) {
                directDownload = streamUrl;
            }
        }

        return {
            success: true,
            type: 'movie',
            title,
            image,
            description: desc,
            imdb,
            year,
            quality,
            director,
            directDownload,
            streamUrl,
            telegramLink
        };
    }
}

// ════════════════════════════════════════════════════════
// 📋 DETAILS DISPLAY HANDLER
// ════════════════════════════════════════════════════════

async function showCartoonDetails({ socket, msg, sender, shortId, targetJid, prefix = '.' }) {
    if (!shortId || !global.cartoonCache[shortId]) {
        return socket.sendMessage(sender, { text: `❌ *කාලය ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.* (\`${prefix}cartoon <නම>\`)` }, { quoted: msg });
    }

    const cached = global.cartoonCache[shortId];
    if (targetJid) cached.targetJid = targetJid;

    try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

    let details = cached.details;
    if (!details) {
        try {
            details = await getCartoonDetails(cached.link);
            cached.details = details;
        } catch (err) {
            console.error("Cartoon Details Error:", err.message);
            return socket.sendMessage(sender, { text: "❌ *විස්තර ලබාගැනීමේදී දෝෂයක් මතු විය!*" }, { quoted: msg });
        }
    }

    if (!details || !details.success) {
        return socket.sendMessage(sender, { text: "❌ *කාටූන් විස්තර ලබාගැනීමට නොහැකි විය.*" }, { quoted: msg });
    }

    // 🎬 SINGLE MOVIE MODE
    if (details.type === 'movie') {
        let caption = `*↳ ❝ [🎀 🎬 ${details.title.toUpperCase()} 🎀] ¡! ❞*\n\n`;
        caption += `⭐ *IMDb:* ${details.imdb || 'N/A'}\n`;
        caption += `📅 *Year:* ${details.year || 'N/A'}\n`;
        caption += `🎥 *Quality:* ${details.quality || 'HD'}\n`;
        if (details.director && details.director !== 'N/A') caption += `🎬 *Director:* ${details.director}\n`;
        if (cached.targetJid) caption += `🎯 *Send Target:* \`${cached.targetJid}\`\n`;
        caption += `\n📝 *Description:*\n_${details.description ? details.description.slice(0, 300) + '...' : 'No description available'}_\n\n`;
        caption += `> *📥 ඩවුන්ලෝඩ් කිරීමට පහත බටන් එක ක්ලික් කරන්න:*`;

        const buttons = [
            {
                buttonId: `${prefix}ctndl ${shortId}`,
                buttonText: { displayText: '📥 DOWNLOAD MOVIE (MP4)' },
                type: 1
            }
        ];

        const sentMsg = await socket.sendMessage(sender, {
            image: { url: details.image },
            caption: caption,
            footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
            buttons: buttons,
            headerType: 4
        }, { quoted: msg });

        const userKey = cleanJid(sender);
        global.cartoonStore[userKey] = {
            stage: 'EPISODES',
            msgId: sentMsg.key.id,
            shortId: shortId,
            details: details,
            targetJid: cached.targetJid,
            prefix: prefix
        };

        setTimeout(() => {
            if (global.cartoonStore[userKey] && global.cartoonStore[userKey].msgId === sentMsg.key.id) {
                delete global.cartoonStore[userKey];
            }
        }, 180000);

        try { await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } }); } catch (_) {}
        return;
    }

    // 📺 TV SERIES / EPISODES MODE
    if (details.type === 'series') {
        let caption = `*↳ ❝ [🎀 📺 ${details.title.toUpperCase()} 🎀] ¡! ❞*\n\n`;
        caption += `⭐ *IMDb:* ${details.imdb || 'N/A'}\n`;
        caption += `📅 *Year:* ${details.year || 'N/A'}\n`;
        caption += `🎞️ *Total Episodes:* ${details.totalEpisodes}\n`;
        if (cached.targetJid) caption += `🎯 *Send Target:* \`${cached.targetJid}\`\n`;
        if (details.description) {
            caption += `\n📝 *Description:*\n_${details.description.slice(0, 200)}..._\n`;
        }
        caption += `\n*👇 Episodes ලැයිස්තුව:*\n`;
        details.episodes.forEach((ep, idx) => {
            caption += `*${idx + 1}.* Ep ${String(ep.episode).padStart(2, '0')} - ${ep.title}\n`;
        });
        caption += `\n> *📩 අවශ්‍ය Episode අංකය (1-${details.totalEpisodes}) Reply කරන්න, නැතහොත් සියල්ල බාගත කිරීමට 'all' ලෙස Reply කරන්න (හෝ Button එක ඔබන්න)*\n`;

        // 1️⃣ TOP BUTTON: DOWNLOAD ALL EPISODES
        const buttons = [
            {
                buttonId: `${prefix}ctndl ${shortId} all`,
                buttonText: { displayText: '📦 DOWNLOAD ALL EPISODES' },
                type: 1
            }
        ];

        // 2️⃣ BELOW: ALL INDIVIDUAL EPISODES BUTTONS (NO LIMIT)
        details.episodes.forEach(ep => {
            const epNumClean = String(ep.episode).padStart(2, '0');
            buttons.push({
                buttonId: `${prefix}ctndl ${shortId} ${epNumClean}`,
                buttonText: { displayText: `📥 Ep ${epNumClean}` },
                type: 1
            });
        });

        const sentMsg = await socket.sendMessage(sender, {
            image: { url: details.image },
            caption: caption,
            footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
            buttons: buttons,
            headerType: 4
        }, { quoted: msg });

        const userKey = cleanJid(sender);
        global.cartoonStore[userKey] = {
            stage: 'EPISODES',
            msgId: sentMsg.key.id,
            shortId: shortId,
            details: details,
            targetJid: cached.targetJid,
            prefix: prefix
        };

        setTimeout(() => {
            if (global.cartoonStore[userKey] && global.cartoonStore[userKey].msgId === sentMsg.key.id) {
                delete global.cartoonStore[userKey];
            }
        }, 180000);

        try { await socket.sendMessage(sender, { react: { text: '📺', key: msg.key } }); } catch (_) {}
        return;
    }
}

// ════════════════════════════════════════════════════════
// 📥 DOWNLOAD & STREAM HANDLER
// ════════════════════════════════════════════════════════

async function handleCartoonDownload({ socket, msg, sender, shortId, epArg = '01', targetJid = null, prefix = '.' }) {
    if (!shortId || !global.cartoonCache[shortId]) {
        return socket.sendMessage(sender, { text: `❌ *කාලය ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.* (\`${prefix}cartoon <නම>\`)` }, { quoted: msg });
    }

    const cached = global.cartoonCache[shortId];
    if (targetJid) cached.targetJid = targetJid;

    let details = cached.details;
    if (!details) {
        try {
            details = await getCartoonDetails(cached.link);
            cached.details = details;
        } catch (e) {
            return socket.sendMessage(sender, { text: "❌ *කාටූන් විස්තර ලබාගැනීමට අපොහොසත් විය.*" }, { quoted: msg });
        }
    }

    const destJid = cached.targetJid || sender;

    // Send thumbnail and details card to target group first
    if (cached.targetJid && destJid !== sender) {
        try {
            const targetCardText =
                `*↳ ❝ [🎀 🎬 SINHALA CARTOONS 🎀] ¡! ❞*\n\n` +
                `🎬 *TITLE:* ${details.title}\n` +
                (details.type === 'series' && details.episodes ? `🎞️ *TOTAL EPISODES:* ${details.episodes.length}\n` : '') +
                (details.description ? `📝 *STORY:* ${details.description.slice(0, 250)}...\n` : '') +
                `\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;
            if (details.image) {
                await socket.sendMessage(destJid, { image: { url: details.image }, caption: targetCardText });
            } else {
                await socket.sendMessage(destJid, { text: targetCardText });
            }
        } catch (cardErr) {
            console.error('[Cartoon] Group card error:', cardErr.message);
        }
    }

    // ══════════════════════════════════════════════
    // 📦 DOWNLOAD ALL EPISODES IN SERIES
    // ══════════════════════════════════════════════
    if (epArg.toLowerCase() === 'all') {
        if (details.type !== 'series' || !details.episodes || details.episodes.length === 0) {
            return socket.sendMessage(sender, { text: "❌ *මෙම කාටූනය සඳහා Episodes ලැයිස්තුවක් හමු නොවීය.*" }, { quoted: msg });
        }

        if (isCartoonAllDownloading) {
            return socket.sendMessage(sender, {
                text: "⚠️ *දැනටමත් කාටූන් කතා මාලාවක් බාගත වෙමින් පවතී.* කරුණාකර එය අවසන් වනතුරු මදක් රැඳී සිටින්න."
            }, { quoted: msg });
        }

        isCartoonAllDownloading = true;

        try {
            await socket.sendMessage(sender, { react: { text: '📦', key: msg.key } });

            let startMsg = `📦 *[ALL EPISODES DOWNLOAD]*\n🎬 *Series:* ${details.title}\n🎞️ *Total Episodes:* ${details.episodes.length}\n`;
            if (cached.targetJid) startMsg += `🎯 *Target Send To:* \`${cached.targetJid}\`\n`;
            startMsg += `\n_සියලුම Episodes එකින් එක පිළිවෙළින් Download කර යවනු ලැබේ. කරුණාකර රැඳී සිටින්න..._`;
            await socket.sendMessage(sender, { text: startMsg }, { quoted: msg });

            for (let i = 0; i < details.episodes.length; i++) {
                const ep = details.episodes[i];
                const epNumClean = String(ep.episode).padStart(2, '0');
                const targetTitle = ep.title || `${details.title} - Episode ${epNumClean}`;
                const targetDownloadUrl = ep.directDownload || ep.streamUrl;

                if (!targetDownloadUrl) {
                    await socket.sendMessage(sender, { text: `⚠️ *[${i + 1}/${details.episodes.length}]* \`${targetTitle}\` සඳහා Download link හමු නොවූ බැවින් මඟ හරින ලදී.` });
                    continue;
                }

                await socket.sendMessage(sender, { text: `📥 *[${i + 1}/${details.episodes.length}]* _*${targetTitle}* බාගත වෙමින් පවතී..._` });

                let epTempFile = null;
                try {
                    const streamRes = await axios({
                        method: 'GET',
                        url: targetDownloadUrl,
                        responseType: 'stream',
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        timeout: 600000
                    });

                    const streamCl = streamRes.headers['content-length'];
                    const limit2GB = 2 * 1024 * 1024 * 1024;
                    if (streamCl && parseInt(streamCl, 10) > limit2GB) {
                        streamRes.data.destroy();
                        await socket.sendMessage(destJid, {
                            text: `⚠️ *[${i + 1}/${details.episodes.length}] ${targetTitle}* 2GB ට වඩා විශාල බැවින් WhatsApp හරහා එවිය නොහැක.\n🔗 *Direct Link:* ${targetDownloadUrl}`
                        });
                        continue;
                    }

                    const rand = crypto.randomBytes(4).toString('hex');
                    const cleanName = targetTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 60).trim();
                    const fileName = `${cleanName} SADEW MINI.mp4`;
                    epTempFile = path.join(tempDir, `ctn_all_${rand}.mp4`);

                    const writer = fs.createWriteStream(epTempFile);
                    await pipeline(streamRes.data, writer);

                    const docCaption = `*↳ ❝ [🎀 🎬 ${details.title.toUpperCase()} 🎀] ¡! ❞*\n\n🎬 *Episode:* ${epNumClean}\n🎞️ *Title:* ${targetTitle}\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;

                    await socket.sendMessage(destJid, {
                        document: { stream: fs.createReadStream(epTempFile) },
                        mimetype: 'video/mp4',
                        fileName: fileName,
                        caption: docCaption
                    });

                } catch (epErr) {
                    console.error(`Error sending Ep ${epNumClean}:`, epErr.message);
                    await socket.sendMessage(sender, { text: `❌ *[${i + 1}/${details.episodes.length}]* Ep ${epNumClean} එවීමේදී දෝෂයක් මතු විය: ${epErr.message}` });
                } finally {
                    if (epTempFile && fs.existsSync(epTempFile)) {
                        try { fs.unlinkSync(epTempFile); } catch (_) {}
                    }
                    cleanTempDir();
                    if (global.gc) {
                        try { global.gc(); } catch (_) {}
                    }
                }

                // Safe 5 second pause between episodes for stability
                if (i < details.episodes.length - 1) {
                    await new Promise(r => setTimeout(r, 5000));
                }
            }

            const completionMsg = `✅ *[COMPLETED]* \`${details.title}\` හි සියලුම Episodes (${details.episodes.length}) සාර්ථකව ${cached.targetJid ? `\`${cached.targetJid}\` වෙත ` : ''}යවා අවසන් කරන ලදී! 🎉`;
            await socket.sendMessage(sender, { text: completionMsg });
            return;
        } finally {
            isCartoonAllDownloading = false;
            cleanTempDir();
            if (global.gc) {
                try { global.gc(); } catch (_) {}
            }
        }
    }

    // ══════════════════════════════════════════════
    // 🎬 DOWNLOAD SINGLE MOVIE OR EPISODE
    // ══════════════════════════════════════════════
    let targetDownloadUrl = '';
    let targetTitle = details.title;

    if (details.type === 'movie') {
        targetDownloadUrl = details.directDownload || details.streamUrl;
    } else if (details.type === 'series') {
        const epClean = epArg.replace(/[^0-9]/g, '');
        const matchedEp = details.episodes.find(e => 
            String(e.episode).replace(/[^0-9]/g, '') === epClean ||
            String(e.episode).toLowerCase().includes(epArg.toLowerCase())
        ) || details.episodes[0];

        if (!matchedEp) {
            return socket.sendMessage(sender, { text: `❌ *Episode ${epArg} සොයාගත නොහැකි විය!*` }, { quoted: msg });
        }

        targetDownloadUrl = matchedEp.directDownload || matchedEp.streamUrl;
        targetTitle = matchedEp.title || `${details.title} - Episode ${epArg}`;
    }

    if (!targetDownloadUrl) {
        return socket.sendMessage(sender, { text: "❌ *මෙම කාටූනය සඳහා Direct Download ලින්ක් එකක් හමු නොවුණි!*" }, { quoted: msg });
    }

    try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

    if (cached.targetJid) {
        await socket.sendMessage(sender, { text: `🚀 *[CartoonSend]* \`${targetTitle}\` ඩවුන්ලෝඩ් කර \`${cached.targetJid}\` වෙත යවමින් පවතී... (කරුණාකර රැඳී සිටින්න)` }, { quoted: msg });
    } else {
        await socket.sendMessage(sender, { text: `📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*_ \n*${targetTitle}* බාගත වෙමින් පවතී... (කරුණාකර රැඳී සිටින්න)` }, { quoted: msg });
    }

    let tempFilePath = null;

    try {
        // RAM-Safe pure stream download
        const streamRes = await axios({
            method: 'GET',
            url: targetDownloadUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': '*/*'
            },
            timeout: 600000
        });

        const streamCl = streamRes.headers['content-length'];
        const limit2GB = 2 * 1024 * 1024 * 1024;

        if (streamCl) {
            const streamBytes = parseInt(streamCl, 10);
            if (streamBytes > limit2GB) {
                streamRes.data.destroy();
                try { await socket.sendMessage(sender, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return socket.sendMessage(sender, { text: `⚠️ *ගොනුව 2GB ට වඩා විශාල බැවින් WhatsApp හරහා එවිය නොහැක! (${(streamBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)*\n\n🔗 *Direct High-Speed Link:*\n${targetDownloadUrl}` }, { quoted: msg });
            }
        }

        const tempRand = crypto.randomBytes(4).toString('hex');
        const cleanName = targetTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 60).trim();
        const fileName = `${cleanName} SADEW MINI.mp4`;

        tempFilePath = path.join(tempDir, `ctn_${tempRand}.mp4`);

        const writer = fs.createWriteStream(tempFilePath);
        await pipeline(streamRes.data, writer);

        await socket.sendMessage(sender, { text: `⚙️ *${targetTitle}* WhatsApp වෙත Upload කරමින් පවතී...` });

        const docCaption = `*↳ ❝ [🎀 🎬 SINHALA CARTOONS 🎀] ¡! ❞*\n\n🎬 *TITLE:* ${targetTitle}\n\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;

        await socket.sendMessage(destJid, {
            document: { stream: fs.createReadStream(tempFilePath) },
            mimetype: 'video/mp4',
            fileName: fileName,
            caption: docCaption
        }, { quoted: (destJid === sender ? msg : undefined) });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        if (destJid !== sender) {
            await socket.sendMessage(sender, { text: `✅ *[CartoonSend]* \`${targetTitle}\` සාර්ථකව \`${destJid}\` වෙත යවන ලදී!` });
        }

    } catch (dlErr) {
        console.error("Cartoon Download Error:", dlErr.message);
        await socket.sendMessage(sender, { text: `❌ *Download කිරීමේදී දෝෂයක් මතු විය!*\n\n🔗 *Direct Link:* ${targetDownloadUrl}` }, { quoted: msg });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (_) {}
        }
        cleanTempDir();
        if (global.gc) {
            try { global.gc(); } catch (_) {}
        }
    }
}

// ════════════════════════════════════════════════════════
// 🔄 INTERACTIVE NUMBER / 'ALL' REPLY LISTENER
// ════════════════════════════════════════════════════════

function attachReplyListener(socket) {
    if (!socket || attachedSockets.has(socket)) return;
    attachedSockets.add(socket);

    socket.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m || !m.message || m.key.fromMe) return;

            const from = cleanJid(m.key.remoteJid);
            const userSender = cleanJid(m.key.participant || from);
            const text = (
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                m.message.buttonsResponseMessage?.selectedButtonId ||
                ''
            ).trim();

            if (!text) return;

            const session = global.cartoonStore[userSender] || global.cartoonStore[from];
            if (!session) return;

            const quotedStanza = m.message.extendedTextMessage?.contextInfo?.stanzaId;
            const isQuotedMatch = quotedStanza && quotedStanza === session.msgId;
            const num = parseInt(text, 10);

            // STAGE 1: Selection from numbered Cartoon list (1-100 or search results)
            if (session.stage === 'SELECTION') {
                if ((isQuotedMatch || !isNaN(num)) && num >= 1 && num <= session.results.length) {
                    const selected = session.results[num - 1];
                    delete global.cartoonStore[userSender];
                    delete global.cartoonStore[from];

                    const shortId = storeCartoonData({
                        link: selected.link,
                        title: selected.title,
                        targetJid: session.targetJid
                    });

                    await showCartoonDetails({
                        socket,
                        msg: m,
                        sender: from,
                        shortId: shortId,
                        targetJid: session.targetJid,
                        prefix: session.prefix || '.'
                    });
                }
            }
            // STAGE 2: Episode selection or 'all' download in Series
            else if (session.stage === 'EPISODES') {
                if (text.toLowerCase() === 'all') {
                    delete global.cartoonStore[userSender];
                    delete global.cartoonStore[from];

                    await handleCartoonDownload({
                        socket,
                        msg: m,
                        sender: from,
                        shortId: session.shortId,
                        epArg: 'all',
                        targetJid: session.targetJid,
                        prefix: session.prefix || '.'
                    });
                    return;
                }

                if ((isQuotedMatch || !isNaN(num)) && num >= 1 && num <= (session.details.episodes?.length || 1)) {
                    delete global.cartoonStore[userSender];
                    delete global.cartoonStore[from];

                    await handleCartoonDownload({
                        socket,
                        msg: m,
                        sender: from,
                        shortId: session.shortId,
                        epArg: String(num).padStart(2, '0'),
                        targetJid: session.targetJid,
                        prefix: session.prefix || '.'
                    });
                }
            }
        } catch (err) {
            console.error('[Cartoon] Reply listener error:', err.message);
        }
    });
}

// ════════════════════════════════════════════════════════
// 🎬 PLUGIN EXPORTS
// ════════════════════════════════════════════════════════
module.exports = {
    name: 'sinhalacartoons',
    description: 'Search & download Sinhala dubbed cartoons, movies & series from sinhalacartoons.com',
    category: 10,
    hidden: true, // Hides completely from auto-generated menus
    commands: ['cartoon', 'cartoons', 'ctn', 'ctnsend', 'ctndet', 'ctndl', 'ctnep'],

    handler: async ({ socket, msg, sender, command, args, prefix = '.', reply }) => {
        try {
            attachReplyListener(socket);

            // ══════════════════════════════════════════════
            // 🔍 1. SEARCH CARTOONS / LIST ALL (.cartoon [all | <query>] [, <jid>])
            // ══════════════════════════════════════════════
            if (command === 'cartoon' || command === 'cartoons' || command === 'ctn' || command === 'ctnsend') {
                const fullText = args.join(' ').trim();
                const { query, targetJid } = parseTargetJid(fullText);

                if (command === 'ctnsend' && !targetJid) {
                    return reply(
                        `❌ *කරුණාකර කොමාවකින් (,) වෙන් කර නිවැරදි Group JID එකක් හෝ Phone Number එකක් ලබාදෙන්න!*\n` +
                        `_උදා: .ctnsend all , 12036304@g.us_\n` +
                        `_උදා: .ctnsend ben 10 , 0771234567_`
                    );
                }

                const isAll = !query || query.toLowerCase() === 'all';

                try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

                // ----------------------------------------------------
                // CASE 1A: ALL CARTOONS LIST (.cartoon all) -> PLAIN TEXT ONLY (NO BUTTONS)
                // ----------------------------------------------------
                if (isAll) {
                    try {
                        const allTitles = await fetchAllCartoonTitles();
                        if (!allTitles || allTitles.length === 0) {
                            return reply("❌ *කාටූන් ලැයිස්තුව ලබාගැනීමට නොහැකි විය. පසුව උත්සාහ කරන්න.*");
                        }

                        let listText = `*↳ ❝ [🎀 🎬 SINHALA CARTOONS ARCHIVE 🎀] ¡! ❞*\n\n`;
                        listText += `📊 *Total Cartoons & Movies Available:* ${allTitles.length}\n`;
                        if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n`;
                        listText += `💡 *අවශ්‍ය කාටූනය බැලීමට නම Type කර Search කරන්න:*\n`;
                        listText += `_උදා: ${prefix}cartoon ${allTitles[0] ? allTitles[0].split('|')[0].trim() : 'The Bad Guys 2'}_\n\n`;
                        listText += `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n\n`;

                        allTitles.forEach((t, i) => {
                            listText += `✦ *${i + 1}.* ${t}\n`;
                        });

                        listText += `\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
                        listText += `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;

                        await socket.sendMessage(sender, { text: listText }, { quoted: msg });
                        try { await socket.sendMessage(sender, { react: { text: '📜', key: msg.key } }); } catch (_) {}
                        return;
                    } catch (allErr) {
                        console.error('[Cartoon] fetchAll error:', allErr.message);
                        return reply(`❌ *දෝෂයක් මතු විය:* ${allErr.message}`);
                    }
                }

                // ----------------------------------------------------
                // CASE 1B: SEARCH RESULTS LIST (.cartoon <query>)
                // ----------------------------------------------------
                let results;
                try {
                    results = await searchCartoons(query);
                } catch (err) {
                    console.error("Cartoon Search Error:", err.message);
                    return reply("❌ *සර්ච් කිරීමේදී දෝෂයක් මතු විය. පසුව උත්සාහ කරන්න.*");
                }

                if (!results || results.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`🤷‍♀️ *"${query}" සඳහා කිසිදු ප්‍රතිඵලයක් සොයාගත නොහැකි විය!*`);
                }

                const logoUrl = 'https://sinhalacartoons.com/wp-content/uploads/2026/03/SInhala__1_-removebg-preview-2.png';

                let caption = `*↳ ❝ [🎀 🎬 SINHALA CARTOONS 🎀] ¡! ❞*\n\n`;
                caption += `*🔎 සෙවුම:* _${query}_\n`;
                caption += `*📁 හමුවූ ප්‍රතිඵල ගණන:* ${results.length}\n`;
                if (targetJid) caption += `🎯 *Send Target:* \`${targetJid}\`\n`;
                caption += `\n`;

                const buttons = [];
                results.forEach((item, index) => {
                    const shortId = storeCartoonData({
                        link: item.link,
                        title: item.title,
                        targetJid: targetJid
                    });

                    caption += `*${index + 1}.* 🎬 *${item.title}*\n`;

                    buttons.push({
                        buttonId: `${prefix}ctndet ${shortId}`,
                        buttonText: { displayText: `🎬 ${index + 1}. ${(item.title || '').slice(0, 20)}` },
                        type: 1
                    });
                });

                caption += `\n> *👇 පහතින් බටන් එක click කරන්න හෝ අංකය (1-${results.length}) Reply කරන්න:*`;

                const sentMsg = await socket.sendMessage(sender, {
                    image: { url: logoUrl },
                    caption: caption,
                    footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
                    buttons: buttons.length > 0 ? buttons : undefined,
                    headerType: 4
                }, { quoted: msg });

                const userKey = cleanJid(sender);
                global.cartoonStore[userKey] = {
                    stage: 'SELECTION',
                    msgId: sentMsg.key.id,
                    results: results,
                    targetJid: targetJid,
                    prefix: prefix
                };

                setTimeout(() => {
                    if (global.cartoonStore[userKey] && global.cartoonStore[userKey].msgId === sentMsg.key.id) {
                        delete global.cartoonStore[userKey];
                    }
                }, 180000);

                try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                return;
            }

            // ══════════════════════════════════════════════
            // 📋 2. CARTOON DETAILS & EPISODES (.ctndet <id>)
            // ══════════════════════════════════════════════
            if (command === 'ctndet') {
                const shortId = args[0];
                await showCartoonDetails({
                    socket,
                    msg,
                    sender,
                    shortId,
                    prefix
                });
                return;
            }

            // ══════════════════════════════════════════════
            // 📥 3. DOWNLOAD (.ctndl <id> [epNum / 'all'])
            // ══════════════════════════════════════════════
            if (command === 'ctndl' || command === 'ctnep') {
                const shortId = args[0];
                const epArg = args[1] || '01';
                await handleCartoonDownload({
                    socket,
                    msg,
                    sender,
                    shortId,
                    epArg,
                    prefix
                });
                return;
            }

        } catch (globalErr) {
            console.error("Cartoon Plugin Global Error:", globalErr);
            reply("❌ *දෝෂයක් මතු විය! කරුණාකර පසුව නැවත උත්සාහ කරන්න.*");
        }
    }
};
