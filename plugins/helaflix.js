const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

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

let isHelaDlAllRunning = false;

// ════════════════════════════════════════════════════════
// GLOBAL CACHES & STATE
// ════════════════════════════════════════════════════════
if (!global.helaflixCache) global.helaflixCache = {};
if (!global.helaflixStore) global.helaflixStore = {};
const attachedSockets = new WeakSet();

let downloadFeedCache = null;
let downloadCacheTime = 0;

const BOT_NAME = "👑 SADEW-MINI 👑";
const BOT_TAG = "🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆";

// Aesthetic movie wallpapers for search cards
const BANNER_IMAGES = [
    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790344904/ChatGPT_Image_Sep_25_2026_07_28_02_PM_tk3oxd.png",
    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790345148/ChatGPT_Image_Sep_25_2026_07_32_04_PM_grtzqp.png",
    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790345308/ChatGPT_Image_Sep_25_2026_07_36_29_PM_t4htf2.png"
];

function getRandomBanner() {
    return BANNER_IMAGES[Math.floor(Math.random() * BANNER_IMAGES.length)];
}

// ════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════

function cleanJid(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0] + (jid.includes('@g.us') ? '@g.us' : '@s.whatsapp.net');
}

function parseTargetJid(fullText) {
    if (!fullText) return { query: '', targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    const endMatch = raw.match(/(?:,|\s)+([0-9\-]+@g\.us|[0-9]+@s\.whatsapp\.net|\+?94[0-9]{9}|0[0-9]{9})$/i);
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
    } else if (raw.includes(',')) {
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

function extractGdriveFileId(url) {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                  url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    return null;
}

function cleanHtmlTags(str) {
    if (!str) return '';
    return str
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeUrl(u) {
    if (!u) return '';
    return u.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ════════════════════════════════════════════════════════
// BLOGGER FEED SCRAPERS & RESOLVER
// ════════════════════════════════════════════════════════

async function getDownloadFeed() {
    const now = Date.now();
    if (downloadFeedCache && (now - downloadCacheTime) < 10 * 60 * 1000) {
        return downloadFeedCache;
    }
    try {
        const res = await axios.get('https://helaflixdownload.blogspot.com/feeds/posts/default?alt=json&max-results=100', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000
        });
        downloadFeedCache = res.data.feed?.entry || [];
        downloadCacheTime = now;
        return downloadFeedCache;
    } catch (e) {
        console.error('[HelaFlix] Failed to cache download feed:', e.message);
        return downloadFeedCache || [];
    }
}

// Universal Resolver for HelaFlix downloads (GDrive, Workers, Telegram, Mega)
async function resolveUniversalDownload(bridgeUrl) {
    if (!bridgeUrl) return null;
    try {
        const entries = await getDownloadFeed();
        const targetNorm = normalizeUrl(bridgeUrl);
        const slug = bridgeUrl.split('/').pop().replace('.html', '').toLowerCase();

        // 1. Try exact alternate URL match
        let matchedEntry = entries.find(e => {
            const altHref = e.link?.find(l => l.rel === 'alternate')?.href;
            return altHref && normalizeUrl(altHref) === targetNorm;
        });

        // 2. Try slug match in alternate URL
        if (!matchedEntry) {
            matchedEntry = entries.find(e => {
                const altHref = e.link?.find(l => l.rel === 'alternate')?.href || '';
                return altHref.toLowerCase().includes(`/${slug}.html`) || altHref.toLowerCase().endsWith(`/${slug}`);
            });
        }

        // 3. Fallback to slug in title match
        if (!matchedEntry) {
            matchedEntry = entries.find(e => {
                const t = e.title?.$t?.toLowerCase() || '';
                return t.includes(slug.replace(/-/g, ' '));
            });
        }

        // 4. Live fetch fallback if not in cached feed
        let content = '';
        let entryTitle = '';
        if (matchedEntry) {
            content = matchedEntry.content ? matchedEntry.content.$t : '';
            entryTitle = matchedEntry.title?.$t || '';
        } else {
            const liveRes = await axios.get(`https://helaflixdownload.blogspot.com/feeds/posts/default?alt=json&q=${encodeURIComponent(slug)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 10000
            });
            const liveEntries = liveRes.data.feed?.entry || [];
            if (liveEntries.length > 0) {
                content = liveEntries[0].content?.$t || '';
                entryTitle = liveEntries[0].title?.$t || '';
            }
        }

        if (!content) return null;

        // A. Check REAL_TARGET_URL or REAL_DOWNLOAD_FILE_LINK
        const mTarget = content.match(/REAL_TARGET_URL\s*=\s*[\'\"]([^\'\"]+)[\'\"]/i);
        const mReal = content.match(/REAL_DOWNLOAD_FILE_LINK\s*=\s*[\'\"]([^\'\"]+)[\'\"]/i);
        const linkStr = (mReal ? mReal[1] : '') + ' ' + (mTarget ? mTarget[1] : '');

        // B. Check for Google Drive ID in watch.html or direct link
        const idMatch = linkStr.match(/[?&]id=([a-zA-Z0-9_-]{25,})/) ||
                        content.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
        if (idMatch) {
            return {
                type: 'gdrive',
                downloadUrl: `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&authuser=0`,
                movieTitle: entryTitle
            };
        }

        // C. Check if REAL_DOWNLOAD_FILE_LINK is a direct video/stream url (e.g. workers.dev in Luca or Google Drive)
        if (mReal && mReal[1] && !mReal[1].includes('REAL_MOVIE_DOWNLOAD_LINK_HERE')) {
            const url = mReal[1].trim();
            if (url.includes('drive.usercontent.google.com') || url.includes('drive.google.com')) {
                return { type: 'gdrive', downloadUrl: url, movieTitle: entryTitle };
            }
            if (url.includes('workers.dev') || url.endsWith('.mp4') || url.endsWith('.mkv')) {
                return { type: 'direct', downloadUrl: url, movieTitle: entryTitle };
            }
            if (url.includes('t.me')) {
                return { type: 'telegram', downloadUrl: url, movieTitle: entryTitle };
            }
            if (url.includes('mega.nz')) {
                return { type: 'mega', downloadUrl: url, movieTitle: entryTitle };
            }
        }

        // D. Direct regex matches in content
        const driveMatch = content.match(/https:\/\/(?:drive\.usercontent\.google\.com|drive\.google\.com)\/[^\s\'\"<>]+/i);
        if (driveMatch) return { type: 'gdrive', downloadUrl: driveMatch[0], movieTitle: entryTitle };

        const workerMatch = content.match(/https:\/\/[a-zA-Z0-9_-]+\.workers\.dev\/[^\s\'\"<>]+/i);
        if (workerMatch) return { type: 'direct', downloadUrl: workerMatch[0], movieTitle: entryTitle };

        const tgMatch = content.match(/https:\/\/t\.me\/[^\s\'\"<>]+/i);
        if (tgMatch) return { type: 'telegram', downloadUrl: tgMatch[0], movieTitle: entryTitle };

        const megaMatch = content.match(/https:\/\/mega\.nz\/[^\s\'\"<>]+/i);
        if (megaMatch) return { type: 'mega', downloadUrl: megaMatch[0], movieTitle: entryTitle };

        return null;
    } catch (err) {
        console.error('[HelaFlix] resolveUniversalDownload error:', err.message);
        return null;
    }
}

// Scraper: Search or Fetch all posts from HelaFlix
async function getHelaflixPosts(query) {
    const cleanQuery = (query || '').trim();
    let url;
    if (cleanQuery && cleanQuery.toLowerCase() !== 'all') {
        url = `https://helaflix.blogspot.com/feeds/posts/default?alt=json&q=${encodeURIComponent(cleanQuery)}&max-results=15`;
    } else {
        url = `https://helaflix.blogspot.com/feeds/posts/default?alt=json&max-results=50`;
    }

    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000
        });

        let entries = res.data.feed?.entry || [];

        // Fallback search across all posts if query yielded 0 results
        if (entries.length === 0 && cleanQuery && cleanQuery.toLowerCase() !== 'all') {
            const fallbackRes = await axios.get('https://helaflix.blogspot.com/feeds/posts/default?alt=json&max-results=50', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 15000
            });
            const allEntries = fallbackRes.data.feed?.entry || [];
            const qLower = cleanQuery.toLowerCase();
            entries = allEntries.filter(e => {
                const t = (e.title?.$t || '').toLowerCase();
                const c = (e.content?.$t || '').toLowerCase();
                return t.includes(qLower) || c.includes(qLower);
            });
        }

        const results = [];
        for (const entry of entries) {
            const rawTitle = entry.title?.$t || 'Untitled Movie';
            const content = entry.content?.$t || '';
            const categories = (entry.category || []).map(c => c.term).filter(Boolean);
            const $ = cheerio.load(content);

            // 1. Extract Episodes (TV Series)
            const episodes = [];
            $('.ep-row').each((i, el) => {
                const epTitle = $(el).find('.ep-title').text().trim() || `Episode ${i + 1}`;
                const epDuration = $(el).find('.ep-duration').text().trim();
                const btn = $(el).find('a.btn-ep-single, a');
                const href = btn.attr('href');
                const btnText = btn.text().replace(/\s+/g, ' ').trim();
                if (href && href.includes('helaflixdownload.blogspot.com')) {
                    episodes.push({
                        title: epTitle,
                        duration: epDuration,
                        url: href,
                        qualityText: btnText
                    });
                }
            });

            // 2. Extract Cloud Downloads (Movie servers/qualities)
            const cloudDownloads = [];
            $('a.btn-cloud-dl, a').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().replace(/\s+/g, ' ').trim();
                const cls = $(el).attr('class') || '';
                if (href && href.includes('helaflixdownload.blogspot.com') && !episodes.some(ep => ep.url === href)) {
                    let type = 'direct';
                    if (cls.includes('btn-drive') || text.toLowerCase().includes('drive') || href.toLowerCase().includes('drive')) {
                        type = 'drive';
                    } else if (cls.includes('btn-tg') || text.toLowerCase().includes('telegram') || href.toLowerCase().includes('telegram')) {
                        type = 'telegram';
                    } else if (cls.includes('btn-mega') || text.toLowerCase().includes('mega') || href.toLowerCase().includes('mega')) {
                        type = 'mega';
                    }
                    cloudDownloads.push({
                        url: href,
                        text: text || 'Download',
                        type: type
                    });
                }
            });

            // Prioritize Google Drive (put drive first!)
            cloudDownloads.sort((a, b) => (a.type === 'drive' ? -1 : (b.type === 'drive' ? 1 : 0)));

            // Extract high-res thumbnail
            let thumb = null;
            if (entry.media$thumbnail && entry.media$thumbnail.url) {
                thumb = entry.media$thumbnail.url.replace(/\/s72-c\//, '/s1600/').replace(/\/w72-h72-p-k-no-nu\//, '/s1600/');
            }
            if (!thumb) {
                const posterImg = $('.cine-poster-box img, img').first().attr('src');
                if (posterImg) thumb = posterImg;
            }
            if (!thumb) thumb = getRandomBanner();

            // Extract clean story summary
            const snippet = cleanHtmlTags($('.cine-specs-card, .cine-post-wrap p, p').first().text() || content).slice(0, 200);

            // Categorize into user groups
            const isSeries = episodes.length > 0 || categories.some(c => c.toLowerCase().includes('series') || c.toLowerCase().includes('tv'));
            const isCartoon = categories.some(c => c.toLowerCase().includes('cartoon'));
            const isSinhala = categories.some(c => c.toLowerCase().includes('sinhala film') || c.toLowerCase().includes('sinhala movies'));
            const isShort = categories.some(c => c.toLowerCase().includes('short'));

            let catGroup = '🌍 Dubbed Movies (හඬකැවූ චිත්‍රපට)';
            if (isShort) catGroup = '🎞️ Short Films (කෙටි චිත්‍රපට)';
            else if (isSeries) catGroup = '📺 TV Series (කතා මාලා)';
            else if (isCartoon) catGroup = '🧸 Cartoons & Animation (කාටූන්)';
            else if (isSinhala) catGroup = '🎬 Sinhala Movies (සිංහල චිත්‍රපට)';

            results.push({
                title: rawTitle,
                isSeries: isSeries,
                episodes: episodes,
                cloudDownloads: cloudDownloads,
                bridgeUrl: cloudDownloads[0]?.url || episodes[0]?.url || null,
                thumbnail: thumb,
                snippet: snippet,
                categories: categories,
                catGroup: catGroup
            });
        }

        return results;
    } catch (err) {
        console.error('[HelaFlix] getHelaflixPosts error:', err.message);
        return [];
    }
}

