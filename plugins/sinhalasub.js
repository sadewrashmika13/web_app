const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'https://sinhalasub.lk';

// Global caches for short button payload callbacks
if (!global.sinhalasubCache) global.sinhalasubCache = {};

// Helper: parse Target JID for group/inbox delivery without requiring a comma
function parseTargetJid(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    // 1. Matches: 12036304@g.us, 94771234567@s.whatsapp.net, +9477..., 077...
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
    }

    // 2. Space separated fallback
    if (!targetJid) {
        const words = raw.split(/\s+/);
        if (words.length > 1) {
            const last = words[words.length - 1].trim().replace(/,$/, '');
            if (last.includes('@g.us') || last.includes('@s.whatsapp.net')) {
                targetJid = last;
                query = words.slice(0, -1).join(' ').trim().replace(/,$/, '');
            } else if (/^(?:0|\+?94)[0-9]{9}$/.test(last)) {
                let num = last.replace(/[^0-9]/g, '');
                if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
                targetJid = num + '@s.whatsapp.net';
                query = words.slice(0, -1).join(' ').trim().replace(/,$/, '');
            }
        }
    }

    // 3. Fallback comma split
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

// Helper: extract Google Drive fileId if link is Google Drive
function extractGdriveFileId(url) {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                  url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    return null;
}

// Helper: get fresh search nonce from homepage
let cachedNonce = 'b864bc047d';
let nonceExpiry = 0;

async function getSearchNonce() {
    const now = Date.now();
    if (cachedNonce && now < nonceExpiry) return cachedNonce;
    try {
        const res = await axios.get(BASE_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 10000
        });
        const match = res.data.match(/"nonce"\s*:\s*"([a-f0-9]+)"/i);
        if (match && match[1]) {
            cachedNonce = match[1];
            nonceExpiry = now + 10 * 60 * 1000;
            return cachedNonce;
        }
    } catch (_) {}
    return cachedNonce || 'b864bc047d';
}

// Scraper: Search sinhalasub.lk (Movies & TV Shows)
async function searchSinhalasub(query) {
    const nonce = await getSearchNonce();
    const searchUrl = `${BASE_URL}/wp-json/zetaflix/search/?keyword=${encodeURIComponent(query)}&nonce=${nonce}`;
    const res = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });

    const data = res.data;
    if (!data || typeof data !== 'object' || data.error) return [];

    const results = [];
    for (const [id, item] of Object.entries(data)) {
        if (!item || !item.url) continue;
        let title = (item.title || '')
            .replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '')
            .replace(/Sinhala\s*Subtitles/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        results.push({
            id,
            title: title || item.title,
            rawTitle: item.title,
            url: item.url,
            type: item.type || (item.url.includes('/tvshows/') ? 'tvshows' : 'movies'),
            img: item.img || null,
            year: item.extra?.date || '',
            rating: item.extra?.imdb || '',
            quality: item.extra?.quality || '',
            genres: item.extra?.genres || ''
        });
    }
    return results;
}

// Scraper: Parse TV Show Page and get episodes
async function getTvShowEpisodes(tvUrl) {
    const res = await axios.get(tvUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });
    const $ = cheerio.load(res.data);
    let title = $('h1.entry-title, h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '').replace(/Sinhala\s*Subtitles/gi, '').trim();
    const poster = $("meta[property='og:image']").attr('content') || $('div.poster img, div.post-thumbnail img').first().attr('src');

    const episodes = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (href.includes('/episodes/') && !episodes.some(e => e.url === href)) {
            episodes.push({
                title: text || `Episode ${episodes.length + 1}`,
                url: href
            });
        }
    });

    return { title, poster, episodes };
}

