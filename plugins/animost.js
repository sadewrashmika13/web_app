const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'https://animostlk.blogspot.com';

// Global cache for button payloads
if (!global.animostCache) global.animostCache = {};

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

    // 3. Comma fallback
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

// Scraper: Search Blogger feed on animostlk
async function searchAnimost(query) {
    const feedUrl = `${BASE_URL}/feeds/posts/default?alt=json&q=${encodeURIComponent(query)}&max-results=20`;
    const res = await axios.get(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });

    const entries = res.data?.feed?.entry || [];
    const results = [];

    for (const e of entries) {
        const title = e.title?.$t?.trim() || 'Untitled Anime';
        const postUrl = e.link?.find(l => l.rel === 'alternate')?.href || '';
        const content = e.content?.$t || e.summary?.$t || '';

        // Extract thumbnail
        let thumbnail = null;
        if (e['media$thumbnail'] && e['media$thumbnail'].url) {
            thumbnail = e['media$thumbnail'].url.replace(/\/s[0-9]+(-c)?\//, '/w600-h340/');
        } else {
            const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (m) thumbnail = m[1];
        }

        results.push({
            title,
            url: postUrl,
            content,
            thumbnail: thumbnail || 'https://animostlk.blogspot.com/favicon.ico'
        });
    }

    return results;
}