// ════════════════════════════════════════════════════════
// RAM-SAFE STREAMING DOWNLOAD ENGINE (AXIOS STREAM)
// ════════════════════════════════════════════════════════

async function streamMovieAndSend({ socket, msg, sender, destJid, downloadUrl, movieTitle, quality, poster, story, updateProgress }) {
    let tempFilePath = null;
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
        // 🔥 Send thumbnail and details card to target group/chat first! 🔥
        if (destJid && destJid !== sender) {
            try {
                const groupCardText =
                    `*↳ ❝ [🎬  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
                    `🎬 *TITLE:* ${movieTitle}\n` +
                    `🎙️ *AUDIO:* Sinhala Dubbed (HelaFlix)\n` +
                    `🎞️ *QUALITY:* ${quality || 'HD'}\n` +
                    (story ? `📝 *STORY:* ${story.slice(0, 250)}...\n` : '') +
                    `\n> *${BOT_TAG}*`;

                if (poster) {
                    await socket.sendMessage(destJid, { image: { url: poster }, caption: groupCardText });
                } else {
                    await socket.sendMessage(destJid, { text: groupCardText });
                }
            } catch (cardErr) {
                console.error('[HelaFlix] Group card send error:', cardErr.message);
            }
        }

        // 0. MEGA Cloud Handling
        if (downloadUrl.includes('mega.nz')) {
            const { File } = require('megajs');
            const file = File.fromURL(downloadUrl);
            await file.loadAttributes();

            const fileSize = file.size || 0;
            const limit2GB = 2 * 1024 * 1024 * 1024;
            const formattedSize = (fileSize / (1024 * 1024)).toFixed(1) + ' MB';

            if (fileSize > limit2GB) {
                try { await socket.sendMessage(sender, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return await updateProgress(
                    `⚠️ *චිත්‍රපටයේ ප්‍රමාණය 2GB ඉක්මවා ඇත! WhatsApp හරහා එවිය නොහැක.*\n` +
                    `📦 *Size:* ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n` +
                    `🔗 *MEGA Link:*\n${downloadUrl}`
                );
            }

            const randId = crypto.randomBytes(4).toString('hex');
            const cleanTitle = movieTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
            const ext = (file.name && file.name.endsWith('.mkv')) ? '.mkv' : '.mp4';
            const fileName = `${cleanTitle} (${quality || 'Sinhala Dubbed'}) SADEW MINI${ext}`;
            tempFilePath = path.join(tempDir, `hela_${randId}${ext}`);

            await updateProgress(`📥 *[HelaFlix]* Downloading \`${movieTitle}\` from MEGA Cloud...`);
            const writer = fs.createWriteStream(tempFilePath);
            await pipeline(file.download({ maxConnections: 16, initialChunkSize: 4 * 1024 * 1024, maxChunkSize: 16 * 1024 * 1024 }), writer);

            await updateProgress(`📤 *[HelaFlix]* Uploading \`${movieTitle}\` (${formattedSize}) to WhatsApp...`);

            const docCaption =
                `*↳ ❝ [🎬 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
                `🎬 *TITLE:* ${movieTitle}\n` +
                `🎙️ *AUDIO:* Sinhala Dubbed (HelaFlix)\n` +
                `🎞️ *QUALITY:* ${quality || 'HD'}\n` +
                `📦 *SIZE:* ${formattedSize}\n\n` +
                `> *${BOT_TAG}*`;

            await socket.sendMessage(destJid, {
                document: { stream: fs.createReadStream(tempFilePath) },
                mimetype: ext === '.mkv' ? 'video/x-matroska' : 'video/mp4',
                fileName: fileName,
                caption: docCaption
            }, { quoted: msg });

            await updateProgress(`✅ *[HelaFlix]* \`${movieTitle}\` සාර්ථකව WhatsApp වෙත යවා අවසන්!`);
            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            if (destJid !== sender) {
                await reply(`✅ *${movieTitle}* සාර්ථකව \`${destJid}\` වෙත යවන ලදී!`);
            }
            return;
        }

        let streamUrl = downloadUrl;
        let requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };

        // 1. Google Drive large file handling (bypass virus warning & confirmation)
        const isGdrive = downloadUrl.includes('drive.usercontent.google.com') || downloadUrl.includes('drive.google.com');
        if (isGdrive) {
            const gdriveId = extractGdriveFileId(downloadUrl);
            if (gdriveId) {
                const initialUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0`;
                const checkRes = await axios.get(initialUrl, {
                    headers: requestHeaders,
                    maxRedirects: 5,
                    timeout: 20000
                });

                const ct = (checkRes.headers['content-type'] || '').toLowerCase();
                // If it returned virus warning HTML page, parse confirm & cookies
                if (ct.includes('text/html')) {
                    const html = checkRes.data;
                    const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i) || html.match(/confirm=([0-9a-zA-Z_-]+)/i);
                    const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
                    const cookies = checkRes.headers['set-cookie']
                        ? checkRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
                        : '';

                    let confirmedUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0`;
                    if (confirmMatch) confirmedUrl += `&confirm=${confirmMatch[1]}`;
                    if (uuidMatch) confirmedUrl += `&uuid=${uuidMatch[1]}`;

                    streamUrl = confirmedUrl;
                    if (cookies) requestHeaders['Cookie'] = cookies;
                } else {
                    streamUrl = initialUrl;
                }
            }
        }

        await updateProgress(`📥 *[HelaFlix]* Downloading \`${movieTitle}\` via Pure Stream...`);

        // 2. Pure Axios Stream
        const streamRes = await axios({
            method: 'GET',
            url: streamUrl,
            headers: requestHeaders,
            responseType: 'stream',
            timeout: 1800000, // 30 minutes for large movies
            maxRedirects: 10
        });

        // Verify content type is not error HTML
        const resContentType = (streamRes.headers['content-type'] || '').toLowerCase();
        if (resContentType.includes('text/html')) {
            streamRes.data.destroy();
            throw new Error('Received HTML webpage instead of video stream.');
        }

        // 3. 2GB Size Check (WhatsApp document limit)
        const cl = streamRes.headers['content-length'];
        const limit2GB = 2 * 1024 * 1024 * 1024;
        let formattedSize = 'Unknown';

        if (cl) {
            const bytes = parseInt(cl, 10);
            formattedSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            if (bytes > limit2GB) {
                streamRes.data.destroy();
                try { await socket.sendMessage(sender, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                return await updateProgress(
                    `⚠️ *චිත්‍රපටයේ ප්‍රමාණය 2GB ඉක්මවා ඇත! WhatsApp හරහා එවිය නොහැක.*\n` +
                    `📦 *Size:* ${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n` +
                    `🔗 *Direct Download Link:*\n${downloadUrl}`
                );
            }
        }

        // 4. Pipe stream to local disk (0 RAM heap impact)
        const randId = crypto.randomBytes(4).toString('hex');
        const cleanTitle = movieTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
        const ext = downloadUrl.endsWith('.mkv') ? '.mkv' : '.mp4';
        const fileName = `${cleanTitle} (${quality || 'Sinhala Dubbed'}) SADEW MINI${ext}`;
        tempFilePath = path.join(tempDir, `hela_${randId}${ext}`);

        const writer = fs.createWriteStream(tempFilePath);
        await pipeline(streamRes.data, writer);

        // 5. Upload to WhatsApp as Document Stream
        await updateProgress(`📤 *[HelaFlix]* Uploading \`${movieTitle}\` (${formattedSize}) to WhatsApp...`);

        const docCaption =
            `*↳ ❝ [🎬 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
            `🎬 *TITLE:* ${movieTitle}\n` +
            `🎙️ *AUDIO:* Sinhala Dubbed (HelaFlix)\n` +
            `🎞️ *QUALITY:* ${quality || 'HD'}\n` +
            `📦 *SIZE:* ${formattedSize}\n\n` +
            `> *${BOT_TAG}*`;

        await socket.sendMessage(destJid, {
            document: { stream: fs.createReadStream(tempFilePath) },
            mimetype: ext === '.mkv' ? 'video/x-matroska' : 'video/mp4',
            fileName: fileName,
            caption: docCaption
        }, { quoted: (destJid === sender ? msg : undefined) });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        if (destJid !== sender) {
            await updateProgress(`✅ *[HelaFlix]* \`${movieTitle}\` සාර්ථකව \`${destJid}\` වෙත යවන ලදී!`);
        }

    } catch (err) {
        console.error('[HelaFlix] Download/Stream error:', err.message);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        await updateProgress(
            `❌ *Download Error:* ${err.message}\n\n` +
            `🔗 *Direct Link:*\n${downloadUrl}`
        );
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
// INTERACTIVE NUMBER REPLY LISTENER
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

            const session = global.helaflixStore[userSender] || global.helaflixStore[from];
            if (!session) return;

            const quotedStanza = m.message.extendedTextMessage?.contextInfo?.stanzaId;
            const isQuotedMatch = quotedStanza && quotedStanza === session.msgId;
            const num = parseInt(text, 10);

            // STAGE 1: Movie / Series Selection from List
            if (session.stage === 'SELECTION' && (isQuotedMatch || !isNaN(num)) && num >= 1 && num <= session.results.length) {
                const selected = session.results[num - 1];
                delete global.helaflixStore[userSender];
                delete global.helaflixStore[from];

                await handleMovieSelection({
                    socket,
                    msg: m,
                    sender: from,
                    movie: selected,
                    targetJid: session.targetJid
                });
            }

            // STAGE 2: Episode Selection in TV Series
            else if (session.stage === 'EPISODES') {
                if (text.toLowerCase() === 'all') {
                    delete global.helaflixStore[userSender];
                    delete global.helaflixStore[from];

                    await handleAllEpisodesDownload({
                        socket,
                        msg: m,
                        sender: from,
                        movieTitle: session.title,
                        episodes: session.episodes,
                        poster: session.poster,
                        story: session.story,
                        targetJid: session.targetJid
                    });
                    return;
                }

                if ((isQuotedMatch || !isNaN(num)) && num >= 1 && num <= session.episodes.length) {
                    const selectedEp = session.episodes[num - 1];
                    delete global.helaflixStore[userSender];
                    delete global.helaflixStore[from];

                    await handleEpisodeDownload({
                        socket,
                        msg: m,
                        sender: from,
                        movieTitle: session.title,
                        ep: selectedEp,
                        poster: session.poster,
                        story: session.story,
                        targetJid: session.targetJid
                    });
                }
            }
        } catch (err) {
            console.error('[HelaFlix] Listener error:', err.message);
        }
    });
}

