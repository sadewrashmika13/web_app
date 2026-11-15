const os = require('os');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// ════════════════════════════════════════════════════════
// GLOBAL STORES FOR CARTOONS.LK DOWNLOADER
// ════════════════════════════════════════════════════════
if (!global.clkStore) global.clkStore = {};
if (!global.clkAllLocks) global.clkAllLocks = {};

function genId() { 
    return crypto.randomBytes(4).toString('hex'); 
}

function storeData(data, ttlMs = 2 * 60 * 60 * 1000) { 
    const id = genId();
    global.clkStore[id] = data;
    const t = setTimeout(() => { delete global.clkStore[id]; }, ttlMs);
    if (t && typeof t.unref === 'function') t.unref();
    return id;
}

function getTempDir() {
    try {
        const localTemp = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(localTemp)) fs.mkdirSync(localTemp, { recursive: true });
        return localTemp;
    } catch (_) {}
    try {
        const sysTemp = path.join(os.tmpdir(), 'bot_temp');
        if (!fs.existsSync(sysTemp)) fs.mkdirSync(sysTemp, { recursive: true });
        return sysTemp;
    } catch (_) {}
    return os.tmpdir();
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return 'Unknown Size';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
}

function cleanTitle(raw) {
    if (!raw) return 'Unknown Cartoon';
    return raw
        .replace(/Sinhala Dubbed Cartoon\s*\|\s*සිංහල හඩකැවූ\s*.*$/gi, '')
        .replace(/Sinhala Dubbed Movie\s*\|\s*සිංහල හඩකැවූ\s*.*$/gi, '')
        .replace(/Sinhala Dubbed\s*\|\s*සිංහල හඩකැවූ\s*.*$/gi, '')
        .replace(/Sinhala Subtitles\s*\|\s*සිංහල උපසිරැසි සමඟ\s*.*$/gi, '')
        .replace(/\|\s*සිංහල\s*.*$/gi, '')
        .replace(/\|.*$/i, '')
        .trim();
}

