const os = require('os');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// ════════════════════════════════════════════════════════
// GLOBAL STORE FOR CINESUBZ (PURE NATIVE SCRAPER ENGINE)
// ════════════════════════════════════════════════════════
if (!global.czStore) global.czStore = {};
if (!global.czAllLocks) global.czAllLocks = {};

function genId() { 
    return crypto.randomBytes(4).toString('hex'); 
}

function storeData(data, ttlMs = 2 * 60 * 60 * 1000) { 
    const id = genId();
    global.czStore[id] = data;
    const t = setTimeout(() => { delete global.czStore[id]; }, ttlMs);
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

    // 4. Comma separated target (e.g. "avatar, 0771234567")
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

    // 5. Space separated raw 10-15 digit number at the end (e.g. "avatar 0771234567")
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

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return 'Unknown Size';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
}

function cleanTitle(str) {
    if (!str) return 'Untitled';
    return str
        .replace(/Sinhala Subtitles\s*\|\s*සිංහල උපසිරැසි සමඟ/gi, '')
        .replace(/\|\s*සිංහල උපසිරැසි සමඟ/gi, '')
        .replace(/\|.*$/i, '')
        .trim();
}

const KNOWN_SERVERS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "45"];
const CZ2_API = "https://cinesubz-api-cnw.vercel.app/api";

// Direct resolution from zt-links to wodocloud CDN high-speed stream
async function resolveDirectVideo(ztUrl) {
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const res = await axios.get(ztUrl, {
        headers: { 'User-Agent': UA, 'Referer': 'https://cinesubz.net/' },
        timeout: 20000
    });
    const html = res.data;
    const $ = cheerio.load(html);
    const linkHref = $('#link').attr('href') || $('a#link').attr('href') || $('a[href*="server"]').attr('href');
    const prevLnk = $('a.prev-lnk').attr('href');

    let cz2Promise = null;
    if (prevLnk && (prevLnk.includes('/movies/') || prevLnk.includes('/episodes/'))) {
        cz2Promise = axios.get(`${CZ2_API}/dl-links?url=${encodeURIComponent(prevLnk)}`, { timeout: 12000, headers: { 'User-Agent': UA } }).catch(() => null);
    }

    if (!linkHref) {
        if (cz2Promise) {
            const cz2Res = await cz2Promise;
            const links = cz2Res?.data?.downloadLinks || [];
            if (links.length > 0 && links[0].direct_mp4_url) {
                return { url: links[0].direct_mp4_url, size: 0, server: 'cz2', filename: path.basename(links[0].direct_mp4_url.split('?')[0]) };
            }
        }
        throw new Error("zt-links පිටුවෙන් Download Redirect Link එක සොයා ගැනීමට නොහැකි විය.");
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

    const serversToTry = [primaryServer, ...KNOWN_SERVERS.filter(s => s !== primaryServer)];

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
                        headers: { 'User-Agent': UA, 'Referer': 'https://cinesubz.net/', 'Range': 'bytes=0-100' },
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

    throw new Error("Direct WodoCloud CDN Servers වෙතින් Video Stream එක සොයා ගැනීමට නොහැකි විය.");
}

// Scrape search directly from cinesubz.net with multi-domain & fallback
async function scrapeSearchDirect(query) {
    if (!query || typeof query !== 'string') return [];
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
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
                    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
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
                    title = cleanTitle(title);

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
                        isTV
                    });
                });

                if (results.length > 0) return results;
            } catch (_) {}
        }
    }

    // Secondary fallback: CZ2 search API
    try {
        const cz2Res = await axios.get(`${CZ2_API}/search?q=${encodeURIComponent(cleanQ || query)}`, { timeout: 8000, headers: { 'User-Agent': UA } });
        const list = cz2Res.data?.data || cz2Res.data?.result || [];
        if (list.length > 0) {
            return list.slice(0, 15).map(mv => ({
                title: cleanTitle(mv.title || mv.name || 'Movie'),
                url: mv.url || mv.link,
                img: mv.img || mv.image || '',
                year: mv.year || mv.date || 'N/A',
                imdb: mv.imdb || 'N/A',
                isTV: Boolean(mv.isTV || (mv.url && mv.url.includes('/tvshows/')))
            }));
        }
    } catch (_) {}

    return [];
}