// ════════════════════════════════════════════════════════
// ALL EPISODES DOWNLOAD HANDLER
// ════════════════════════════════════════════════════════

async function handleAllEpisodesDownload({ socket, msg, sender, movieTitle, episodes, poster, story, targetJid }) {
    if (isHelaDlAllRunning) {
        return socket.sendMessage(sender, {
            text: "⚠️ *දැනටමත් කතා මාලාවක් බාගත වෙමින් පවතී.* කරුණාකර එය අවසන් වනතුරු මදක් රැඳී සිටින්න."
        }, { quoted: msg });
    }

    isHelaDlAllRunning = true;
    const destJid = targetJid || sender;

    try {
        await socket.sendMessage(sender, { react: { text: '📦', key: msg.key } });

        // If sending to target group, send series poster card first!
        if (destJid && destJid !== sender) {
            try {
                const groupCardText =
                    `*↳ ❝ [📺  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 📺] ¡! ❞*\n\n` +
                    `🎬 *SERIES:* ${movieTitle}\n` +
                    `🎞️ *TOTAL EPISODES:* ${episodes.length}\n` +
                    `🎙️ *AUDIO:* Sinhala Dubbed (HelaFlix)\n` +
                    (story ? `📝 *STORY:* ${story.slice(0, 250)}...\n` : '') +
                    `\n> *${BOT_TAG}*`;

                if (poster) {
                    await socket.sendMessage(destJid, { image: { url: poster }, caption: groupCardText });
                } else {
                    await socket.sendMessage(destJid, { text: groupCardText });
                }
            } catch (cardErr) {
                console.error('[HelaFlix] Group card send error:', cardErr.message);
            }
        }

        let startNotice =
            `📦 *[HelaFlix - ALL EPISODES DOWNLOAD]*\n` +
            `🎬 *Series:* ${movieTitle}\n` +
            `🎞️ *Total Episodes:* ${episodes.length}\n`;
        if (targetJid) startNotice += `🎯 *Send Target:* \`${targetJid}\`\n`;
        startNotice += `\n_සියලුම Episodes එකින් එක පිළිවෙළින් බාගත කර WhatsApp වෙත එවනු ලැබේ. කරුණාකර රැඳී සිටින්න..._`;

        await socket.sendMessage(sender, { text: startNotice }, { quoted: msg });

        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];
            const fullEpTitle = `${movieTitle} - ${ep.title}`;
            
            await socket.sendMessage(sender, {
                text: `📥 *[${i + 1}/${episodes.length}]* \`${fullEpTitle}\` බාගත කිරීම සූදානම් කරමින් පවතී...`
            });

            const resolved = await resolveUniversalDownload(ep.url);
            if (!resolved || !resolved.downloadUrl) {
                await socket.sendMessage(sender, {
                    text: `⚠️ *[${i + 1}/${episodes.length}]* \`${fullEpTitle}\` සඳහා Link එකක් හමු නොවූ බැවින් මඟ හරින ලදී.`
                });
                continue;
            }

            if (resolved.type === 'telegram') {
                await socket.sendMessage(destJid, {
                    text: `⚠️ *[${i + 1}/${episodes.length}] ${fullEpTitle}* Telegram මගින් පමණක් ලබාගත හැක.\n🔗 *Link:* ${resolved.downloadUrl}`
                });
                continue;
            }

            let tempFilePath = null;
            try {
                let streamUrl = resolved.downloadUrl;
                let requestHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                };

                const isGdrive = resolved.downloadUrl.includes('drive.usercontent.google.com') || resolved.downloadUrl.includes('drive.google.com');
                if (isGdrive) {
                    const gdriveId = extractGdriveFileId(resolved.downloadUrl);
                    if (gdriveId) {
                        const initialUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0`;
                        const checkRes = await axios.get(initialUrl, {
                            headers: requestHeaders,
                            maxRedirects: 5,
                            timeout: 20000
                        });
                        const ct = (checkRes.headers['content-type'] || '').toLowerCase();
                        if (ct.includes('text/html')) {
                            const html = checkRes.data;
                            const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i) || html.match(/confirm=([0-9a-zA-Z_-]+)/i);
                            const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
                            const cookies = checkRes.headers['set-cookie'] ? checkRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

                            let confirmedUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0`;
                            if (confirmMatch) confirmedUrl += `&confirm=${confirmMatch[1]}`;
                            if (uuidMatch) confirmedUrl += `&uuid=${uuidMatch[1]}`;
                            streamUrl = confirmedUrl;
                            if (cookies) requestHeaders['Cookie'] = cookies;
                        } else {
                            streamUrl = initialUrl;
                        }
                    }
                }

                await socket.sendMessage(sender, {
                    text: `📥 *[${i + 1}/${episodes.length}]* Downloading \`${fullEpTitle}\` (Pure Stream)...`
                });

                const streamRes = await axios({
                    method: 'GET',
                    url: streamUrl,
                    headers: requestHeaders,
                    responseType: 'stream',
                    timeout: 600000,
                    maxRedirects: 10
                });

                const cl = streamRes.headers['content-length'];
                const limit2GB = 2 * 1024 * 1024 * 1024;
                if (cl && parseInt(cl, 10) > limit2GB) {
                    streamRes.data.destroy();
                    await socket.sendMessage(destJid, {
                        text: `⚠️ *[${i + 1}/${episodes.length}] ${fullEpTitle}* 2GB ට වඩා විශාල බැවින් මඟ හරින ලදී.\n🔗 *Direct Link:* ${resolved.downloadUrl}`
                    });
                    continue;
                }

                const randId = crypto.randomBytes(4).toString('hex');
                const cleanTitle = fullEpTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                const ext = streamUrl.endsWith('.mkv') ? '.mkv' : '.mp4';
                const fileName = `${cleanTitle} SADEW MINI${ext}`;
                tempFilePath = path.join(tempDir, `hela_all_${randId}${ext}`);

                const writer = fs.createWriteStream(tempFilePath);
                await pipeline(streamRes.data, writer);

                await socket.sendMessage(sender, {
                    text: `📤 *[${i + 1}/${episodes.length}]* Uploading \`${fullEpTitle}\` to WhatsApp...`
                });

                const docCaption =
                    `*↳ ❝ [🎬 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 𝗘𝗣𝗜𝗦𝗢𝗗𝗘 🎬] ¡! ❞*\n\n` +
                    `🎬 *TITLE:* ${fullEpTitle}\n` +
                    `🎙️ *AUDIO:* Sinhala Dubbed (HelaFlix)\n` +
                    `🎞️ *QUALITY:* ${ep.qualityText || '720p HD'}\n\n` +
                    `> *${BOT_TAG}*`;

                await socket.sendMessage(destJid, {
                    document: { stream: fs.createReadStream(tempFilePath) },
                    mimetype: ext === '.mkv' ? 'video/x-matroska' : 'video/mp4',
                    fileName: fileName,
                    caption: docCaption
                });

            } catch (epErr) {
                console.error(`[HelaFlix] Error on ${fullEpTitle}:`, epErr.message);
                await socket.sendMessage(sender, {
                    text: `⚠️ *[${i + 1}/${episodes.length}]* \`${fullEpTitle}\` එවීමේදී දෝෂයක්: ${epErr.message}`
                });
            } finally {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try { fs.unlinkSync(tempFilePath); } catch (_) {}
                }
                cleanTempDir();
                if (global.gc) {
                    try { global.gc(); } catch (_) {}
                }
            }

            // Safe 5 second pause between episodes for stability
            if (i < episodes.length - 1) {
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        await socket.sendMessage(sender, {
            text: `✅ *[HelaFlix]* \`${movieTitle}\` හි සියලුම Episodes සාර්ථකව යවා අවසන්!`
        }, { quoted: msg });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

    } catch (allErr) {
        console.error('[HelaFlix] handleAllEpisodesDownload error:', allErr.message);
        await socket.sendMessage(sender, {
            text: `❌ *සියලුම Episodes බාගත කිරීමේදී දෝෂයක් මතු විය:* ${allErr.message}`
        }, { quoted: msg });
    } finally {
        isHelaDlAllRunning = false;
        cleanTempDir();
        if (global.gc) {
            try { global.gc(); } catch (_) {}
        }
    }
}