// Ultra smart target parser (supports JID, Group JID, phone numbers with or without comma)
function parseTarget(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    // 1. Explicit WhatsApp JID (@s.whatsapp.net, @g.us, @newsletter) anywhere with or without comma
    const jidRegex = /\b([0-9a-zA-Z._-]+@(s\.whatsapp\.net|g\.us|newsletter))\b/i;
    const jidMatch = raw.match(jidRegex);
    if (jidMatch) {
        targetJid = jidMatch[1];
        query = raw.replace(jidMatch[0], ' ')
                   .replace(/[,|]/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
        return { query, targetJid };
    }

    // 2. Sri Lankan phone number at the end (with space or comma)
    const endPhoneMatch = raw.match(/(?:,|\s+|\|)+(\+?94\s?7[0-9]{8}|07[0-9]{8}|94\s?7[0-9]{8})$/i);
    if (endPhoneMatch) {
        let extracted = endPhoneMatch[1].replace(/[^0-9]/g, '');
        if (extracted.startsWith('0') && extracted.length === 10) {
            extracted = '94' + extracted.slice(1);
        }
        if (extracted.length === 11 && extracted.startsWith('94')) {
            targetJid = extracted + '@s.whatsapp.net';
            const matchIndex = raw.lastIndexOf(endPhoneMatch[0]);
            if (matchIndex !== -1) query = raw.substring(0, matchIndex).trim();
            query = query.replace(/[,|]$/, '').trim();
            return { query, targetJid };
        }
    }

    // 3. Sri Lankan phone number at the start (with space or comma)
    const startPhoneMatch = raw.match(/^(\+?94\s?7[0-9]{8}|07[0-9]{8}|94\s?7[0-9]{8})(?:,|\s+|\|)+/i);
    if (startPhoneMatch) {
        let extracted = startPhoneMatch[1].replace(/[^0-9]/g, '');
        if (extracted.startsWith('0') && extracted.length === 10) {
            extracted = '94' + extracted.slice(1);
        }
        if (extracted.length === 11 && extracted.startsWith('94')) {
            targetJid = extracted + '@s.whatsapp.net';
            query = raw.substring(startPhoneMatch[0].length).trim();
            query = query.replace(/^[,|]/, '').trim();
            return { query, targetJid };
        }
    }

    // 4. Comma separated target (e.g. "ben 10, 0771234567")
    if (raw.includes(',')) {
        let parts = raw.split(',');
        let lastPart = parts.pop().trim();
        let num = lastPart.replace(/[^0-9]/g, '');
        if (num.length >= 9 && num.length <= 15) {
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            targetJid = num + '@s.whatsapp.net';
            query = parts.join(',').trim();
        } else if (num.length > 15) {
            targetJid = num + '@g.us';
            query = parts.join(',').trim();
        }
    }

    // 5. Space separated raw 10-15 digit number at the end (e.g. "ben 10 0771234567")
    if (!targetJid) {
        const tokens = raw.split(/\s+/);
        if (tokens.length >= 2) {
            const lastToken = tokens[tokens.length - 1].replace(/[^0-9]/g, '');
            if ((lastToken.length === 10 && lastToken.startsWith('07')) ||
                (lastToken.length === 11 && lastToken.startsWith('947')) ||
                (lastToken.length >= 10 && lastToken.length <= 15 && !isNaN(tokens[tokens.length - 1]))) {
                let num = lastToken;
                if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
                targetJid = num + '@s.whatsapp.net';
                tokens.pop();
                query = tokens.join(' ').trim();
            } else if (tokens[0].replace(/[^0-9]/g, '').length === 10 && tokens[0].startsWith('07')) {
                let num = tokens[0].replace(/[^0-9]/g, '');
                num = '94' + num.slice(1);
                targetJid = num + '@s.whatsapp.net';
                tokens.shift();
                query = tokens.join(' ').trim();
            }
        }
    }

    query = query.replace(/^[,|\s]+|[,|\s]+$/g, '').trim();
    return { query, targetJid };
}

// ════════════════════════════════════════════════════════
// CARTOONS.LK SCRAPING & STREAM RESOLUTION ENGINE
// ════════════════════════════════════════════════════════
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Fetch all posts via WP REST API (for .cartoonlk all)
async function fetchAllPosts() {
    const res = await axios.get('https://cartoons.lk/wp-json/wp/v2/posts?per_page=100&_embed', {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 25000
    });
    if (!Array.isArray(res.data)) return [];

    return res.data.map(p => {
        const fullTitle = p.title?.rendered || 'Untitled';
        const title = cleanTitle(fullTitle);
        const link = p.link || '';
        const img = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                    p.featured_media_src_url || 
                    '';
        const isSeries = fullTitle.toLowerCase().includes('season') || 
                         fullTitle.toLowerCase().includes('episode') ||
                         link.includes('season') ||
                         link.includes('series');

        return {
            id: p.id,
            rawTitle: fullTitle,
            title,
            link,
            img,
            isSeries
        };
    });
}

// Search posts via WP REST API with fallback to HTML search
async function searchPosts(query) {
    try {
        const res = await axios.get(`https://cartoons.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&_embed`, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 20000
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
            return res.data.map(p => {
                const fullTitle = p.title?.rendered || 'Untitled';
                const title = cleanTitle(fullTitle);
                const link = p.link || '';
                const img = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || 
                            p.featured_media_src_url || 
                            '';
                const isSeries = fullTitle.toLowerCase().includes('season') || 
                                 fullTitle.toLowerCase().includes('episode') ||
                                 link.includes('season') ||
                                 link.includes('series');

                return {
                    id: p.id,
                    rawTitle: fullTitle,
                    title,
                    link,
                    img,
                    isSeries
                };
            });
        }
    } catch (_) {}

    // Fallback: Scrape HTML search https://cartoons.lk/?s=<query>
    const searchRes = await axios.get(`https://cartoons.lk/?s=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 20000
    });
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

        let img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
        const title = cleanTitle(rawTitle);
        const isSeries = rawTitle.toLowerCase().includes('season') || 
                         rawTitle.toLowerCase().includes('episode') ||
                         href.includes('season') ||
                         href.includes('series');

        results.push({
            id: null,
            rawTitle,
            title,
            link: href,
            img,
            isSeries
        });
    });

    return results;
}

// Scrape details from single page (movie or series)
async function scrapeDetails(pageUrl) {
    const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 25000
    });
    const html = res.data;
    const $ = cheerio.load(html);

    // Extract Nonce
    const mNonce = html.match(/nonce:\s*["']([a-zA-Z0-9]+)["']/i);
    const nonce = mNonce ? mNonce[1] : null;

    // Extract Post ID
    let postId = $('.movie-download-container').attr('data-post-id') ||
                 $('button.direct-download-btn').first().attr('data-post-id') ||
                 $('button[data-post-id]').first().attr('data-post-id');
    if (!postId) {
        const mEpId = html.match(/id=["']episodes-data-(\d+)["']/i);
        if (mEpId) postId = mEpId[1];
    }
    if (!postId) {
        const mPostId = html.match(/post-(\d+)/i);
        if (mPostId) postId = mPostId[1];
    }

    const rawTitle = $('h1').text().trim() || $('title').text().trim();
    const title = cleanTitle(rawTitle);

    const poster = $('meta[property="og:image"]').attr('content') || 
                   $('.movie-poster img, .entry-content img').first().attr('src') || 
                   '';

    let synopsis = $('.movie-synopsis, .synopsis, .storyline, .entry-content p').first().text().trim();
    if (synopsis.length > 250) synopsis = synopsis.slice(0, 247) + '...';

    // Check if TV Series (JSON episodes script)
    const epScript = $(`script[id^="episodes-data-"]`);
    let isSeries = false;
    let episodes = [];

    if (epScript.length > 0) {
        try {
            const parsed = JSON.parse(epScript.html());
            if (Array.isArray(parsed) && parsed.length > 0) {
                isSeries = true;
                episodes = parsed;
            }
        } catch (_) {}
    }

    // Single movie download links
    const downloadQualities = [];
    if (!isSeries) {
        $('button.direct-download-btn, a.direct-download-btn, [data-action-type="download"]').each((i, el) => {
            const pId = $(el).attr('data-post-id') || postId;
            const lIndex = $(el).attr('data-link-index') || '0';
            const provider = $(el).attr('data-provider') || 'r2';
            let label = $(el).text().trim() || `Download`;
            if (label.toLowerCase() === 'download') label = 'HD Download';

            downloadQualities.push({
                postId: pId,
                linkIndex: lIndex,
                provider,
                label
            });
        });

        // Default quality button if none matched explicitly
        if (downloadQualities.length === 0 && postId) {
            downloadQualities.push({
                postId: postId,
                linkIndex: '0',
                provider: 'r2',
                label: 'Direct HD Download'
            });
        }
    }

    return {
        postId,
        nonce,
        rawTitle,
        title,
        poster,
        synopsis,
        isSeries,
        episodes,
        downloadQualities
    };
}

// Resolve direct Cloudflare Worker stream link from cartoons.lk
async function resolveCartoonsStream({ pageUrl, postId, nonce, type, episodeIndex, linkIndex }) {
    if (!nonce || !postId) {
        const pageRes = await axios.get(pageUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 20000
        });
        const m = pageRes.data.match(/nonce:\s*["']([a-zA-Z0-9]+)["']/i);
        if (m) nonce = m[1];
        if (!postId) {
            const mPost = pageRes.data.match(/data-post-id=["'](\d+)["']/i) || pageRes.data.match(/id=["']episodes-data-(\d+)["']/i);
            if (mPost) postId = mPost[1];
        }
    }
    if (!nonce) throw new Error("cartoons.lk Nonce Token එක සොයා ගැනීමට නොහැකි විය.");
    if (!postId) throw new Error("cartoons.lk Post ID එක සොයා ගැනීමට නොහැකි විය.");

    const params = new URLSearchParams();
    params.append('action', 'get_movie_link');
    params.append('nonce', nonce);
    params.append('post_id', postId);
    params.append('type', type || 'single');
    params.append('action_type', 'download');
    if (type === 'episode') {
        params.append('episode_index', String(episodeIndex !== undefined ? episodeIndex : 0));
    }
    params.append('link_index', String(linkIndex !== undefined ? linkIndex : 0));

    const ajaxRes = await axios.post('https://cartoons.lk/wp-admin/admin-ajax.php', params.toString(), {
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Referer': pageUrl,
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 25000
    });

    if (!ajaxRes.data || !ajaxRes.data.success || !ajaxRes.data.data || !ajaxRes.data.data.url) {
        throw new Error(ajaxRes.data?.data?.message || "cartoons.lk Server එකෙන් Download Link එකක් නිකුත් නොකළේය.");
    }

    const dlUrl = ajaxRes.data.data.url;

    // Follow 302 redirect from cartoons.lk/dl/<hash> to Cloudflare Workers stream
    const redirRes = await axios.get(dlUrl, {
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 0,
        validateStatus: null,
        timeout: 20000
    });

    const finalUrl = redirRes.headers.location || dlUrl;

    // Get exact file size via HEAD request
    let size = 0;
    try {
        const headRes = await axios.head(finalUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        const cl = headRes.headers['content-length'];
        if (cl) size = parseInt(cl, 10);
    } catch (_) {}

    return {
        url: finalUrl,
        size: size,
        provider: ajaxRes.data.data.provider || 'r2'
    };
}

// ════════════════════════════════════════════════════════
// PLUGIN DEFINITION & COMMAND DISPATCHER
// ════════════════════════════════════════════════════════
module.exports = {
    name: "cartoonlk-downloader",
    category: 10,
    description: "Search and download Sinhala cartoons & movies from Cartoons.lk",
    commands: ["cartoonlk", "cartoonslk", "clk", "cartoonsend", "clk_sel", "clk_ep", "clk_dl", "clk_all"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";

        // Meta AI Quote
        const metaName = "Meta AI";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CLK" },
            message: { contactMessage: { displayName: metaName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${metaName};;;;\nFN:${metaName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH & ALL COMMANDS (.cartoonlk, .cartoonslk, .clk, .cartoonsend)
        // ════════════════════════════════════════════════════════
        if (command === "cartoonlk" || command === "cartoonslk" || command === "clk" || command === "cartoonsend") {
            const fullText = args.join(" ").trim();
            if (!fullText) {
                return reply(
                    `🎬 *කරුණාකර Cartoon / Movie හෝ Series එකේ නම ලබා දෙන්න!*\n\n` +
                    `📌 *භාවිතය (Usage):*\n` +
                    `• *.cartoonlk ben 10* - Ben 10 search කිරීමට\n` +
                    `• *.cartoonlk all* - Cartoons.lk හි සියලුම Cartoons & Movies button list එක ලබාගැනීමට\n` +
                    `• *.cartoonlk ben 10 0771234567* - වෙනත් අංකයකට යැවීමට (කොමා නැතුව)\n` +
                    `• *.cartoonlk ben 10 120363xxx@g.us* - Group එකකට යැවීමට (කොමා නැතුව)`
                );
            }

            let { query, targetJid } = parseTarget(fullText);

            // If user only passed targetJid, check if replying to a movie/cartoon message
            if (!query && targetJid) {
                const quotedMsg = msg.quoted || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    const quotedText = quotedMsg.conversation || 
                                       quotedMsg.extendedTextMessage?.text || 
                                       quotedMsg.imageMessage?.caption || 
                                       quotedMsg.videoMessage?.caption || 
                                       '';
                    const mTitle = quotedText.match(/(?:Title|Series|Movie|චිත්‍රපටය|කාටූනය|නම):\s*([^\n\r]+)/i);
                    if (mTitle) query = cleanTitle(mTitle[1]);
                }
            }

            if (command === "cartoonsend" && !targetJid) {
                return reply("❌ *කරුණාකර අංකයක් හෝ Group JID එකක් ලබාදෙන්න!*\n_උදා: .cartoonsend ben 10 0771234567_\n_හෝ: .cartoonsend ben 10 120363xxx@g.us_");
            }
            if (!query) return reply("🎬 *කරුණාකර Cartoon හෝ Movie එකේ නම ලබා දෙන්න!*");

            const isAll = query.toLowerCase() === 'all';

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                let items = [];
                if (isAll) {
                    items = await fetchAllPosts();
                } else {
                    items = await searchPosts(query);
                }

                if (!items || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply(`❌ *"${query}" සඳහා කිසිදු ප්‍රතිඵලයක් Cartoons.lk වෙතින් හමු නොවීය.*`);
                }

                let listText = `*↳ ❝ [🎬 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 ${isAll ? '𝗔𝗟𝗟 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦' : '𝗦𝗘𝗔𝗥𝗖𝗛'} 🎬] ¡! ❞*\n\n`;
                if (!isAll) listText += `🔍 *Search:* ${query}\n`;
                listText += `📊 *Total Found:* ${items.length} Cartoons / Movies\n`;
                if (targetJid) listText += `🎯 *Send To:* \`${targetJid}\`\n`;
                listText += `⚡ *Server:* Cloudflare R2 High-Speed Workers\n\n`;

                const buttons = [];
                items.forEach((item, index) => {
                    const tag = item.isSeries ? '📺 [Series]' : '🎬 [Movie]';
                    listText += `*${index + 1}.* ${item.title}\n`;
                    listText += `   ↳ 🏷️ ${tag}\n\n`;

                    const storeId = storeData({
                        postId: item.id,
                        url: item.link,
                        title: item.title,
                        isSeries: item.isSeries,
                        img: item.img,
                        targetJid: targetJid
                    });

                    let btnText = `${index + 1}. ${item.title}`;
                    if (btnText.length > 20) btnText = btnText.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.clk_sel ${storeId}`,
                        buttonText: { displayText: `🎬 ${btnText}` },
                        type: 1
                    });
                });

                listText += `───────────────────\n`;
                listText += `> *📩 පහල Button එකකින් ඔබට අවශ්‍ය එක තෝරන්න.*\n`;
                listText += `> *👑 SADEW-MINI BOT V3 👑*`;

                const firstPoster = items.find(it => it.img)?.img || null;
                const msgPayload = {
                    footer: botName,
                    buttons: buttons,
                    headerType: firstPoster ? 4 : 1
                };

                if (firstPoster) {
                    msgPayload.image = { url: firstPoster };
                    msgPayload.caption = listText;
                } else {
                    msgPayload.text = listText;
                }

                await socket.sendMessage(sender, msgPayload, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (err) {
                console.error("[CartoonLK Search Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Search කිරීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. SELECTION COMMAND (.clk_sel <storeId>)
        // ════════════════════════════════════════════════════════
        else if (command === "clk_sel") {
            const storeId = args[0];
            const cached = global.clkStore[storeId];
            if (!cached) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const details = await scrapeDetails(cached.url);
                const title = details.title || cached.title;
                const poster = details.poster || cached.img;

                // A. IF TV SERIES -> SHOW MANDATORY DOWNLOAD ALL BUTTON + EPISODE BUTTONS
                if (details.isSeries && details.episodes.length > 0) {
                    let epText = `*↳ ❝ [📺 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 📺] ¡! ❞*\n\n`;
                    epText += `🎬 *Title:* ${title}\n`;
                    epText += `📁 *Total Episodes:* ${details.episodes.length}\n`;
                    if (cached.targetJid) epText += `🎯 *Send To:* \`${cached.targetJid}\`\n`;
                    if (details.synopsis) epText += `\n📝 *Story:* _${details.synopsis}_\n`;
                    epText += `\n> *👇 ඔබට අවශ්‍ය Episode එක හෝ Download All තෝරන්න:* ⬇️`;

                    const buttons = [];

                    // 1️⃣ MANDATORY DOWNLOAD ALL BUTTON
                    const allStoreId = storeData({
                        postId: details.postId,
                        title: title,
                        poster: poster,
                        episodes: details.episodes,
                        nonce: details.nonce,
                        pageUrl: cached.url,
                        targetJid: cached.targetJid
                    });

                    buttons.push({
                        buttonId: `.clk_all ${allStoreId}`,
                        buttonText: { displayText: `📥 All (1-${details.episodes.length})` },
                        type: 1
                    });

                    // 2️⃣ ALL INDIVIDUAL EPISODES BUTTONS (NO ARTIFICIAL LIMIT)
                    details.episodes.forEach((ep, index) => {
                        const epNum = ep.number || (index + 1);
                        const epStoreId = storeData({
                            postId: details.postId,
                            title: `${title} - Episode ${epNum}`,
                            epIndex: index,
                            epNumber: epNum,
                            downloadLinks: ep.download_links || [],
                            fileSize: ep.file_size || '',
                            poster: poster,
                            nonce: details.nonce,
                            pageUrl: cached.url,
                            targetJid: cached.targetJid
                        });

                        const sizeSnippet = ep.file_size ? ` (${ep.file_size})` : '';
                        let btnLabel = `▶️ Ep ${epNum}${sizeSnippet}`;
                        if (btnLabel.length > 20) btnLabel = `▶️ Ep ${epNum}`;

                        buttons.push({
                            buttonId: `.clk_ep ${epStoreId}`,
                            buttonText: { displayText: btnLabel },
                            type: 1
                        });
                    });

                    const payload = {
                        footer: botName,
                        buttons: buttons,
                        headerType: poster ? 4 : 1
                    };
                    if (poster) {
                        payload.image = { url: poster };
                        payload.caption = epText;
                    } else {
                        payload.text = epText;
                    }

                    await socket.sendMessage(sender, payload, { quoted: metaQuote });
                    await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                    return;
                }

                // B. IF SINGLE MOVIE -> SHOW DIRECT DOWNLOAD BUTTONS
                if (!details.downloadQualities || details.downloadQualities.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම Cartoon එක සඳහා සෘජු Download Links හමු නොවිණි.*`);
                }

                let cardText = `*↳ ❝ [🎬 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n`;
                cardText += `🎬 *Title:* ${title}\n`;
                cardText += `⚡ *Server:* Cloudflare R2 High-Speed Worker\n`;
                if (cached.targetJid) cardText += `🎯 *Send To:* \`${cached.targetJid}\`\n`;
                if (details.synopsis) cardText += `\n📝 *Story:* _${details.synopsis}_\n`;
                cardText += `\n> *👇 බාගත කිරීමට පහත Button එක ක්ලික් කරන්න:* ⬇️`;

                const buttons = [];
                details.downloadQualities.forEach((dl, i) => {
                    const dlId = storeData({
                        title: title,
                        postId: dl.postId || details.postId,
                        linkIndex: dl.linkIndex || 0,
                        type: 'single',
                        nonce: details.nonce,
                        pageUrl: cached.url,
                        poster: poster,
                        targetJid: cached.targetJid
                    });

                    let label = dl.label || `Download HD`;
                    if (label.length > 20) label = label.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.clk_dl ${dlId}`,
                        buttonText: { displayText: `📥 ${label}` },
                        type: 1
                    });
                });

                const payload = {
                    footer: botName,
                    buttons: buttons,
                    headerType: poster ? 4 : 1
                };
                if (poster) {
                    payload.image = { url: poster };
                    payload.caption = cardText;
                } else {
                    payload.text = cardText;
                }

                await socket.sendMessage(sender, payload, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (err) {
                console.error("[CartoonLK Details Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *විස්තර ලබා ගැනීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. EPISODE QUALITY SELECTION (.clk_ep <epStoreId>)
        // ════════════════════════════════════════════════════════
        else if (command === "clk_ep") {
            const epStoreId = args[0];
            const cachedEp = global.clkStore[epStoreId];
            if (!cachedEp) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            try {
                let epCard = `*↳ ❝ [📺 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗘𝗣𝗜𝗦𝗢𝗗𝗘 📺] ¡! ❞*\n\n`;
                epCard += `🎬 *Episode:* ${cachedEp.title}\n`;
                if (cachedEp.fileSize) epCard += `📦 *Size:* ${cachedEp.fileSize}\n`;
                if (cachedEp.targetJid) epCard += `🎯 *Send To:* \`${cachedEp.targetJid}\`\n`;
                epCard += `\n> *👇 බාගත කිරීමට පහත Button එක ක්ලික් කරන්න:* ⬇️`;

                const buttons = [];
                const links = cachedEp.downloadLinks || [];

                if (links.length > 0) {
                    // Filter R2 links first, or show all available
                    links.forEach((l, idx) => {
                        const dlId = storeData({
                            title: cachedEp.title,
                            postId: cachedEp.postId,
                            episodeIndex: cachedEp.epIndex,
                            linkIndex: l.link_index !== undefined ? l.link_index : idx,
                            type: 'episode',
                            nonce: cachedEp.nonce,
                            pageUrl: cachedEp.pageUrl,
                            poster: cachedEp.poster,
                            targetJid: cachedEp.targetJid
                        });

                        let btnTxt = `📥 ${l.label || '720p'} (${l.provider || 'R2'})`;
                        if (btnTxt.length > 20) btnTxt = `📥 ${l.label || '720p'}`;

                        buttons.push({
                            buttonId: `.clk_dl ${dlId}`,
                            buttonText: { displayText: btnTxt },
                            type: 1
                        });
                    });
                } else {
                    // Default episode download
                    const dlId = storeData({
                        title: cachedEp.title,
                        postId: cachedEp.postId,
                        episodeIndex: cachedEp.epIndex,
                        linkIndex: 0,
                        type: 'episode',
                        nonce: cachedEp.nonce,
                        pageUrl: cachedEp.pageUrl,
                        poster: cachedEp.poster,
                        targetJid: cachedEp.targetJid
                    });

                    buttons.push({
                        buttonId: `.clk_dl ${dlId}`,
                        buttonText: { displayText: `📥 Download Episode` },
                        type: 1
                    });
                }

                const payload = {
                    footer: botName,
                    buttons: buttons,
                    headerType: cachedEp.poster ? 4 : 1
                };
                if (cachedEp.poster) {
                    payload.image = { url: cachedEp.poster };
                    payload.caption = epCard;
                } else {
                    payload.text = epCard;
                }

                await socket.sendMessage(sender, payload, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });

            } catch (err) {
                console.error("[CartoonLK Ep Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Episode විස්තර ලබා ගැනීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD ALL EPISODES (.clk_all <seriesStoreId>)
        // ════════════════════════════════════════════════════════
        else if (command === "clk_all") {
            const seriesStoreId = args[0];
            const cachedSeries = global.clkStore[seriesStoreId];
            if (!cachedSeries) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            const destJid = cachedSeries.targetJid || sender;
            const lockKey = `${sender}_clk_all`;

            if (global.clkAllLocks[lockKey]) {
                return reply("⚠️ *දැනටමත් ඔබගේ Download All Process එකක් ක්‍රියාත්මක වෙමින් පවතී. කරුණාකර එය අවසන් වනතුරු රැඳී සිටින්න.*");
            }
            global.clkAllLocks[lockKey] = true;

            const tempDir = getTempDir();
            const episodes = cachedSeries.episodes || [];

            try {
                // MANDATORY JID CARD: If target JID is specified, forward card with poster first!
                if (destJid !== sender) {
                    let fwdCard = `*↳ ❝ [📺 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 𝗦𝗛𝗔𝗥𝗘 📺] ¡! ❞*\n\n` +
                        `🎬 *Series:* ${cachedSeries.title}\n` +
                        `📁 *Total Episodes:* ${episodes.length}\n` +
                        `👤 *Requested By:* @${sender.split('@')[0]}\n` +
                        `⚡ *Status:* Episodes එකින් එක එවනු ලැබේ...\n\n` +
                        `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (cachedSeries.poster) {
                            await socket.sendMessage(destJid, { image: { url: cachedSeries.poster }, caption: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        }
                    } catch (_) {}
                }

                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });
                await reply(`⏳ *"${cachedSeries.title}" Series හි Episodes ${episodes.length} ම බාගත කිරීම ආරම්භ විය!*\n🎯 *Destination:* \`${destJid}\`\n\n_File ප්‍රමාණය අනුව ක්‍රියාවලිය සම්පූර්ණ වීමට සුළු වේලාවක් ගතවනු ඇත._`);

                for (let i = 0; i < episodes.length; i++) {
                    const ep = episodes[i];
                    const epNum = ep.number || (i + 1);
                    let tempFilePath = null;

                    try {
                        // Find R2 provider link index if available
                        let linkIdx = 0;
                        if (ep.download_links && ep.download_links.length > 0) {
                            const r2Idx = ep.download_links.findIndex(l => l.provider === 'r2');
                            if (r2Idx !== -1) linkIdx = r2Idx;
                        }

                        // Resolve stream link
                        const streamInfo = await resolveCartoonsStream({
                            pageUrl: cachedSeries.pageUrl,
                            postId: cachedSeries.postId,
                            nonce: cachedSeries.nonce,
                            type: 'episode',
                            episodeIndex: i,
                            linkIndex: linkIdx
                        });

                        if (!streamInfo || !streamInfo.url) {
                            throw new Error(`Episode ${epNum} සඳහා Download Link එකක් ලබාගත නොහැකි විය.`);
                        }

                        const maxBytes = 2 * 1024 * 1024 * 1024; // 2GB limit
                        // If file size exceeds 2GB -> notify user with direct link and continue!
                        if (streamInfo.size > maxBytes) {
                            const formattedOverSize = formatBytes(streamInfo.size);
                            const overLimitMsg = `⚠️ *Episode ${epNum} 2GB සීමාව ඉක්මවයි (${formattedOverSize})!*\n\n` +
                                `WhatsApp හරහා 2GB ට වැඩි files එවිය නොහැකි බැවින් මෙම Episode එක සෘජුව බාගත කිරීමට පහත Direct Link එක භාවිතා කරන්න:\n\n` +
                                `🔗 *Direct Download Link:*\n${streamInfo.url}\n\n` +
                                `⏭️ *ඊළඟ Episode එක වෙත මාරු වේ...*`;

                            await socket.sendMessage(destJid, { text: overLimitMsg }, { quoted: metaQuote });
                            if (destJid !== sender) {
                                await socket.sendMessage(sender, { text: overLimitMsg }, { quoted: metaQuote });
                            }
                            continue;
                        }

                        // Size <= 2GB: download stream to disk
                        const cleanEpTitle = `${cachedSeries.title} Episode ${epNum}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                        const randId = crypto.randomBytes(4).toString('hex');
                        const fileExt = '.mp4';
                        const outputFileName = `${cleanEpTitle} SADEW MINI${fileExt}`;
                        tempFilePath = path.join(tempDir, `clk_all_${randId}${fileExt}`);

                        const response = await axios({
                            method: 'GET',
                            url: streamInfo.url,
                            responseType: 'stream',
                            timeout: 60000,
                            headers: { 'User-Agent': USER_AGENT }
                        });

                        const writer = fs.createWriteStream(tempFilePath);
                        await pipeline(response.data, writer);

                        if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
                            throw new Error(`Episode ${epNum} බාගත කිරීම අසාර්ථක විය (Empty File).`);
                        }

                        const actualSizeBytes = fs.statSync(tempFilePath).size;
                        const formattedSize = formatBytes(actualSizeBytes);

                        const epCaption = `*↳ ❝ [📺 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗘𝗣𝗜𝗦𝗢𝗗𝗘 📺] ¡! ❞*\n\n` +
                            `🎬 *Series:* ${cachedSeries.title}\n` +
                            `▶️ *Episode:* ${epNum} / ${episodes.length}\n` +
                            `📦 *Size:* ${formattedSize}\n` +
                            `⚡ *Server:* Cloudflare R2 Worker\n\n` +
                            `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;

                        // Send WhatsApp Document Stream
                        await socket.sendMessage(destJid, {
                            document: { stream: fs.createReadStream(tempFilePath) },
                            mimetype: 'video/mp4',
                            fileName: outputFileName,
                            caption: epCaption
                        }, { quoted: metaQuote });

                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                            tempFilePath = null;
                        }

                        // Delay 3 seconds between episodes to prevent socket flood
                        await new Promise(r => setTimeout(r, 3000));

                    } catch (epErr) {
                        console.error(`[CartoonLK Ep ${epNum} Error]:`, epErr);
                        await socket.sendMessage(destJid, {
                            text: `⚠️ *Episode ${epNum} බාගත කිරීමේදී දෝෂයක් ඇතිවිය:* ${epErr.message}\n⏭️ *ඊළඟ Episode එක වෙත මාරු වේ...*`
                        }, { quoted: metaQuote });
                    } finally {
                        if (tempFilePath && fs.existsSync(tempFilePath)) {
                            try { fs.unlinkSync(tempFilePath); } catch (_) {}
                        }
                    }
                }

                await socket.sendMessage(sender, {
                    text: `✅ *"${cachedSeries.title}" හි සියලුම Episodes සාර්ථකව බාගත කර යවා අවසන් විය!*`
                }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (err) {
                console.error("[CartoonLK Download All Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Download All ක්‍රියාවලියේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            } finally {
                delete global.clkAllLocks[lockKey];
            }
        }

        // ════════════════════════════════════════════════════════
        // 5. DIRECT SINGLE DOWNLOAD & SEND (.clk_dl <dlStoreId>)
        // ════════════════════════════════════════════════════════
        else if (command === "clk_dl") {
            const dlId = args[0];
            const cachedDl = global.clkStore[dlId];
            if (!cachedDl) {
                return reply("❌ *Download link expired. කරුණාකර නැවත search කරන්න.*");
            }

            const destJid = cachedDl.targetJid || sender;
            const tempDir = getTempDir();
            let tempFilePath = null;

            try {
                // MANDATORY JID CARD: If target JID is specified, forward card with poster first!
                if (destJid !== sender) {
                    let fwdCard = `*↳ ❝ [🎬 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗠𝗢𝗩𝗜𝗘 𝗦𝗛𝗔𝗥𝗘 🎬] ¡! ❞*\n\n` +
                        `🎬 *Title:* ${cachedDl.title}\n` +
                        `👤 *Requested By:* @${sender.split('@')[0]}\n\n` +
                        `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (cachedDl.poster) {
                            await socket.sendMessage(destJid, { image: { url: cachedDl.poster }, caption: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        }
                    } catch (_) {}
                }

                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });
                await reply(`📥 *Direct Server එකෙන් Video Stream එක සොයමින් පවතී...*\n🎬 *${cachedDl.title}*\n\n_File ප්‍රමාණය අනුව යැවීමට මිනිත්තු කිහිපයක් ගතවිය හැක._`);

                // Resolve Cloudflare R2 worker stream
                const streamInfo = await resolveCartoonsStream({
                    pageUrl: cachedDl.pageUrl,
                    postId: cachedDl.postId,
                    nonce: cachedDl.nonce,
                    type: cachedDl.type || 'single',
                    episodeIndex: cachedDl.episodeIndex,
                    linkIndex: cachedDl.linkIndex || 0
                });

                if (!streamInfo || !streamInfo.url) {
                    throw new Error("Direct Download Link එක ලබා ගැනීමට නොහැකි විය.");
                }

                const finalSize = streamInfo.size || 0;
                if (finalSize > 2 * 1024 * 1024 * 1024) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම File එක 2GB සීමාව ඉක්මවයි (${formatBytes(finalSize)})!*\nWhatsApp හරහා 2GB ට වැඩි files එවිය නොහැකි බැවින් පහත Direct Link එකෙන් සෘජුව බාගත කරගන්න:\n\n🔗 *Direct Link:*\n${streamInfo.url}`);
                }

                const cleanTitleStr = cachedDl.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                const randId = crypto.randomBytes(4).toString('hex');
                const fileExt = '.mp4';
                const outputFileName = `${cleanTitleStr} SADEW MINI${fileExt}`;
                tempFilePath = path.join(tempDir, `clk_${randId}${fileExt}`);

                console.log(`[CartoonLK Stream] Downloading stream: ${streamInfo.url} to ${tempFilePath}`);

                // Stream directly to disk
                const response = await axios({
                    method: 'GET',
                    url: streamInfo.url,
                    responseType: 'stream',
                    timeout: 60000,
                    headers: { 'User-Agent': USER_AGENT }
                });

                const writer = fs.createWriteStream(tempFilePath);
                await pipeline(response.data, writer);

                if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
                    throw new Error("බාගත කළ File එක හිස් (Empty) හෝ බාගත කිරීමට නොහැකි විය.");
                }

                const actualSizeBytes = fs.statSync(tempFilePath).size;
                const formattedSize = formatBytes(actualSizeBytes);

                const dlCaption = `*↳ ❝ [🎬 𝗖𝗔𝗥𝗧𝗢𝗢𝗡𝗦.𝗟𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${cachedDl.title}\n` +
                    `📦 *Size:* ${formattedSize}\n` +
                    `⚡ *Server:* Cloudflare R2 Worker (Direct Stream)\n\n` +
                    `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗕𝗬 𝗦𝗔𝗗𝗘𝗪 𝗥𝗔𝗦𝗛𝗠𝗜𝗞𝗔 𝜗𝜚⋆*`;

                console.log(`[CartoonLK Stream] Sending document (${formattedSize}) to ${destJid}...`);

                // Send WhatsApp Document Stream
                await socket.sendMessage(destJid, {
                    document: { stream: fs.createReadStream(tempFilePath) },
                    mimetype: 'video/mp4',
                    fileName: outputFileName,
                    caption: dlCaption
                }, { quoted: metaQuote });

                if (destJid !== sender) {
                    await reply(`✅ *"${cachedDl.title}" සාර්ථකව \`${destJid}\` වෙත යවන ලදී!*`);
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (err) {
                console.error("[CartoonLK Download Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Download කිරීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            } finally {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                        console.log(`[CartoonLK Clean] Removed temp file: ${tempFilePath}`);
                    } catch (_) {}
                }
            }
        }
    }
};