// Scrape detail page (Movie download qualities or TV episodes)
async function scrapeDetailPage(pageUrl) {
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': UA, 'Referer': 'https://cinesubz.net/' },
        timeout: 25000
    });
    const $ = cheerio.load(res.data);

    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    title = cleanTitle(title)
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

    // Check if TV series
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

    // Scrape quality download buttons
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

module.exports = {
    name: "cinesubz-downloader",
    category: 10,
    description: "Search and download Sinhala Subbed movies/shows directly from Cinesubz (Pure Native Direct Scraper)",
    commands: [
        "cinesubz", "cz", "cinesend",
        "cinesubz3", "cz3", "cinesend3",
        "cz_sel", "cz3_sel",
        "cz_ep", "cz3_ep",
        "cz_dl", "cz3_dl",
        "cz_all", "cz3_all"
    ],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";

        // Meta AI Quote
        const metaName = "Meta AI";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: metaName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${metaName};;;;\nFN:${metaName}\nORG:Meta Platforms\nTEL;type=CELL;type=VOICE;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH COMMANDS (.cinesubz, .cz, .cinesend)
        // ════════════════════════════════════════════════════════
        if (command === "cinesubz" || command === "cz" || command === "cinesend" || 
            command === "cinesubz3" || command === "cz3" || command === "cinesend3") {
            const fullText = args.join(" ").trim();
            if (!fullText) {
                return reply(
                    `🎬 *කරුණාකර Movie හෝ Series එකේ නම ලබා දෙන්න!*\n\n` +
                    `📌 *භාවිතය (Usage):*\n` +
                    `• *.cinesubz avatar* - Avatar search කිරීමට\n` +
                    `• *.cinesubz avatar 0771234567* - වෙනත් අංකයකට යැවීමට (කොමා නැතුව)\n` +
                    `• *.cinesubz avatar 120363xxx@g.us* - Group එකකට යැවීමට\n` +
                    `• *.cinesend avatar 0771234567* - සෘජුවම Send කිරීමට`
                );
            }

            let { query, targetJid } = parseTarget(fullText);

            // If user only passed targetJid, check if replying to a movie/series message
            if (!query && targetJid) {
                const quotedMsg = msg.quoted || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    const quotedText = quotedMsg.conversation || 
                                       quotedMsg.extendedTextMessage?.text || 
                                       quotedMsg.imageMessage?.caption || 
                                       quotedMsg.videoMessage?.caption || 
                                       '';
                    const mTitle = quotedText.match(/(?:Title|Series|Movie|චිත්‍රපටය|නම):\s*([^\n\r]+)/i);
                    if (mTitle) query = cleanTitle(mTitle[1]);
                }
            }

            if ((command === "cinesend" || command === "cinesend3") && !targetJid) {
                return reply("❌ *කරුණාකර අංකයක් හෝ Group JID එකක් ලබාදෙන්න!*\n_උදා: .cinesend avatar 0771234567_\n_හෝ: .cinesend avatar 120363xxx@g.us_");
            }
            if (!query) return reply("🎬 *කරුණාකර Movie හෝ Series එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const results = await scrapeSearchDirect(query);
                if (!results || results.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply(`❌ *"${query}" සඳහා කිසිදු ප්‍රතිඵලයක් Cinesubz වෙතින් හමු නොවීය.*`);
                }

                // Show top 15 results with 15 buttons
                const topResults = results.slice(0, 15);
                let listText = `*↳ ❝ [🎬 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗦𝗘𝗔𝗥𝗖𝗛 🎬] ¡! ❞*\n\n`;
                listText += `🔍 *Search:* ${query}\n`;
                listText += `📊 *Results:* ${topResults.length} / ${results.length}\n`;
                if (targetJid) listText += `🎯 *Send To:* \`${targetJid}\`\n`;
                listText += `⚡ *Mode:* 100% Pure Native Direct Scraper\n\n`;

                const buttons = [];
                topResults.forEach((item, index) => {
                    const tag = item.isTV ? '📺 [TV Series]' : '🎬 [Movie]';
                    listText += `*${index + 1}.* ${item.title}\n`;
                    listText += `   ↳ 🏷️ ${tag} | ⭐ IMDb: ${item.imdb} | 📅 ${item.year}\n\n`;

                    const storeId = storeData({
                        url: item.url,
                        title: item.title,
                        isTV: item.isTV,
                        img: item.img,
                        targetJid: targetJid
                    });

                    let btnText = `${index + 1}. ${item.title}`;
                    if (btnText.length > 20) btnText = btnText.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.cz_sel ${storeId}`,
                        buttonText: { displayText: `🎬 ${btnText}` },
                        type: 1
                    });
                });

                listText += `───────────────────\n`;
                listText += `> *📩 පහල Button එකකින් ඔබට අවශ්‍ය චිත්‍රපටය තෝරන්න.*\n`;
                listText += `> *👑 SADEW-MINI BOT V3 👑*`;

                const firstPoster = topResults[0]?.img || null;
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
                console.error("[CineSubz Search Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Search කිරීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. SELECTION COMMAND (.cz_sel <storeId>, .cz3_sel)
        // ════════════════════════════════════════════════════════
        else if (command === "cz_sel" || command === "cz3_sel") {
            const storeId = args[0];
            const cached = global.czStore[storeId];
            if (!cached) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const details = await scrapeDetailPage(cached.url);
                const title = details.title || cached.title;
                const poster = details.poster || cached.img;

                // A. IF TV SERIES -> SHOW 3 DOWNLOAD ALL BUTTONS (480p, 720p, 1080p) + ALL EPISODES
                if (details.isTV && details.episodes.length > 0) {
                    let epText = `*↳ ❝ [📺 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 📺] ¡! ❞*\n\n`;
                    epText += `🎬 *Title:* ${title}\n`;
                    epText += `📁 *Total Episodes:* ${details.episodes.length}\n`;
                    if (cached.targetJid) epText += `🎯 *Send To:* \`${cached.targetJid}\`\n`;
                    if (details.synopsis) epText += `\n📝 *Story:* _${details.synopsis}_\n`;
                    epText += `\n> *👇 Download All Quality එකක් හෝ අවශ්‍ය Episode එක තෝරන්න:* ⬇️`;

                    const buttons = [];

                    // 1️⃣ TOP 3 BUTTONS: DOWNLOAD ALL (480p, 720p, 1080p)
                    const allStoreId = storeData({
                        title: title,
                        poster: poster,
                        synopsis: details.synopsis,
                        episodes: details.episodes,
                        targetJid: cached.targetJid
                    });

                    buttons.push({
                        buttonId: `.cz_all ${allStoreId} 480p`,
                        buttonText: { displayText: `📥 All 480p` },
                        type: 1
                    });
                    buttons.push({
                        buttonId: `.cz_all ${allStoreId} 720p`,
                        buttonText: { displayText: `📥 All 720p` },
                        type: 1
                    });
                    buttons.push({
                        buttonId: `.cz_all ${allStoreId} 1080p`,
                        buttonText: { displayText: `📥 All 1080p` },
                        type: 1
                    });

                    // 2️⃣ ALL INDIVIDUAL EPISODES (NO BUTTON LIMIT)
                    details.episodes.forEach((ep, i) => {
                        const epStoreId = storeData({
                            title: `${title} - ${ep.title}`,
                            epUrl: ep.href,
                            poster: poster,
                            synopsis: details.synopsis,
                            targetJid: cached.targetJid
                        });

                        let epBtnLabel = ep.title;
                        if (epBtnLabel.length > 20) epBtnLabel = epBtnLabel.slice(0, 18) + '..';

                        buttons.push({
                            buttonId: `.cz_ep ${epStoreId}`,
                            buttonText: { displayText: `▶️ ${epBtnLabel}` },
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

                // B. IF MOVIE -> SHOW QUALITY BUTTONS (480p, 720p, 1080p)
                if (!details.downloadQualities || details.downloadQualities.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම චිත්‍රපටය සඳහා සෘජු Download Links හමු නොවිණි.*`);
                }

                let cardText = `*↳ ❝ [🎬 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n`;
                cardText += `🎬 *Title:* ${title}\n`;
                cardText += `🎞️ *Available Qualities:* ${details.downloadQualities.map(q => q.quality).join(', ')}\n`;
                if (cached.targetJid) cardText += `🎯 *Send To:* \`${cached.targetJid}\`\n`;
                if (details.synopsis) cardText += `\n📝 *Story:* _${details.synopsis}_\n`;
                cardText += `\n> *👇 බාගත කිරීමට අවශ්‍ය Quality එක පහලින් තෝරන්න:* ⬇️`;

                const buttons = [];
                details.downloadQualities.forEach((dl) => {
                    const dlId = storeData({
                        title: title,
                        quality: dl.quality,
                        size: dl.size,
                        type: dl.type,
                        ztUrl: dl.ztUrl,
                        poster: poster,
                        synopsis: details.synopsis,
                        targetJid: cached.targetJid
                    });

                    buttons.push({
                        buttonId: `.cz_dl ${dlId}`,
                        buttonText: { displayText: `${dl.label.slice(0, 20)}` },
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
                console.error("[CineSubz Details Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *විස්තර ලබා ගැනීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. EPISODE QUALITY SELECTION (.cz_ep <epStoreId>, .cz3_ep)
        // ════════════════════════════════════════════════════════
        else if (command === "cz_ep" || command === "cz3_ep") {
            const epStoreId = args[0];
            const cachedEp = global.czStore[epStoreId];
            if (!cachedEp) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const details = await scrapeDetailPage(cachedEp.epUrl);
                if (!details.downloadQualities || details.downloadQualities.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම Episode එක සඳහා සෘජු Download Links හමු නොවිණි.*`);
                }

                let epCard = `*↳ ❝ [📺 𝗘𝗣𝗜𝗦𝗢𝗗𝗘 𝗤𝗨𝗔𝗟𝗜𝗧𝗜𝗘𝗦 📺] ¡! ❞*\n\n`;
                epCard += `🎬 *Episode:* ${cachedEp.title}\n`;
                epCard += `🎞️ *Qualities:* ${details.downloadQualities.map(q => q.quality).join(', ')}\n`;
                if (cachedEp.targetJid) epCard += `🎯 *Send To:* \`${cachedEp.targetJid}\`\n`;
                if (cachedEp.synopsis) epCard += `\n📝 *Story:* _${cachedEp.synopsis}_\n`;
                epCard += `\n> *👇 බාගත කිරීමට අවශ්‍ය Quality එක තෝරන්න:* ⬇️`;

                const buttons = [];
                details.downloadQualities.forEach((dl) => {
                    const dlId = storeData({
                        title: cachedEp.title,
                        quality: dl.quality,
                        size: dl.size,
                        type: dl.type,
                        ztUrl: dl.ztUrl,
                        poster: cachedEp.poster,
                        synopsis: cachedEp.synopsis,
                        targetJid: cachedEp.targetJid
                    });

                    buttons.push({
                        buttonId: `.cz_dl ${dlId}`,
                        buttonText: { displayText: `${dl.label.slice(0, 20)}` },
                        type: 1
                    });
                });

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
                console.error("[CineSubz Ep Details Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Episode විස්තර ලබා ගැනීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD ALL EPISODES BY QUALITY (.cz_all, .cz3_all)
        // ════════════════════════════════════════════════════════
        else if (command === "cz_all" || command === "cz3_all") {
            const allStoreId = args[0];
            const targetQuality = (args[1] || '720p').toLowerCase(); // '480p' | '720p' | '1080p'
            const cachedSeries = global.czStore[allStoreId];
            if (!cachedSeries) {
                return reply("❌ *Session expired. කරුණාකර නැවත search කරන්න.*");
            }

            const destJid = cachedSeries.targetJid || sender;
            const lockKey = `${sender}_cz_all`;

            if (global.czAllLocks && global.czAllLocks[lockKey]) {
                return reply("⚠️ *දැනටමත් ඔබගේ Download All Process එකක් ක්‍රියාත්මක වෙමින් පවතී. කරුණාකර එය අවසන් වනතුරු රැඳී සිටින්න.*");
            }
            if (!global.czAllLocks) global.czAllLocks = {};
            global.czAllLocks[lockKey] = true;

            const tempDir = getTempDir();
            const episodes = cachedSeries.episodes || [];

            try {
                // MANDATORY JID DETAILS CARD: Forward rich details card with poster first!
                if (destJid !== sender) {
                    let fwdCard = `*↳ ❝ [📺 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 𝗦𝗛𝗔𝗥𝗘 📺] ¡! ❞*\n\n` +
                        `🎬 *Series:* ${cachedSeries.title}\n` +
                        `📁 *Total Episodes:* ${episodes.length}\n` +
                        `🎞️ *Selected Quality:* ${targetQuality.toUpperCase()}\n` +
                        `👤 *Requested By:* @${sender.split('@')[0]}\n`;
                    if (cachedSeries.synopsis) {
                        fwdCard += `\n📝 *Story:* _${cachedSeries.synopsis}_\n`;
                    }
                    fwdCard += `\n⚡ *Status:* Episodes එකින් එක එවනු ලැබේ...\n\n` +
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
                await reply(`⏳ *"${cachedSeries.title}" Series හි Episodes ${episodes.length} ම (${targetQuality.toUpperCase()}) බාගත කිරීම ආරම්භ විය!*\n🎯 *Destination:* \`${destJid}\`\n\n_File ප්‍රමාණය අනුව ක්‍රියාවලිය සම්පූර්ණ වීමට සුළු වේලාවක් ගතවනු ඇත._`);

                for (let i = 0; i < episodes.length; i++) {
                    const ep = episodes[i];
                    let tempFilePath = null;

                    try {
                        // 1. Scrape episode page to find download qualities
                        const epDetails = await scrapeDetailPage(ep.href);
                        if (!epDetails.downloadQualities || epDetails.downloadQualities.length === 0) {
                            await socket.sendMessage(destJid, {
                                text: `⚠️ *${ep.title} සඳහා Download Links හමු නොවීය.*\n⏭️ *ඊළඟ Episode එක වෙත මාරු වේ...*`
                            }, { quoted: metaQuote });
                            continue;
                        }

                        // 2. Find target quality, or fallback to closest available
                        let chosenDl = epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes(targetQuality));
                        if (!chosenDl) {
                            chosenDl = epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('720p')) ||
                                       epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('480p')) ||
                                       epDetails.downloadQualities.find(q => q.quality.toLowerCase().includes('1080p')) ||
                                       epDetails.downloadQualities[0];
                        }

                        // 3. Resolve direct supercloud CDN stream
                        const streamInfo = await resolveDirectVideo(chosenDl.ztUrl);
                        if (!streamInfo || !streamInfo.url) {
                            throw new Error(`${ep.title} සඳහා SuperCloud Direct Link එකක් ලබාගත නොහැකි විය.`);
                        }

                        const maxBytes = 2 * 1024 * 1024 * 1024; // 2GB
                        if (streamInfo.size > maxBytes) {
                            const formattedOverSize = formatBytes(streamInfo.size);
                            const overLimitMsg = `⚠️ *${ep.title} (${chosenDl.quality}) 2GB සීමාව ඉක්මවයි (${formattedOverSize})!*\n\n` +
                                `WhatsApp හරහා 2GB ට වැඩි files එවිය නොහැකි බැවින් මෙම Episode එක සෘජුව බාගත කිරීමට පහත Direct Link එක භාවිතා කරන්න:\n\n` +
                                `🔗 *Direct Download Link:*\n${streamInfo.url}\n\n` +
                                `⏭️ *ඊළඟ Episode එක වෙත මාරු වේ...*`;

                            await socket.sendMessage(destJid, { text: overLimitMsg }, { quoted: metaQuote });
                            if (destJid !== sender) {
                                await socket.sendMessage(sender, { text: overLimitMsg }, { quoted: metaQuote });
                            }
                            continue;
                        }

                        // 4. Stream directly to disk
                        const cleanEpTitle = `${cachedSeries.title} - ${ep.title}`.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                        const randId = crypto.randomBytes(4).toString('hex');
                        const fileExt = streamInfo.filename.endsWith('.mkv') ? '.mkv' : '.mp4';
                        const outputFileName = `${cleanEpTitle} (${chosenDl.quality}) SADEW MINI${fileExt}`;
                        tempFilePath = path.join(tempDir, `cz_all_${randId}${fileExt}`);

                        const response = await axios({
                            method: 'GET',
                            url: streamInfo.url,
                            responseType: 'stream',
                            timeout: 60000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });

                        const writer = fs.createWriteStream(tempFilePath);
                        await pipeline(response.data, writer);

                        if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
                            throw new Error(`${ep.title} බාගත කිරීම අසාර්ථක විය (Empty File).`);
                        }

                        const actualSizeBytes = fs.statSync(tempFilePath).size;
                        const formattedSize = formatBytes(actualSizeBytes);

                        const epCaption = `*↳ ❝ [📺 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗘𝗣𝗜𝗦𝗢𝗗𝗘 📺] ¡! ❞*\n\n` +
                            `🎬 *Series:* ${cachedSeries.title}\n` +
                            `▶️ *Episode:* ${ep.title}\n` +
                            `🎞️ *Quality:* ${chosenDl.quality}\n` +
                            `📦 *Size:* ${formattedSize}\n` +
                            `⚡ *Node:* Server ${streamInfo.server} (SuperCloud CDN)\n\n` +
                            `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;

                        // Send WhatsApp Document Stream
                        await socket.sendMessage(destJid, {
                            document: { stream: fs.createReadStream(tempFilePath) },
                            mimetype: fileExt === '.mp4' ? 'video/mp4' : 'video/x-matroska',
                            fileName: outputFileName,
                            caption: epCaption
                        }, { quoted: metaQuote });

                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                            tempFilePath = null;
                        }

                        // Delay 3 seconds between episodes
                        await new Promise(r => setTimeout(r, 3000));

                    } catch (epErr) {
                        console.error(`[CineSubz Ep Error]:`, epErr);
                        await socket.sendMessage(destJid, {
                            text: `⚠️ *${ep.title} බාගත කිරීමේදී දෝෂයක් ඇතිවිය:* ${epErr.message}\n⏭️ *ඊළඟ Episode එක වෙත මාරු වේ...*`
                        }, { quoted: metaQuote });
                    } finally {
                        if (tempFilePath && fs.existsSync(tempFilePath)) {
                            try { fs.unlinkSync(tempFilePath); } catch (_) {}
                        }
                    }
                }

                await socket.sendMessage(sender, {
                    text: `✅ *"${cachedSeries.title}" (${targetQuality.toUpperCase()}) සියලුම Episodes සාර්ථකව බාගත කර යවා අවසන් විය!*`
                }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (err) {
                console.error("[CineSubz Download All Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Download All ක්‍රියාවලියේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            } finally {
                delete global.czAllLocks[lockKey];
            }
        }

        // ════════════════════════════════════════════════════════
        // 5. DIRECT SINGLE DOWNLOAD & SEND (.cz_dl, .cz3_dl)
        // ════════════════════════════════════════════════════════
        else if (command === "cz_dl" || command === "cz3_dl") {
            const dlId = args[0];
            const cachedDl = global.czStore[dlId];
            if (!cachedDl) {
                return reply("❌ *Download link expired. කරුණාකර නැවත search කරන්න.*");
            }

            const destJid = cachedDl.targetJid || sender;
            const tempDir = getTempDir();
            let tempFilePath = null;

            try {
                // MANDATORY JID DETAILS CARD: Forward card with poster first!
                if (destJid !== sender) {
                    let fwdCard = `*↳ ❝ [🎬 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗠𝗢𝗩𝗜𝗘 𝗦𝗛𝗔𝗥𝗘 🎬] ¡! ❞*\n\n` +
                        `🎬 *Title:* ${cachedDl.title}\n` +
                        `🎞️ *Quality:* ${cachedDl.quality}\n` +
                        `📦 *Size:* ${cachedDl.size}\n` +
                        `👤 *Requested By:* @${sender.split('@')[0]}\n`;
                    if (cachedDl.synopsis) {
                        fwdCard += `\n📝 *Story:* _${cachedDl.synopsis}_\n`;
                    }
                    fwdCard += `\n> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (cachedDl.poster) {
                            await socket.sendMessage(destJid, { image: { url: cachedDl.poster }, caption: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: fwdCard, mentions: [sender] }, { quoted: metaQuote });
                        }
                    } catch (_) {}
                }

                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });
                await reply(`📥 *Direct Server එකෙන් Video Stream එක සොයමින් පවතී...*\n🎬 *${cachedDl.title}* (${cachedDl.quality})\n\n_File ප්‍රමාණය අනුව යැවීමට මිනිත්තු කිහිපයක් ගතවිය හැක._`);

                // Resolve direct supercloud CDN stream
                const streamInfo = await resolveDirectVideo(cachedDl.ztUrl);
                if (!streamInfo || !streamInfo.url) {
                    throw new Error("Direct Download Link එක ලබා ගැනීමට නොහැකි විය.");
                }

                const finalSize = streamInfo.size || 0;
                if (finalSize > 2 * 1024 * 1024 * 1024) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම File එක 2GB සීමාව ඉක්මවයි (${formatBytes(finalSize)})!*\nWhatsApp හරහා 2GB ට වැඩි files එවිය නොහැකි බැවින් පහත සෘජු Direct Link එකෙන් බාගත කරගන්න:\n\n🔗 *Direct Link:*\n${streamInfo.url}`);
                }

                const cleanTitle = cachedDl.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                const randId = crypto.randomBytes(4).toString('hex');
                const fileExt = streamInfo.filename.endsWith('.mkv') ? '.mkv' : '.mp4';
                const outputFileName = `${cleanTitle} (${cachedDl.quality}) SADEW MINI${fileExt}`;
                tempFilePath = path.join(tempDir, `cz_${randId}${fileExt}`);

                console.log(`[CineSubz Stream] Downloading from node ${streamInfo.server}: ${streamInfo.url} to ${tempFilePath}`);

                // Stream directly to disk
                const response = await axios({
                    method: 'GET',
                    url: streamInfo.url,
                    responseType: 'stream',
                    timeout: 60000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                const writer = fs.createWriteStream(tempFilePath);
                await pipeline(response.data, writer);

                if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
                    throw new Error("බාගත කළ File එක හිස් (Empty) හෝ බාගත කිරීමට නොහැකි විය.");
                }

                const actualSizeBytes = fs.statSync(tempFilePath).size;
                const formattedSize = formatBytes(actualSizeBytes);

                const dlCaption = `*↳ ❝ [🎬 𝗖𝗜𝗡𝗘𝗦𝗨𝗕𝗭 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${cachedDl.title}\n` +
                    `🎞️ *Quality:* ${cachedDl.quality}\n` +
                    `📦 *Size:* ${formattedSize}\n` +
                    `⚡ *Node:* Server ${streamInfo.server} (SuperCloud CDN)\n\n` +
                    `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗕𝗬 𝗦𝗔𝗗𝗘𝗪 𝗥𝗔𝗦𝗛𝗠𝗜𝗞𝗔 𝜗𝜚⋆*`;

                console.log(`[CineSubz Stream] Sending document (${formattedSize}) to ${destJid}...`);

                // Send WhatsApp Document Stream
                await socket.sendMessage(destJid, {
                    document: { stream: fs.createReadStream(tempFilePath) },
                    mimetype: fileExt === '.mp4' ? 'video/mp4' : 'video/x-matroska',
                    fileName: outputFileName,
                    caption: dlCaption
                }, { quoted: metaQuote });

                if (destJid !== sender) {
                    await reply(`✅ *"${cachedDl.title}" සාර්ථකව \`${destJid}\` වෙත යවන ලදී!*`);
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (err) {
                console.error("[CineSubz Download Error]:", err);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Download කිරීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            } finally {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                        console.log(`[CineSubz Clean] Removed temp file: ${tempFilePath}`);
                    } catch (_) {}
                }
            }
        }
    }
};