// Scraper: Parse post and extract direct streaming/download links
async function getPostDownloadOptions(postUrl, postContent = '') {
    let htmlContent = postContent;
    let pageHtml = '';
    if (!htmlContent || htmlContent.length < 500) {
        const res = await axios.get(postUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000
        });
        pageHtml = res.data;
        htmlContent = res.data;
    }

    const $ = cheerio.load(htmlContent);
    const options = [];

    // Collect all unique links
    const foundUrls = new Set();
    $('a').each((i, el) => {
        const h = $(el).attr('href');
        if (h) foundUrls.add(h);
    });

    // Also regex match in html for raw worker/archive/cloud links
    const rawMatches = htmlContent.match(/https?:\/\/[^\s"\'<>]+/g) || [];
    for (const r of rawMatches) {
        foundUrls.add(r);
    }

    for (let u of foundUrls) {
        u = u.replace(/&amp;/g, '&');

        // 1. animostlk.sinhalachr.workers.dev Player Links
        if (u.includes('animostlk.sinhalachr.workers.dev')) {
            try {
                const wRes = await axios.get(u, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                    timeout: 10000
                });
                const w$ = cheerio.load(wRes.data);
                const title = w$('title').text().replace(/[-–—]\s*ANIMOSTLK/i, '').trim();

                // Find stream URL
                let streamUrl = w$('source').attr('src');
                if (!streamUrl) {
                    const sm = wRes.data.match(/https?:\/\/prod\.playbookstatic\.com[^\s"\'<>]+/);
                    if (sm) streamUrl = sm[0];
                }

                if (streamUrl) {
                    let quality = 'HD';
                    if (/1080p/i.test(title) || /1080/i.test(u)) quality = '1080p FHD';
                    else if (/720p/i.test(title) || /720/i.test(u)) quality = '720p HD';
                    else if (/480p/i.test(title) || /480/i.test(u)) quality = '480p SD';

                    options.push({
                        label: `${quality} (Direct Stream)`,
                        title: title || 'Anime Video',
                        directUrl: streamUrl,
                        type: 'video'
                    });
                }
            } catch (wErr) {
                console.error("Worker fetch error:", wErr.message);
            }
        }
        // 2. cloud.sinhalachr.workers.dev Direct MP4 Links
        else if (u.includes('cloud.sinhalachr.workers.dev') && u.endsWith('.mp4')) {
            let quality = 'Video';
            if (/1080p/i.test(u)) quality = '1080p FHD';
            else if (/720p/i.test(u)) quality = '720p HD';
            else if (/480p/i.test(u)) quality = '480p SD';

            const cleanFileName = decodeURIComponent(u.split('/').pop() || 'Anime.mp4');
            options.push({
                label: `${quality} [Cloud CDN]`,
                title: cleanFileName,
                directUrl: u,
                type: 'video'
            });
        }
        // 3. archive.org Zip / Rar / MP4 Links
        else if (u.includes('archive.org') && (/\.(zip|rar|mp4|mkv)$/i.test(u.split('?')[0]))) {
            const cleanName = decodeURIComponent(u.split('/').pop() || 'Subtitles.zip');
            const isSub = /\.(zip|rar)$/i.test(u);
            options.push({
                label: isSub ? `📁 Subtitles / Archive` : `🎬 Video File`,
                title: cleanName,
                directUrl: u,
                type: isSub ? 'zip' : 'video'
            });
        }
        // 4. Google Drive Link
        else if (u.includes('drive.google.com/file/d/')) {
            const match = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const proxyUrl = `https://sadew.sadewrashmika069.workers.dev/download?key=sadew123&id=${match[1]}`;
                options.push({
                    label: `Google Drive [Proxy]`,
                    title: `GDrive_Anime_${match[1]}.mp4`,
                    directUrl: proxyUrl,
                    type: 'video'
                });
            }
        }
    }

    return options;
}

// ════════════════════════════════════════════════════════
// 🚀 PLUGIN DEFINITION
// ════════════════════════════════════════════════════════

module.exports = {
    name: 'animost',
    description: 'Sinhala Subbed & Dubbed Anime from AnimostLK',
    category: 10, // TV Series & Movies / Anime
    commands: ['animost', 'animostlk', 'anidl', 'anidet'],
    hidden: false,

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            // ════════════════════════════════════════════════════
            // 1️⃣ SEARCH COMMAND (.animost <anime name> [optional jid])
            // ════════════════════════════════════════════════════
            if (command === 'animost' || command === 'animostlk') {
                const fullText = args.join(' ').trim();
                if (!fullText) {
                    return reply(
                        "🌸 *ANIMOSTLK ANIME SEARCH*\n\n" +
                        "💡 *භාවිතය:* `.animost <anime name>`\n" +
                        "💡 *Group/Chat වෙත යැවීමට:* `.animost <name> <group_jid>`\n\n" +
                        "📌 *උදාහරණ:*\n" +
                        "• `.animost Spirited Away`\n" +
                        "• `.animost Demon Slayer`\n" +
                        "• `.animost Naruto 12036304@g.us`"
                    );
                }

                const { query, targetJid } = parseTargetJid(fullText);
                if (!query) return reply("⚠️ *කරුණාකර Anime එකේ නම ඇතුළත් කරන්න!*");

                try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}

                const results = await searchAnimost(query);
                if (!results || results.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`🤷‍♀️ *"${query}" සඳහා කිසිදු Anime එකක් AnimostLK හි හමු නොවීය!*`);
                }

                const displayResults = results.slice(0, 20);

                let caption =
                    `*乂 S A D E W - M I N I 乂*\n\n` +
                    `*🌸 AnimostLK Anime Search*\n` +
                    `*🔎 Results for:* _${query}_\n` +
                    `*🔢 Total Matches:* ${displayResults.length}\n`;

                if (targetJid) {
                    caption += `*🎯 Forward Target:* \`${targetJid}\`\n`;
                }

                caption += `\n> *👇 පහතින් ඔබට අවශ්‍ය Anime එක තෝරන්න:*`;

                const buttons = displayResults.map((item, idx) => {
                    const shortKey = crypto.randomBytes(3).toString('hex');
                    global.animostCache[shortKey] = {
                        url: item.url,
                        title: item.title,
                        content: item.content,
                        targetJid: targetJid
                    };
                    const label = `${idx + 1}. ${item.title}`.slice(0, 24);
                    return {
                        buttonId: `.anidet ${shortKey}`,
                        buttonText: { displayText: label },
                        type: 1
                    };
                });

                const thumb = displayResults[0].thumbnail;

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
            // 2️⃣ DETAILS & QUALITY SELECTION COMMAND (.anidet <shortKey>)
            // ════════════════════════════════════════════════════
            if (command === 'anidet') {
                const shortKey = args[0];
                if (!shortKey || !global.animostCache[shortKey]) {
                    return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.*");
                }

                const cached = global.animostCache[shortKey];
                const postUrl = cached.url;
                const animeTitle = cached.title;
                const targetJid = cached.targetJid;

                try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (_) {}

                const options = await getPostDownloadOptions(postUrl, cached.content);

                if (!options || options.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`❌ *"${animeTitle}" සඳහා බාගත හැකි Direct Download ලින්ක් හමු නොවීය!*`);
                }

                let caption =
                    `*🌸 ANIME:* ${animeTitle}\n`;
                if (targetJid) caption += `*🎯 SEND TO:* \`${targetJid}\`\n`;
                caption += `\n> *👇 පහතින් ඔබට අවශ්‍ය Quality / File එක තෝරන්න:*`;

                const buttons = options.slice(0, 10).map((opt) => {
                    const dlKey = crypto.randomBytes(3).toString('hex');
                    global.animostCache[dlKey] = {
                        directUrl: opt.directUrl,
                        title: opt.title || animeTitle,
                        label: opt.label,
                        type: opt.type,
                        targetJid: targetJid
                    };
                    const btnLabel = `📥 ${opt.label}`.slice(0, 24);
                    return {
                        buttonId: `.anidl ${dlKey}`,
                        buttonText: { displayText: btnLabel },
                        type: 1
                    };
                });

                await socket.sendMessage(sender, {
                    text: caption,
                    footer: '🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮',
                    buttons: buttons,
                    headerType: 1
                }, { quoted: msg });

                try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            }

            // ════════════════════════════════════════════════════
            // 3️⃣ DOWNLOAD & STREAM (WITH IN-PLACE MESSAGE EDIT)
            // ════════════════════════════════════════════════════
            if (command === 'anidl') {
                const dlKey = args[0];
                if (!dlKey || !global.animostCache[dlKey]) {
                    return reply("⚠️ *සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත සර්ච් කරන්න.*");
                }

                const cached = global.animostCache[dlKey];
                const directUrl = cached.directUrl;
                const animeTitle = cached.title;
                const destJid = cached.targetJid || sender;

                try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

                // Send initial progress message
                let initialText = cached.targetJid
                    ? `🚀 *[AnimostLK]* \`${animeTitle}\` ඩවුන්ලෝඩ් කර \`${cached.targetJid}\` වෙත යවමින් පවතී... (කරුණාකර රැඳී සිටින්න)`
                    : `📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*_ \n*${animeTitle}* බාගත වෙමින් පවතී... (කරුණාකර රැඳී සිටින්න)`;

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
                    let cleanTitle = animeTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 60).trim();
                    const ext = cached.type === 'zip' ? 'zip' : 'mp4';
                    if (!cleanTitle.toLowerCase().endsWith('.' + ext)) {
                        cleanTitle += `.${ext}`;
                    }
                    const fileName = `${cleanTitle}`;

                    const tempDir = path.join(__dirname, '../temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    tempFilePath = path.join(tempDir, `anm_${tempRand}_${fileName}`);

                    const writer = fs.createWriteStream(tempFilePath);
                    streamRes.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', (err) => {
                            streamRes.data.destroy();
                            reject(err);
                        });
                    });

                    // IN-PLACE EDIT: Uploading message!
                    await updateProgress(`⚙️ *${fileName}* WhatsApp වෙත Upload කරමින් පවතී...`);

                    const docCaption =
                        `*↳ ❝ [🌸 🎬 ANIMOSTLK ANIME 🎬 🌸] ¡! ❞*\n\n` +
                        `🌸 *TITLE:* ${animeTitle}\n\n` +
                        `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮 𝜗𝜚⋆*`;

                    const mime = ext === 'zip' ? 'application/zip' : 'video/mp4';

                    await socket.sendMessage(destJid, {
                        document: { stream: fs.createReadStream(tempFilePath) },
                        mimetype: mime,
                        fileName: fileName,
                        caption: docCaption
                    }, { quoted: (destJid === sender ? msg : undefined) });

                    try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

                    if (destJid !== sender) {
                        await updateProgress(`✅ *[AnimostLK]* \`${fileName}\` සාර්ථකව \`${destJid}\` වෙත යවන ලදී!`);
                    } else {
                        await updateProgress(`✅ *${fileName}* සාර්ථකව එවන ලදී!`);
                    }

                } catch (dlErr) {
                    console.error("AnimostLK Download Error:", dlErr.message);
                    await updateProgress(`❌ *Download කිරීමේදී දෝෂයක් මතු විය!*\n\n🔗 *Direct Link:* ${directUrl}`);
                } finally {
                    if (tempFilePath && fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch (_) {}
                    }
                }
            }

        } catch (globalErr) {
            console.error("Animost Plugin Global Error:", globalErr);
            reply("❌ *දෝෂයක් මතු විය! කරුණාකර පසුව නැවත උත්සාහ කරන්න.*");
        }
    }
};