// Scraper: Fetch movie or episode page & parse download links (Pixeldrain, DLServer, GDrive, Direct)
async function getMovieDetails(pageUrl) {
    const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });
    const $ = cheerio.load(res.data);

    let title = $('h1.entry-title, h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/\|\s*සිංහල\s*උපසිරසි\s*සමඟ/gi, '').replace(/Sinhala\s*Subtitles/gi, '').trim();

    const poster = $("meta[property='og:image']").attr('content') || $('div.poster img, div.post-thumbnail img').first().attr('src');
    const desc = $('div.entry-content p, div.wp-content p, div.description p, .overview p').first().text().trim();
    const rating = $('span.rating, .imdb-rating, .starstruck-rating').first().text().trim();

    const downloadOptions = [];

    // Parse all server tables (Pixeldrain, DLServer-01, DLServer-02, GDrive, etc.)
    $('.links-table tr, table tr').each((i, row) => {
        const tableId = $(row).closest('table').attr('id') || 'Server';
        // ignore telegram or subtitle-only tables if wanted
        if (tableId.toLowerCase().includes('subtitle')) return;

        const quality = $(row).find('.zm-q').text().trim() || $(row).find('strong, .quality').text().trim() || 'Download';
        const size = $(row).find('.zm-m-size').text().trim();
        const a = $(row).find('a.zm-dl-btn, a');
        const link = a.attr('href');
        if (link && (link.includes('/links/') || link.includes('drive.google') || link.includes('pixeldrain'))) {
            downloadOptions.push({
                server: tableId,
                quality: quality,
                size: size || '',
                linkPageUrl: link
            });
        }
    });

    return {
        title,
        poster,
        rating,
        desc,
        downloadOptions
    };
}

// Scraper: Resolve the intermediate link page to direct link or GDrive link
async function resolveIntermediateLink(linkPageUrl) {
    if (linkPageUrl.includes('drive.google.com') || linkPageUrl.includes('pixeldrain.com/api/file/')) {
        return linkPageUrl;
    }
    const res = await axios.get(linkPageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });
    const match = res.data.match(/var\s+zluFinalLink\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        let finalUrl = match[1].trim();
        if (finalUrl.includes('pixeldrain.com/u/')) {
            finalUrl = finalUrl.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
        }
        return finalUrl;
    }
    return null;
}

// ════════════════════════════════════════════════════════
// 🚀 PLUGIN DEFINITION
// ════════════════════════════════════════════════════════