// ════════════════════════════════════════════════════════
// EPISODE DOWNLOAD HANDLER
// ════════════════════════════════════════════════════════

async function handleEpisodeDownload({ socket, msg, sender, movieTitle, ep, poster, story, targetJid }) {
    const fullEpTitle = `${movieTitle} - ${ep.title}`;
    const destJid = targetJid || sender;

    try {
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        let statusMsg = await socket.sendMessage(sender, {
            text: `⏳ *[HelaFlix]* \`${fullEpTitle}\` Download Link එක සකසමින් පවතී...`
        }, { quoted: msg });

        const updateProgress = async (text) => {
            try {
                await socket.sendMessage(sender, {
                    edit: statusMsg.key,
                    text: text
                });
            } catch (_) {
                try {
                    statusMsg = await socket.sendMessage(sender, { text: text }, { quoted: msg });
                } catch (_) {}
            }
        };

        const resolved = await resolveUniversalDownload(ep.url);
        if (!resolved || !resolved.downloadUrl) {
            return await updateProgress(`❌ *${fullEpTitle} සඳහා Download Link එකක් ලබාගත නොහැකි විය.*`);
        }

        if (resolved.type === 'gdrive' || resolved.type === 'direct') {
            await streamMovieAndSend({
                socket,
                msg,
                sender,
                destJid,
                downloadUrl: resolved.downloadUrl,
                movieTitle: fullEpTitle,
                quality: ep.qualityText || '720p HD',
                poster: poster,
                story: story,
                updateProgress
            });
        } else if (resolved.type === 'telegram') {
            const tgText =
                `*↳ ❝ [✈️ 𝗛𝗲𝗹𝗮𝗙𝗹𝗶𝘅 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 ✈️] ¡! ❞*\n\n` +
                `🎬 *Title:* ${fullEpTitle}\n` +
                `🎞️ *Quality:* ${ep.qualityText || '720p HD'}\n\n` +
                `🔗 *Telegram Link:*\n${resolved.downloadUrl}\n\n` +
                `💡 *බාගත කරගන්නා ආකාරය:*\n` +
                `• ඉහත Telegram ලින්ක් එක මත Click කරන්න.\n` +
                `• Telegram විවෘත වූ පසු *Start* බොත්තම ඔබා Episode එක බාගත කරගන්න.\n\n` +
                `> *${BOT_TAG}*`;

            await socket.sendMessage(destJid, {
                image: { url: poster || getRandomBanner() },
                caption: tgText,
                footer: BOT_NAME
            }, { quoted: msg });
            await socket.sendMessage(sender, { react: { text: '✈️', key: msg.key } });
        } else {
            const dlText =
                `*↳ ❝ [🎬 𝗛𝗲𝗹𝗮𝗙𝗹𝗶𝘅 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 🎬] ¡! ❞*\n\n` +
                `🎬 *Title:* ${fullEpTitle}\n\n` +
                `🔗 *Download Link:*\n${resolved.downloadUrl}\n\n` +
                `> *${BOT_TAG}*`;

            await socket.sendMessage(destJid, {
                image: { url: poster || getRandomBanner() },
                caption: dlText,
                footer: BOT_NAME
            }, { quoted: msg });
            await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });
        }
    } catch (err) {
        console.error('[HelaFlix] handleEpisodeDownload error:', err.message);
        await socket.sendMessage(sender, { text: `❌ *Episode බාගත කිරීමේ දෝෂයක්:* ${err.message}` }, { quoted: msg });
    }
}

// ════════════════════════════════════════════════════════
// COMMON MOVIE / SERIES SELECTION CARD
// ════════════════════════════════════════════════════════

async function handleMovieSelection({ socket, msg, sender, movie, targetJid }) {
    try {
        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        // ══════════════════════════════════════════════════
        // CASE A: TV SERIES WITH EPISODES
        // ══════════════════════════════════════════════════
        if (movie.isSeries && movie.episodes && movie.episodes.length > 0) {
            const seriesKey = crypto.randomBytes(3).toString('hex');
            global.helaflixCache[seriesKey] = {
                movieTitle: movie.title,
                episodes: movie.episodes,
                poster: movie.thumbnail,
                story: movie.snippet,
                targetJid: targetJid
            };

            let epListText =
                `*↳ ❝ [📺 𝗛𝗲𝗹𝗮𝗙𝗹𝗶𝘅 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n` +
                `🎬 *Series:* ${movie.title}\n` +
                `🔢 *Total Episodes:* ${movie.episodes.length}\n` +
                `🎙️ *Audio:* Sinhala Dubbed\n`;

            if (targetJid) epListText += `🎯 *Send Target:* \`${targetJid}\`\n`;
            if (movie.snippet) epListText += `\n📝 *Story:* ${movie.snippet}...\n`;

            epListText += `\n*👇 Episodes ලැයිස්තුව:*\n`;

            // 1️⃣ TOP BUTTON: DOWNLOAD ALL EPISODES
            const buttons = [
                {
                    buttonId: `.hela_dlall ${seriesKey}`,
                    buttonText: { displayText: '📦 DOWNLOAD ALL EPISODES' },
                    type: 1
                }
            ];

            movie.episodes.forEach((ep, idx) => {
                const epKey = crypto.randomBytes(3).toString('hex');
                global.helaflixCache[epKey] = {
                    movieTitle: movie.title,
                    ep: ep,
                    poster: movie.thumbnail,
                    story: movie.snippet,
                    targetJid: targetJid
                };

                const cleanQuality = ep.qualityText.replace(/📥|Download/gi, '').trim();
                epListText += `*${idx + 1}.* ${ep.title} (${cleanQuality})\n`;

                const label = `${idx + 1}. ${ep.title}`.slice(0, 24);
                buttons.push({
                    buttonId: `.hela_ep ${epKey}`,
                    buttonText: { displayText: `⚡ ${label}` },
                    type: 1
                });
            });

            epListText += `\n> *📩 අවශ්‍ය Episode අංකය (1-${movie.episodes.length}) Reply කරන්න, නැතහොත් සියල්ල බාගත කිරීමට 'all' ලෙස Reply කරන්න (හෝ Button එක ඔබන්න)*\n`;
            epListText += `> *${BOT_TAG}*`;

            const sentMsg = await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: epListText,
                footer: BOT_NAME,
                buttons: buttons,
                headerType: 4
            }, { quoted: msg });

            // Store session for interactive number reply
            const userKey = cleanJid(sender);
            global.helaflixStore[userKey] = {
                stage: 'EPISODES',
                msgId: sentMsg.key.id,
                title: movie.title,
                episodes: movie.episodes,
                poster: movie.thumbnail,
                story: movie.snippet,
                targetJid: targetJid
            };

            setTimeout(() => {
                if (global.helaflixStore[userKey] && global.helaflixStore[userKey].msgId === sentMsg.key.id) {
                    delete global.helaflixStore[userKey];
                }
            }, 180000);

            await socket.sendMessage(sender, { react: { text: '📺', key: msg.key } });
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE B: SINGLE MOVIE WITH CLOUD SERVERS (DRIVE / DIRECT / TG / MEGA)
        // ══════════════════════════════════════════════════
        let cardText =
            `*↳ ❝ [🎬 𝗛𝗲𝗹𝗮𝗙𝗹𝗶𝘅 𝗠𝗼𝘃𝗶𝗲 🎬] ¡! ❞*\n\n` +
            `🎬 *Title:* ${movie.title}\n` +
            `🎙️ *Language:* Sinhala Dubbed\n` +
            `🏷️ *Categories:* ${(movie.categories && movie.categories.length) ? movie.categories.join(', ') : 'Sinhala Dubbed'}\n`;

        if (targetJid) cardText += `🎯 *Send Target:* \`${targetJid}\`\n`;
        if (movie.snippet) cardText += `\n📝 *Story:* ${movie.snippet}...\n`;

        // Check cloud options with Drive / Direct prioritized
        const cloudOptions = movie.cloudDownloads || [];
        const driveOpt = cloudOptions.find(o => o.type === 'drive');
        const directOpt = cloudOptions.find(o => o.type === 'direct');
        const bestOpt = driveOpt || directOpt || cloudOptions[0];
        const bridgeUrlToResolve = bestOpt ? bestOpt.url : movie.bridgeUrl;

        const resolved = await resolveUniversalDownload(bridgeUrlToResolve);
        const downloadUrl = resolved?.downloadUrl || null;

        if (!downloadUrl) {
            cardText += `\n❌ *මෙම චිත්‍රපටය සඳහා Download Link එකක් හමු නොවීය.*`;
            return await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: cardText,
                footer: BOT_NAME
            }, { quoted: msg });
        }

        const isStreamable = resolved.type === 'gdrive' || resolved.type === 'direct' || resolved.type === 'mega' || downloadUrl.includes('drive.usercontent.google.com') || downloadUrl.includes('drive.google.com') || downloadUrl.includes('workers.dev') || downloadUrl.includes('mega.nz');
        const isTelegram = resolved.type === 'telegram' || downloadUrl.includes('t.me');
        const isMega = resolved.type === 'mega' || downloadUrl.includes('mega.nz');

        if (isStreamable) {
            const dlKey = crypto.randomBytes(4).toString('hex');
            global.helaflixCache[dlKey] = {
                title: movie.title,
                url: downloadUrl,
                quality: 'HD',
                poster: movie.thumbnail,
                story: movie.snippet,
                targetJid: targetJid
            };

            const sourceLabel = resolved.type === 'gdrive' 
                ? 'Google Drive Direct (Pure Stream)' 
                : (downloadUrl.includes('mega.nz') ? 'MEGA Cloud Direct Stream' : 'High-Speed Cloud Stream');
            cardText += `\n🌐 *Source:* ${sourceLabel}\n`;
            cardText += `\n> *👇 බාගත කිරීමට පහත Download Movie බොත්තම ඔබන්න* ⬇️`;

            const btnText = downloadUrl.includes('mega.nz') ? '☁️ Download Movie (MEGA Stream)' : '🎥 Download Movie (Direct Stream)';
            const buttons = [
                {
                    buttonId: `.hela_dl ${dlKey}`,
                    buttonText: { displayText: btnText },
                    type: 1
                }
            ];

            await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: cardText,
                footer: BOT_NAME,
                buttons: buttons,
                headerType: 4
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });

        } else if (isTelegram) {
            cardText +=
                `\n🌐 *Source:* Telegram Bot\n\n` +
                `🔗 *Telegram Link:*\n${downloadUrl}\n\n` +
                `💡 *බාගත කරගන්නා ආකාරය:*\n` +
                `• ඉහත Telegram ලින්ක් එක මත Click කරන්න.\n` +
                `• Telegram විවෘත වූ පසු *Start* බොත්තම ඔබා චිත්‍රපටය බාගත කරගන්න.\n\n` +
                `> *${BOT_TAG}*`;

            await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: cardText,
                footer: BOT_NAME
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '✈️', key: msg.key } });

        } else if (isMega) {
            cardText +=
                `\n🌐 *Source:* Mega.nz Cloud\n\n` +
                `🔗 *Mega Download Link:*\n${downloadUrl}\n\n` +
                `💡 *බාගත කරගන්නා ආකාරය:*\n` +
                `• ඉහත Mega ලින්ක් එක Browser එකෙන් විවෘත කරන්න.\n` +
                `• *Download* බොත්තම ඔබා චිත්‍රපටය බාගත කරගන්න.\n\n` +
                `> *${BOT_TAG}*`;

            await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: cardText,
                footer: BOT_NAME
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '☁️', key: msg.key } });

        } else {
            const dlKey = crypto.randomBytes(4).toString('hex');
            global.helaflixCache[dlKey] = {
                title: movie.title,
                url: downloadUrl,
                quality: 'HD',
                poster: movie.thumbnail,
                story: movie.snippet,
                targetJid: targetJid
            };

            cardText += `\n🌐 *Source:* Direct Stream\n`;
            cardText += `\n> *👇 බාගත කිරීමට පහත බොත්තම ඔබන්න* ⬇️`;

            const buttons = [
                {
                    buttonId: `.hela_dl ${dlKey}`,
                    buttonText: { displayText: '🎥 Download Video (Stream)' },
                    type: 1
                }
            ];

            await socket.sendMessage(sender, {
                image: { url: movie.thumbnail || getRandomBanner() },
                caption: cardText,
                footer: BOT_NAME,
                buttons: buttons,
                headerType: 4
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });
        }

    } catch (err) {
        console.error('[HelaFlix] handleMovieSelection error:', err.message);
        await socket.sendMessage(sender, { text: `❌ *චිත්‍රපට තොරතුරු ලබා ගැනීමේදී දෝෂයක්:* ${err.message}` }, { quoted: msg });
    }
}