module.exports = {
    name: 'sinhalasub',
    description: 'Sinhala Subbed movies & TV Series directly from Sinhalasub.lk',
    category: 10,
    commands: ['sinhalasub', 'sindet', 'sindl', 'sin_ep', 'sinsend'],
    hidden: false,

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            // ════════════════════════════════════════════════════
            // 1️⃣ SEARCH COMMAND (.sinhalasub <movie/tv name> [target_jid])
            // ════════════════════════════════════════════════════
            if (command === 'sinhalasub') {
                const fullText = args.join(' ').trim();
                if (!fullText) {
                    return reply(
                        "🎬 *SINHALASUB MOVIE & TV SEARCH*\n\n" +
                        "💡 *භාවිතය:* `.sinhalasub <movie/tv show name>`\n" +
                        "💡 *Group/Chat JID වෙත යැවීමට:* `.sinhalasub <name> <group_jid>`\n\n" +
                        "📌 *උදාහරණ:*\n" +
                        "• `.sinhalasub Spider-Man`\n" +
                        "• `.sinhalasub Game of Thrones`\n" +
                        "• `.sinhalasub Avatar 12036304@g.us`"
                    );
                }

                const { query, targetJid } = parseTargetJid(fullText);
                if (!query) return reply("⚠️ *කරුණාකර සොයන චිත්‍රපටියේ හෝ TV Series නම ඇතුළත් කරන්න!*");

                try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

                const results = await searchSinhalasub(query);
                if (!results || results.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`🤷‍♀️ *"${query}" සඳහා කිසිදු ප්‍රතිඵලයක් Sinhalasub.lk හි හමු නොවීය!*`);
                }

                const displayResults = results.slice(0, 20);

                let caption =
                    `*乂 S A D E W - M I N I 乂*\n\n` +
                    `*🔍 Sinhalasub.lk Search*\n` +
                    `*🔎 Results for:* _${query}_\n` +
                    `*🔢 Total Matches:* ${displayResults.length}\n`;

                if (targetJid) {
                    caption += `*🎯 Forward Target:* \`${targetJid}\`\n`;
                }

                caption += `\n> *👇 පහතින් ඔබට අවශ්‍ය Movie / TV Show එක තෝරන්න:*`;

                const buttons = displayResults.map((item, idx) => {
                    const shortKey = crypto.randomBytes(3).toString('hex');
                    global.sinhalasubCache[shortKey] = {
                        url: item.url,
                        title: item.title,
                        type: item.type,
                        targetJid: targetJid,
                        img: item.img || null,
                        rating: item.rating || '',
                        desc: ''
                    };
                    const typeEmoji = item.type === 'tvshows' ? '📺' : '🎬';
                    const label = `${idx + 1}. ${typeEmoji} ${item.title}`.slice(0, 24);
                    return {
                        buttonId: `.sindet ${shortKey}`,
                        buttonText: { displayText: label },
                        type: 1
                    };
                });

                const firstThumb = displayResults[0].img || 'https://sinhalasub.lk/wp-content/uploads/2025/10/cropped-app-modified-1.png';

                await socket.sendMessage(sender, {
                    image: { url: firstThumb },
                    caption: caption,
                    footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
                    buttons: buttons,
                    headerType: 4
                }, { quoted: msg });

                try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            }

            // ════════════════════════════════════════════════════
            // 2️⃣ DETAILS / TV SHOW EPISODE LIST (.sindet <shortKey>)
            // ════════════════════════════════════════════════════
            if (command === 'sindet') {
                const shortKey = args[0];
                if (!shortKey || !global.sinhalasubCache[shortKey]) {
                    return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.*");
                }

                const cached = global.sinhalasubCache[shortKey];
                const pageUrl = cached.url;
                const movieTitle = cached.title;
                const targetJid = cached.targetJid;
                const isTv = cached.type === 'tvshows' || pageUrl.includes('/tvshows/');

                try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

                // If TV Show, fetch and display episode buttons!
                if (isTv) {
                    const tvData = await getTvShowEpisodes(pageUrl);
                    if (!tvData.episodes || tvData.episodes.length === 0) {
                        return reply(`❌ *"${movieTitle}" සඳහා Episodes සොයා ගැනීමට නොහැකි විය!*`);
                    }

                    let caption =
                        `*📺 TV SERIES:* ${tvData.title || movieTitle}\n` +
                        `*🔢 Total Episodes:* ${tvData.episodes.length}\n`;
                    if (targetJid) caption += `*🎯 SEND TO:* \`${targetJid}\`\n`;
                    caption += `\n> *👇 පහතින් ඔබට අවශ්‍ය Episode එක තෝරන්න:*`;

                    const thumb = tvData.poster || cached.img || 'https://sinhalasub.lk/wp-content/uploads/2025/10/cropped-app-modified-1.png';

                    const epButtons = tvData.episodes.slice(0, 20).map((ep, idx) => {
                        const epKey = crypto.randomBytes(3).toString('hex');
                        global.sinhalasubCache[epKey] = {
                            url: ep.url,
                            title: `${tvData.title || movieTitle} - ${ep.title}`,
                            type: 'episode',
                            targetJid: targetJid,
                            img: thumb,
                            rating: cached.rating || '',
                            desc: ''
                        };
                        const label = `${idx + 1}. ${ep.title}`.slice(0, 24);
                        return {
                            buttonId: `.sindet ${epKey}`,
                            buttonText: { displayText: label },
                            type: 1
                        };
                    });

                    await socket.sendMessage(sender, {
                        image: { url: thumb },
                        caption: caption,
                        footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
                        buttons: epButtons,
                        headerType: 4
                    }, { quoted: msg });

                    try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                    return;
                }

                // If Movie or single Episode, fetch Quality Download options
                const details = await getMovieDetails(pageUrl);

                if (!details.downloadOptions || details.downloadOptions.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`❌ *"${movieTitle}" සඳහා බාගත හැකි Download ලින්ක් හමු නොවීය!*`);
                }

                let caption =
                    `*🎬 TITLE:* ${details.title || movieTitle}\n`;
                if (details.rating) caption += `*⭐ RATING:* ${details.rating}\n`;
                if (targetJid) caption += `*🎯 SEND TO:* \`${targetJid}\`\n`;
                caption += `\n> *👇 පහතින් ඔබට අවශ්‍ය Quality / Server එක තෝරන්න:*`;

                const thumb = details.poster || cached.img || 'https://sinhalasub.lk/wp-content/uploads/2025/10/cropped-app-modified-1.png';

                const buttons = details.downloadOptions.slice(0, 10).map((opt) => {
                    const dlKey = crypto.randomBytes(3).toString('hex');
                    global.sinhalasubCache[dlKey] = {
                        linkPageUrl: opt.linkPageUrl,
                        title: details.title || movieTitle,
                        quality: opt.quality,
                        size: opt.size,
                        targetJid: targetJid,
                        img: thumb,
                        rating: details.rating || cached.rating || '',
                        desc: details.desc || ''
                    };
                    const srvTag = opt.server && opt.server !== 'Server' ? ` [${opt.server.slice(0, 8)}]` : '';
                    const btnLabel = `📥 ${opt.quality}${srvTag}`.slice(0, 24);
                    return {
                        buttonId: `.sindl ${dlKey}`,
                        buttonText: { displayText: btnLabel },
                        type: 1
                    };
                });

                await socket.sendMessage(sender, {
                    image: { url: thumb },
                    caption: caption,
                    footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
                    buttons: buttons,
                    headerType: 4
                }, { quoted: msg });

                try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            }

            // ════════════════════════════════════════════════════
            // 3️⃣ DOWNLOAD & STREAM (WITH IN-PLACE MESSAGE EDIT)
            // ════════════════════════════════════════════════════
            if (command === 'sindl') {
                const dlKey = args[0];
                if (!dlKey || !global.sinhalasubCache[dlKey]) {
                    return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.*");
                }

                const cached = global.sinhalasubCache[dlKey];
                const linkPageUrl = cached.linkPageUrl;
                const movieTitle = cached.title;
                const quality = cached.quality || '';
                const sizeInfo = cached.size ? ` [${cached.size}]` : '';
                const destJid = cached.targetJid || sender;

                // Send thumbnail and details card to target group first
                if (cached.targetJid && destJid !== sender) {
                    try {
                        const targetCardText =
                            `*↳ ❝ [🎬  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
                            `🎬 *TITLE:* ${movieTitle}\n` +
                            `🎞️ *QUALITY:* ${quality}${sizeInfo}\n` +
                            (cached.rating ? `⭐ *RATING:* ${cached.rating}\n` : '') +
                            (cached.desc ? `📝 *STORY:* ${cached.desc.slice(0, 250)}...\n` : '') +
                            `\n> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆*`;

                        if (cached.img) {
                            await socket.sendMessage(destJid, { image: { url: cached.img }, caption: targetCardText });
                        } else {
                            await socket.sendMessage(destJid, { text: targetCardText });
                        }
                    } catch (cardErr) {
                        console.error('[Sinhalasub] Group card error:', cardErr.message);
                    }
                }

                try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

                // Send initial progress message
                let initialText = cached.targetJid
                    ? `🚀 *[Sinhalasub]* \`${movieTitle} (${quality})\` ඩවුන්ලෝඩ් කර \`${cached.targetJid}\` වෙත යවමින් පවතී... (කරුණාකර රැඳී සිටින්න)`
                    : `📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*_ \n*${movieTitle} (${quality})* Movie එක බාගත වෙමින් පවතී... (කරුණාකර රැඳී සිටින්න)`;

                let progressMsg = await socket.sendMessage(sender, { text: initialText }, { quoted: msg });

                async function updateProgress(newText) {
                    if (progressMsg && progressMsg.key) {
                        try {
                            await socket.sendMessage(sender, { text: newText, edit: progressMsg.key });
                            return;
                        } catch (_) {}
                    }
                    reply(newText);
                }

                // 1. Resolve final direct link from intermediate page
                let directUrl = await resolveIntermediateLink(linkPageUrl);
                if (!directUrl) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return await updateProgress(`❌ *Download link එක ලබා ගැනීමට නොහැකි විය!*\n\n🔗 *Page Link:* ${linkPageUrl}`);
                }

                // If resolved link is Google Drive, use Cloudflare Worker Proxy!
                const gdriveFileId = extractGdriveFileId(directUrl);
                if (gdriveFileId) {
                    directUrl = `https://sadew.sadewrashmika069.workers.dev/download?key=sadew123&id=${gdriveFileId}`;
                }

                let tempFilePath = null;

                try {
                    // RAM-Safe pure stream download
                    const streamRes = await axios({
                        method: 'GET',
                        url: directUrl,
                        responseType: 'stream',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': '*/*'
                        },
                        timeout: 900000
                    });

                    // 2GB Size Check
                    const cl = streamRes.headers['content-length'];
                    const limit2GB = 2 * 1024 * 1024 * 1024;

                    if (cl) {
                        const fileSizeInBytes = parseInt(cl, 10);
                        if (fileSizeInBytes > limit2GB) {
                            streamRes.data.destroy();
                            try { await socket.sendMessage(sender, { react: { text: '⚠️', key: msg.key } }); } catch (_) {}
                            return await updateProgress(
                                `⚠️ *මෙම ගොනුවේ ප්‍රමාණය 2GB ට වඩා වැඩි බැවින් WhatsApp හරහා එවිය නොහැක!* \n` +
                                `*විශාලත්වය:* ${(fileSizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n` +
                                `🔗 *Direct Download Link:*\n${directUrl}`
                            );
                        }
                    }

                    const tempRand = crypto.randomBytes(4).toString('hex');
                    const cleanTitle = movieTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 50).trim();
                    const fileName = `${cleanTitle} (${quality}) SADEW MINI.mp4`;

                    const tempDir = path.join(__dirname, '../temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    tempFilePath = path.join(tempDir, `ssub_${tempRand}.mp4`);

                    const writer = fs.createWriteStream(tempFilePath);
                    streamRes.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', (err) => {
                            streamRes.data.destroy();
                            reject(err);
                        });
                    });

                    // IN-PLACE EDIT: Uploading message! (No extra 2nd message)
                    await updateProgress(`⚙️ *${movieTitle}* WhatsApp වෙත Upload කරමින් පවතී...`);

                    const docCaption =
                        `*↳ ❝ [🎬  ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡  𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
                        `🎬 *TITLE:* ${movieTitle}\n` +
                        `🎞️ *QUALITY:* ${quality}${sizeInfo}\n\n` +
                        `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆*`;

                    // RAM-Safe Stream upload to WhatsApp
                    await socket.sendMessage(destJid, {
                        document: { stream: fs.createReadStream(tempFilePath) },
                        mimetype: 'video/mp4',
                        fileName: fileName,
                        caption: docCaption
                    }, { quoted: (destJid === sender ? msg : undefined) });

                    try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

                    if (destJid !== sender) {
                        await updateProgress(`✅ *[Sinhalasub]* \`${movieTitle}\` සාර්ථකව \`${destJid}\` වෙත යවන ලදී!`);
                    } else {
                        await updateProgress(`✅ *${movieTitle}* සාර්ථකව එවන ලදී!`);
                    }

                } catch (dlErr) {
                    console.error("Sinhalasub Download Error:", dlErr.message);
                    await updateProgress(`❌ *Download කිරීමේදී දෝෂයක් මතු විය!*\n\n🔗 *Direct Link:* ${directUrl}`);
                } finally {
                    if (tempFilePath && fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch (_) {}
                    }
                }
            }

        } catch (globalErr) {
            console.error("Sinhalasub Plugin Global Error:", globalErr);
            reply("❌ *දෝෂයක් මතු විය! කරුණාකර පසුව නැවත උත්සාහ කරන්න.*");
        }
    }
};