// ════════════════════════════════════════════════════════
// 🚀 PLUGIN DEFINITION
// ════════════════════════════════════════════════════════

module.exports = {
    name: 'helaflix',
    description: 'Sinhala Dubbed movies from HelaFlix (Direct Stream & RAM Safe)',
    category: 10,
    commands: ['helaflix', 'helafix', 'hfix', 'hela', 'helasend', 'hela_sel', 'hela_ep', 'hela_dl', 'hela_dlall'],
    menuCommands: ['helaflix', 'helafix', 'hfix'],
    hidden: false,

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        attachReplyListener(socket);

        // ════════════════════════════════════════════════════
        // 1️⃣ SEARCH / CATEGORY LIST COMMAND (.helaflix / .helafix / .hfix / .helasend)
        // ════════════════════════════════════════════════════
        if (['helaflix', 'helafix', 'hfix', 'hela', 'helasend'].includes(command)) {
            const fullText = args.join(' ').trim();
            const { query, targetJid } = parseTargetJid(fullText);

            if (command === 'helasend' && !targetJid) {
                return reply(
                    `❌ *කරුණාකර කොමාවකින් (,) වෙන් කර නිවැරදි Group JID එකක් හෝ Phone Number එකක් ලබාදෙන්න!*\n` +
                    `_උදා: .helasend all , 12036304@g.us_\n` +
                    `_උදා: .helasend වෘක , 0771234567_\n` +
                    `_උදා: .helasend Flash , 12036304@g.us_`
                );
            }

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

                const isAllOrEmpty = !query || query.toLowerCase() === 'all';

                // Fetch posts
                const results = await getHelaflixPosts(isAllOrEmpty ? 'all' : query);

                if (!results || results.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply(`🤷‍♀️ *"${query || 'චිත්‍රපට'}" සඳහා කිසිදු ප්‍රතිඵලයක් HelaFlix හි හමු නොවීය!*`);
                }

                // ----------------------------------------------------
                // CASE 1A: Categorized Full Site List (When .helafix or .helafix all)
                // ----------------------------------------------------
                if (isAllOrEmpty) {
                    // Group into Categories
                    const groups = {};
                    results.forEach(item => {
                        const grp = item.catGroup || '🌍 Dubbed Movies (හඬකැවූ චිත්‍රපට)';
                        if (!groups[grp]) groups[grp] = [];
                        groups[grp].push(item);
                    });

                    let listText = `*↳ ❝ [🎀 🎬 𝗛𝗘𝗟𝗔𝗙𝗟𝗜𝗫 𝗠𝗢𝗩𝗜𝗘 𝗖𝗘𝗡𝗧𝗘𝗥 🎬 🎀] ¡! ❞*\n\n`;
                    listText += `📊 *Total Movies & Series:* ${results.length}\n`;
                    if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n`;
                    listText += `💡 *ඔබට අවශ්‍ය චිත්‍රපටයේ අංකය (1-${results.length}) Reply කරන්න*\n\n`;

                    let counter = 1;
                    const finalOrder = [];

                    for (const [groupName, items] of Object.entries(groups)) {
                        listText += `┏━━〔 ${groupName} 〕━━┓\n\n`;
                        items.forEach(item => {
                            listText += `✦ *${counter}.* ${item.title}\n`;
                            finalOrder.push(item);
                            counter++;
                        });
                        listText += `\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
                    }

                    listText += `> *📩 අංකය Reply කර හෝ නම Search කර (.helafix <නම>) තෝරාගන්න*\n`;
                    listText += `> *${BOT_TAG}*`;

                    const sentMsg = await socket.sendMessage(sender, {
                        image: { url: results[0]?.thumbnail || getRandomBanner() },
                        caption: listText,
                        footer: BOT_NAME
                    }, { quoted: msg });

                    // Save session for number reply (1, 2, 3...)
                    const userKey = cleanJid(sender);
                    global.helaflixStore[userKey] = {
                        stage: 'SELECTION',
                        msgId: sentMsg.key.id,
                        results: finalOrder,
                        targetJid: targetJid
                    };

                    setTimeout(() => {
                        if (global.helaflixStore[userKey] && global.helaflixStore[userKey].msgId === sentMsg.key.id) {
                            delete global.helaflixStore[userKey];
                        }
                    }, 180000);

                    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    return;
                }

                // ----------------------------------------------------
                // CASE 1B: Search Results List (When query specified)
                // ----------------------------------------------------
                const topResults = results.slice(0, 15);

                let listText =
                    `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗛𝗲𝗹𝗮𝗙𝗹𝗶𝘅 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n` +
                    `🔍 *සෙව්වේ:* ${query}\n` +
                    `📊 *චිත්‍රපට ගණන:* ${topResults.length}\n`;

                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n`;
                listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, idx) => {
                    const selKey = crypto.randomBytes(3).toString('hex');
                    global.helaflixCache[selKey] = {
                        movie: mv,
                        targetJid: targetJid
                    };

                    const typeIcon = mv.isSeries ? '📺' : '🎬';
                    listText += `*${idx + 1}.* ${typeIcon} ${mv.title}\n`;
                    if (mv.isSeries) {
                        listText += `   🔢 ${mv.episodes.length} Episodes | Sinhala Dubbed\n`;
                    } else if (mv.categories && mv.categories.length) {
                        listText += `   🏷️ ${mv.categories.slice(0, 3).join(', ')}\n`;
                    }
                    listText += `\n`;

                    const label = `${idx + 1}. ${typeIcon} ${mv.title}`.slice(0, 24);
                    buttons.push({
                        buttonId: `.hela_sel ${selKey}`,
                        buttonText: { displayText: label },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් ඔබට අවශ්‍ය චිත්‍රපටය තෝරන්න (හෝ අංකය Reply කරන්න)*\n`;
                listText += `> *${BOT_TAG}*`;

                const sentMsg = await socket.sendMessage(sender, {
                    image: { url: topResults[0].thumbnail || getRandomBanner() },
                    caption: listText,
                    footer: BOT_NAME,
                    buttons: buttons,
                    headerType: 4
                }, { quoted: msg });

                // Save session for number reply (1, 2, 3...)
                const userKey = cleanJid(sender);
                global.helaflixStore[userKey] = {
                    stage: 'SELECTION',
                    msgId: sentMsg.key.id,
                    results: topResults,
                    targetJid: targetJid
                };

                setTimeout(() => {
                    if (global.helaflixStore[userKey] && global.helaflixStore[userKey].msgId === sentMsg.key.id) {
                        delete global.helaflixStore[userKey];
                    }
                }, 180000);

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (err) {
                console.error('[HelaFlix] search error:', err.message);
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                reply(`❌ *HelaFlix සෙවීමේදී දෝෂයක් සිදුවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════
        // 2️⃣ MOVIE DETAILS SELECTION (.hela_sel <key>)
        // ════════════════════════════════════════════════════
        else if (command === 'hela_sel') {
            const selKey = args[0];
            const cached = global.helaflixCache[selKey];
            if (!cached) {
                return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත .helafix සර්ච් කරන්න.*");
            }

            await handleMovieSelection({
                socket,
                msg,
                sender,
                movie: cached.movie,
                targetJid: cached.targetJid
            });
        }

        // ════════════════════════════════════════════════════
        // 3️⃣ EPISODE SELECTION (.hela_ep <key>)
        // ════════════════════════════════════════════════════
        else if (command === 'hela_ep') {
            const epKey = args[0];
            const cached = global.helaflixCache[epKey];
            if (!cached) {
                return reply("⚠️ *Episode සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත තෝරන්න.*");
            }

            await handleEpisodeDownload({
                socket,
                msg,
                sender,
                movieTitle: cached.movieTitle,
                ep: cached.ep,
                poster: cached.poster,
                story: cached.story,
                targetJid: cached.targetJid
            });
        }

        // ════════════════════════════════════════════════════
        // 4️⃣ STREAM DOWNLOAD & SEND (.hela_dl <key>)
        // ════════════════════════════════════════════════════
        else if (command === 'hela_dl') {
            const dlKey = args[0];
            const cached = global.helaflixCache[dlKey];
            if (!cached) {
                return reply("⚠️ *Download Link එක කල් ඉකුත් වී ඇත. කරුණාකර නැවත තෝරන්න.*");
            }

            const movieTitle = cached.title;
            const downloadUrl = cached.url;
            const quality = cached.quality;
            const poster = cached.poster;
            const story = cached.story;
            const destJid = cached.targetJid || sender;

            try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

            let statusMsg = await socket.sendMessage(sender, {
                text: `⏳ *[HelaFlix]* \`${movieTitle}\` බාගත කිරීම සූදානම් කරමින් පවතී...`
            }, { quoted: msg });

            const updateProgress = async (text) => {
                try {
                    await socket.sendMessage(sender, {
                        edit: statusMsg.key,
                        text: text
                    });
                } catch (_) {
                    try {
                        statusMsg = await socket.sendMessage(sender, { text: text }, { quoted: msg });
                    } catch (_) {}
                }
            };

            await streamMovieAndSend({
                socket,
                msg,
                sender,
                destJid,
                downloadUrl,
                movieTitle,
                quality,
                poster,
                story,
                updateProgress
            });

            delete global.helaflixCache[dlKey];
        }

        // ════════════════════════════════════════════════════
        // 5️⃣ DOWNLOAD ALL EPISODES (.hela_dlall <key>)
        // ════════════════════════════════════════════════════
        else if (command === 'hela_dlall') {
            const seriesKey = args[0];
            const cached = global.helaflixCache[seriesKey];
            if (!cached) {
                return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත තෝරන්න.*");
            }

            await handleAllEpisodesDownload({
                socket,
                msg,
                sender,
                movieTitle: cached.movieTitle,
                episodes: cached.episodes,
                poster: cached.poster,
                story: cached.story,
                targetJid: cached.targetJid
            });
        }
    }
};
