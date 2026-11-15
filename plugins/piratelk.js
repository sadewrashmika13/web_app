const os = require('os');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// Global store for PirateLK
if (!global.plkStore) global.plkStore = {};

function genId() { 
    return crypto.randomBytes(4).toString('hex'); 
}

function storeData(data, ttlMs = 60 * 60 * 1000) { 
    const id = genId();
    global.plkStore[id] = data;
    setTimeout(() => { delete global.plkStore[id]; }, ttlMs);
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

async function fetchHtml(url) {
    try {
        const { gotScraping } = await import('got-scraping');
        const res = await gotScraping(url);
        return res.body;
    } catch (importErr) {
        console.warn("[PirateLK] got-scraping fallback to axios:", importErr.message);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 25000
        });
        return res.data;
    }
}

// Target JID parser (supports comma, pipe, or space delimited phone / JID)
function parseTarget(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    // Matches JID (@g.us, @s.whatsapp.net) or phone at the end (with space, comma, or pipe)
    const endMatch = raw.match(/(?:,|\s+|\|)+([0-9]{9,15}@s\.whatsapp\.net|[0-9]{15,30}@g\.us|\+?94[0-9]{9}|0[0-9]{9})$/i);
    if (endMatch) {
        let extracted = endMatch[1];
        let matchStr = endMatch[0];
        let matchIndex = raw.lastIndexOf(matchStr);
        if (matchIndex !== -1) query = raw.substring(0, matchIndex).trim();
        
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
    query = query.replace(/[,|]$/, '').trim();
    return { query, targetJid };
}

function extractGdriveFileId(url) {
    if (!url) return null;
    if (url.includes('/drive/folders/') || url.includes('/folders/')) return null;
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) || 
              url.match(/[?&]id=([a-zA-Z0-9_-]+)/i) || 
              url.match(/\/open\?id=([a-zA-Z0-9_-]+)/i) ||
              url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/i) ||
              url.match(/\/d\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
}

module.exports = {
    name: "piratelk-downloader",
    category: 10,
    description: "Search and download Sinhala Subbed Movies & TV Series from PirateLK",
    commands: ["pirate", "piratelk", "plk", "plk_sel", "plk_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const BASE_URL = "https://piratelk.com";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_PLK" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew PirateLK\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const tempDir = getTempDir();
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // ════════════════════════════════════════════════════════
        // 1. SEARCH (.pirate / .piratelk / .plk)
        // ════════════════════════════════════════════════════════
        if (command === "pirate" || command === "piratelk" || command === "plk") {
            const rawText = args.join(" ").trim();
            if (!rawText) {
                return reply("🎬 *කරුණාකර Movie හෝ Series එකේ නම ලබා දෙන්න!*\n_උදා: .pirate Batman_\n_උදා: .piratelk Loki 0771234567_\n_උදා: .pirate Inception 120363023456789@g.us_");
            }

            const { query, targetJid } = parseTarget(rawText);
            if (!query) return reply("🎬 *කරුණාකර Movie හෝ Series එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
                const html = await fetchHtml(searchUrl);
                const $ = cheerio.load(html);

                const searchResults = [];
                $('article, .post, .result-item, .item, .entry').each((i, el) => {
                    const titleEl = $(el).find('h2 a, h3 a, .title a, a').first();
                    let title = titleEl.text().replace(/^DOWNLOAD\s+/i, '').trim();
                    let link = titleEl.attr('href');
                    
                    // Avoid SVG placeholder data URLs
                    let img = $(el).find('img').first().attr('data-src') || 
                              $(el).find('img').first().attr('data-lazy-src') || 
                              $(el).find('img').first().attr('src');
                    if (img && img.startsWith('data:')) img = null;

                    if (!title) {
                        const a = $(el).find('a').first();
                        title = a.text().replace(/^DOWNLOAD\s+/i, '').trim();
                        link = a.attr('href');
                    }

                    if (title && link && link.includes('piratelk.com') && !searchResults.some(r => r.link === link)) {
                        if (!link.includes('/category/') && !link.includes('/tag/') && !link.includes('/author/')) {
                            searchResults.push({ title, link, img });
                        }
                    }
                });

                if (searchResults.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply(`❌ *සමාවෙන්න, "${query}" නමින් කිසිවක් PirateLK හි හමුවූයේ නැත.*\n_කරුණාකර නම නිවැරදිව පරීක්ෂා කර නැවත උත්සාහ කරන්න._`);
                }

                // Return FULL results without button limit as requested!
                const allResults = searchResults;
                let listText = `*↳ ❝ [🎬 𝗣𝗜𝗥𝗔𝗧𝗘𝗟𝗞 𝗦𝗘𝗔𝗥𝗖𝗛 🎬] ¡! ❞*\n\n`;
                listText += `🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${allResults.length}\n`;
                if (targetJid) listText += `🎯 *Send To:* \`${targetJid}\`\n\n`; else listText += `\n`;

                const buttons = [];
                allResults.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n\n`;
                    const id = storeData({
                        url: mv.link,
                        title: mv.title,
                        img: mv.img,
                        targetJid: targetJid
                    });

                    // Clean button label
                    let btnLabel = mv.title.replace(/\s*\|.*$/i, '').replace(/\s*\[.*$/i, '').replace(/\(Complete\)/i, '').trim();
                    if (btnLabel.length > 20) btnLabel = btnLabel.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.plk_sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${btnLabel}` },
                        type: 1
                    });
                });

                listText += `> *📩 ඔබට අවශ්‍ය Movie/Series එක පහලින් තෝරන්න*\n> *👑 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // Set 1st result's thumbnail/image as requested!
                const firstThumb = allResults.find(r => r.img && !r.img.startsWith('data:'))?.img || null;

                if (firstThumb) {
                    await socket.sendMessage(sender, {
                        image: { url: firstThumb },
                        caption: listText,
                        footer: botName,
                        buttons: buttons,
                        headerType: 4
                    }, { quoted: metaQuote });
                } else {
                    await socket.sendMessage(sender, {
                        text: listText,
                        footer: botName,
                        buttons: buttons,
                        headerType: 1
                    }, { quoted: metaQuote });
                }

                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (err) {
                console.error("[PirateLK Search Error]:", err.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Search කිරීමේදී දෝෂයක් ඇතිවිය:* ${err.message}`);
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. MOVIE / SERIES DETAILS (.plk_sel <id>)
        // ════════════════════════════════════════════════════════
        else if (command === "plk_sel") {
            const id = args[0];
            const cached = global.plkStore[id];
            if (!cached) return reply("❌ *Expired session. කරුණාකර නැවත search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const html = await fetchHtml(cached.url);
                const $ = cheerio.load(html);

                const title = $('h1.entry-title, h1.post-title, h1').first().text().replace(/^DOWNLOAD\s+/i, '').trim() || cached.title;
                
                // Real high-res poster extraction (bypassing SVG lazyload placeholders)
                let poster = $('meta[property="og:image"]').attr('content') || 
                             $('meta[name="twitter:image"]').attr('content');

                if (!poster || poster.startsWith('data:')) {
                    $('article img, .entry-content img, .post-thumbnail img').each((i, el) => {
                        if (poster && !poster.startsWith('data:')) return;
                        const candidate = $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src');
                        if (candidate && !candidate.startsWith('data:') && !candidate.includes('logo') && !candidate.includes('dmca')) {
                            poster = candidate;
                        }
                    });
                }

                if (!poster || poster.startsWith('data:')) {
                    poster = cached.img;
                }
                
                // Synopsis / Story
                let story = '';
                $('.entry-content p, .post-content p').each((i, el) => {
                    const text = $(el).text().trim();
                    if (!story && text.length > 50 && !text.includes('DOWNLOAD') && !text.includes('1080p') && !text.includes('720p') && !text.includes('Password:')) {
                        story = text;
                    }
                });

                // Parse download links
                const downloadLinks = [];
                const seenUrls = new Set();

                $('a').each((i, el) => {
                    let href = $(el).attr('href') || '';
                    const linkText = $(el).text().trim();
                    const parentText = $(el).parent().text().trim();
                    const lowerHref = href.toLowerCase();

                    // 🚫 STRICTLY HIDE UsersDrive, Racaty, Uptobox, Verystream and other dead hosts!
                    if (lowerHref.includes('usersdrive.com') || parentText.toLowerCase().includes('usersdrive') || linkText.toLowerCase().includes('usersdrive')) {
                        return;
                    }
                    if (lowerHref.includes('racaty.net') || lowerHref.includes('racaty.com') || lowerHref.includes('uptobox.com') ||
                        lowerHref.includes('verystream.com') || lowerHref.includes('openload') || lowerHref.includes('streamango') || lowerHref.includes('rapidgator') || lowerHref.includes('nitroflare')) {
                        return;
                    }

                    const isMega = lowerHref.includes('mega.nz') || lowerHref.includes('mega.io');
                    const isGdrive = lowerHref.includes('drive.google.com') || lowerHref.includes('drive.usercontent.google.com');
                    const isPixel = lowerHref.includes('pixeldrain.com');
                    const isDirectVid = (lowerHref.endsWith('.mp4') || lowerHref.endsWith('.mkv')) && lowerHref.startsWith('http');

                    if ((isMega || isGdrive || isPixel || isDirectVid) && !seenUrls.has(href)) {
                        seenUrls.add(href);

                        let host = 'Direct';
                        let hostIcon = '🎥';
                        let isFolder = false;

                        if (isMega) {
                            host = 'Mega';
                            hostIcon = '☁️';
                            if (lowerHref.includes('/folder/') || lowerHref.includes('#f!')) isFolder = true;
                        } else if (isGdrive) {
                            host = 'GDrive';
                            hostIcon = '⚡';
                            if (lowerHref.includes('/folders/')) isFolder = true;
                        } else if (isPixel) {
                            host = 'PixelDrain';
                            hostIcon = '📦';
                        }

                        let quality = '';
                        const qMatch = (linkText + ' ' + parentText).match(/(480p|720p|1080p|2160p|4k|bluray|webrip|hdrip|psa|hdtv)/i);
                        if (qMatch) quality = qMatch[1].toUpperCase();

                        let size = '';
                        const sMatch = (linkText + ' ' + parentText).match(/([0-9]+(?:\.[0-9]+)?\s*(?:MB|GB))/i);
                        if (sMatch) size = sMatch[1].toUpperCase();

                        let btnLabel = '';
                        if (isFolder) {
                            btnLabel = `📁 ${host} Folder ${size ? '(' + size + ')' : ''}`.trim();
                        } else if (quality && size) {
                            btnLabel = `${hostIcon} ${quality} (${size}) - ${host}`;
                        } else if (quality) {
                            btnLabel = `${hostIcon} ${quality} - ${host}`;
                        } else if (size) {
                            btnLabel = `${hostIcon} ${host} (${size})`;
                        } else {
                            btnLabel = `${hostIcon} Download (${host})`;
                        }

                        downloadLinks.push({
                            label: btnLabel,
                            host: host,
                            quality: quality || 'HD',
                            size: size,
                            url: href,
                            isFolder: isFolder
                        });
                    }
                });

                if (downloadLinks.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                    return reply(`⚠️ *මෙම චිත්‍රපටය සඳහා සෘජුව බාගත හැකි MEGA හෝ Google Drive Links හමු නොවිණි.*\n_(UsersDrive, Uptobox, Verystream සහ Racaty links සෘජුව stream කිරීමට නොහැකි බැවින් ඉවත් කර ඇත)_`);
                }

                let cardText = `*↳ ❝ [🎬 𝗣𝗜𝗥𝗔𝗧𝗘𝗟𝗞 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 🎬] ¡! ❞*\n\n`;
                cardText += `🎬 *Title:* ${title}\n`;
                cardText += `🌐 *Available Servers:* ${[...new Set(downloadLinks.map(d => d.host))].join(', ')}\n`;
                if (cached.targetJid) cardText += `🎯 *Send To:* \`${cached.targetJid}\`\n`;
                if (story) cardText += `\n📝 *Synopsis:* _${story.slice(0, 180)}..._\n`;
                cardText += `\n> *👇 ඔබට අවශ්‍ය Download Option එක පහලින් තෝරන්න* ⬇️`;

                const buttons = [];
                downloadLinks.forEach((dl) => {
                    const linkId = storeData({
                        title: title,
                        quality: dl.quality,
                        size: dl.size,
                        host: dl.host,
                        url: dl.url,
                        poster: poster,
                        story: story,
                        isFolder: dl.isFolder,
                        targetJid: cached.targetJid
                    });

                    let label = dl.label;
                    if (label.length > 20) label = label.slice(0, 18) + '..';

                    buttons.push({
                        buttonId: `.plk_dl ${linkId}`,
                        buttonText: { displayText: label },
                        type: 1
                    });
                });

                const msgOpts = {
                    caption: cardText,
                    footer: botName,
                    buttons: buttons,
                    headerType: (poster && !poster.startsWith('data:')) ? 4 : 1
                };
                if (poster && !poster.startsWith('data:')) msgOpts.image = { url: poster };

                await socket.sendMessage(sender, msgOpts, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (e) {
                console.error("[PirateLK] Details Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *විස්තර ලබාගැනීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. STREAM & DOWNLOAD (.plk_dl <linkId>)
        // ════════════════════════════════════════════════════════
        else if (command === "plk_dl") {
            const linkId = args[0];
            const item = global.plkStore[linkId];
            if (!item) return reply("❌ *Link expired. කරුණාකර නැවත search කරන්න.*");

            const destJid = item.targetJid || sender;
            let tempFilePath = null;

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

                // 1. If sending to external target JID: send details card first!
                if (destJid !== sender) {
                    const cardText = `*↳ ❝ [🎬 𝗣𝗜𝗥𝗔𝗧𝗘𝗟𝗞 𝗠𝗢𝗩𝗜𝗘 🎬] ¡! ❞*\n\n` +
                        `🎬 *Title:* ${item.title}\n` +
                        `🎞️ *Quality:* ${item.quality || 'HD'}\n` +
                        (item.size ? `📦 *Size:* ${item.size}\n` : '') +
                        (item.story ? `\n📝 *Synopsis:* _${item.story.slice(0, 220)}..._\n` : '') +
                        `\n> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;
                    try {
                        if (item.poster && !item.poster.startsWith('data:')) {
                            await socket.sendMessage(destJid, { image: { url: item.poster }, caption: cardText }, { quoted: metaQuote });
                        } else {
                            await socket.sendMessage(destJid, { text: cardText }, { quoted: metaQuote });
                        }
                    } catch (cardErr) {
                        console.error("[PirateLK] Target Card Error:", cardErr.message);
                    }
                }

                await socket.sendMessage(sender, { react: { text: "📥", key: msg.key } });
                await reply(`📥 *Download ආරම්භ වේ...*\n🎬 *${item.title}*\n📡 *Server:* ${item.host} (${item.quality})\n\n_File ප්‍රමාණය අනුව යැවීමට මිනිත්තු කිහිපයක් ගතවිය හැක._`);

                const randId = crypto.randomBytes(4).toString('hex');
                const cleanTitle = item.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50).trim();
                let fileName = `${cleanTitle} (${item.quality || 'HD'}) SADEW MINI.mkv`;
                let formattedSize = item.size || 'Unknown';

                // A. MEGA DOWNLOAD STREAM (SAFE & FAST 4-CONNECTION ENGINE)
                if (item.url.includes('mega.nz') || item.url.includes('mega.io')) {
                    const { File } = require('megajs');
                    let file = File.fromURL(item.url);

                    try {
                        await Promise.race([
                            file.loadAttributes(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error("MEGA Server එක සමඟ සම්බන්ධ වීමේ කාලය ඉක්මවා ගියේය (Timeout).")), 25000))
                        ]);
                    } catch (attrErr) {
                        const msgStr = (attrErr.message || '').toUpperCase();
                        if (msgStr.includes('ETOOMANY') || msgStr.includes('-6')) {
                            throw new Error("මෙම MEGA File එකට මෙම අවස්ථාවේදී අධික පිරිසක් එකවර බාගත කිරීමට උත්සාහ කරන බැවින් MEGA ආයතනය මගින් තාවකාලිකව සීමා කර ඇත (ETOOMANY -6). කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න හෝ වෙනත් පිටපතක් තෝරන්න.");
                        }
                        if (msgStr.includes('EBLOCKED') || msgStr.includes('-16')) {
                            throw new Error("මෙම MEGA File එක MEGA ආයතනය මගින් Copyright හේතුවෙන් Block කර ඇත (EBLOCKED). කරුණාකර වෙනත් පිටපතක් තෝරන්න.");
                        }
                        if (msgStr.includes('ENOENT') || msgStr.includes('-9')) {
                            throw new Error("මෙම File එක MEGA වෙතින් සම්පූර්ණයෙන්ම ඉවත් කර ඇත (Deleted).");
                        }
                        throw attrErr;
                    }

                    // Check if it's a MEGA Folder
                    if (file.directory) {
                        const validChildren = (file.children || []).filter(c => !c.directory && (c.size > 0 || c.name));
                        if (validChildren.length === 0) {
                            throw new Error("මෙම MEGA Folder එක හිස් (Empty) හෝ එහි ඇති Files ඉවත් කර ඇත.");
                        }
                        // Choose video file
                        const videoFiles = validChildren.filter(c => /\.(mp4|mkv|avi|mov|webm)$/i.test(c.name));
                        file = videoFiles.length > 0 ? videoFiles[0] : validChildren[0];
                    }

                    const fileSize = file.size || 0;
                    if (fileSize > 2 * 1024 * 1024 * 1024) {
                        await socket.sendMessage(sender, { react: { text: "⚠️", key: msg.key } });
                        return reply(`⚠️ *මෙම File එක 2GB සීමාව ඉක්මවයි (${formatBytes(fileSize)})! WhatsApp හරහා 2GB ට වැඩි files එවිය නොහැක.*`);
                    }

                    formattedSize = formatBytes(fileSize);
                    const ext = (file.name && file.name.endsWith('.mp4')) ? '.mp4' : '.mkv';
                    fileName = `${cleanTitle} (${item.quality || 'HD'})${ext}`;
                    tempFilePath = path.join(tempDir, `plk_${randId}${ext}`);

                    console.log(`[PirateLK Mega Stream] Streaming: ${file.name} (${formattedSize}) to disk`);
                    const writer = fs.createWriteStream(tempFilePath);

                    // Safe 4 connections with 4MB chunks (fast and immune to ETOOMANY)
                    const megaStream = file.download({
                        maxConnections: 4,
                        initialChunkSize: 1024 * 1024,
                        maxChunkSize: 4 * 1024 * 1024
                    });

                    try {
                        await pipeline(megaStream, writer);
                    } catch (pipeErr) {
                        const pMsg = (pipeErr.message || '').toUpperCase();
                        if (pMsg.includes('ETOOMANY') || pMsg.includes('-6')) {
                            throw new Error("මෙම MEGA File එකට මෙම අවස්ථාවේදී අධික පිරිසක් එකවර බාගත කිරීමට උත්සාහ කරන බැවින් MEGA ආයතනය මගින් තාවකාලිකව සීමා කර ඇත (ETOOMANY -6). කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න හෝ වෙනත් පිටපතක් තෝරන්න.");
                        }
                        throw pipeErr;
                    }
                }
                // B. GOOGLE DRIVE DOWNLOAD STREAM
                else if (item.url.includes('drive.google.com') || item.url.includes('drive.usercontent.google.com')) {
                    if (item.url.includes('/drive/folders/') || item.url.includes('/folders/')) {
                        throw new Error("මෙය Google Drive Folder එකකි. Folder එකක් සෘජුව stream කළ නොහැක. කරුණාකර තනි Video file එකක link එකක් තෝරන්න.");
                    }

                    const gdriveId = extractGdriveFileId(item.url);
                    if (!gdriveId) {
                        throw new Error("Google Drive File ID හඳුනාගත නොහැකි විය. කරුණාකර වෙනත් Download Server එකක් තෝරන්න.");
                    }

                    let streamUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0`;
                    let requestHeaders = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    };

                    let checkRes;
                    try {
                        checkRes = await axios.get(streamUrl, {
                            headers: requestHeaders,
                            maxRedirects: 5,
                            timeout: 25000,
                            validateStatus: status => status < 500
                        });
                    } catch (chkErr) {
                        if (chkErr.response && chkErr.response.status === 403) {
                            throw new Error("Google Drive බාගත කිරීමේ සීමාව (Daily Download Quota) ඉක්මවා ඇත (403 Forbidden). කරුණාකර MEGA Server එක භාවිත කරන්න.");
                        }
                        throw chkErr;
                    }

                    if (checkRes.status === 403) {
                        throw new Error("Google Drive බාගත කිරීමේ සීමාව (Daily Download Quota) ඉක්මවා ඇත (403 Forbidden). කරුණාකර MEGA Server එක භාවිත කරන්න.");
                    }

                    const ct = (checkRes.headers['content-type'] || '').toLowerCase();
                    if (ct.includes('text/html')) {
                        const html = checkRes.data;
                        const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i) || html.match(/confirm=([0-9a-zA-Z_-]+)/i);
                        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
                        const cookies = checkRes.headers['set-cookie']
                            ? checkRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
                            : '';

                        const confirmVal = confirmMatch ? confirmMatch[1] : 't';
                        let confirmedUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&authuser=0&confirm=${confirmVal}`;
                        if (uuidMatch) confirmedUrl += `&uuid=${uuidMatch[1]}`;
                        streamUrl = confirmedUrl;
                        if (cookies) requestHeaders['Cookie'] = cookies;
                    }

                    let streamRes;
                    try {
                        streamRes = await axios({
                            method: 'GET',
                            url: streamUrl,
                            headers: requestHeaders,
                            responseType: 'stream',
                            timeout: 1800000,
                            maxRedirects: 10
                        });
                    } catch (sErr) {
                        if (sErr.response && sErr.response.status === 403) {
                            throw new Error("Google Drive සීමාව (Download Quota) ඉක්මවා ඇත (403 Forbidden). කරුණාකර MEGA Server එක භාවිත කරන්න.");
                        }
                        throw sErr;
                    }

                    const cl = streamRes.headers['content-length'];
                    if (cl) formattedSize = formatBytes(parseInt(cl, 10));

                    tempFilePath = path.join(tempDir, `plk_${randId}.mkv`);
                    const writer = fs.createWriteStream(tempFilePath);
                    await pipeline(streamRes.data, writer);
                }
                // C. PIXELDRAIN / DIRECT LINK
                else {
                    let directDlUrl = item.url;
                    if (directDlUrl.includes('pixeldrain.com/u/')) {
                        directDlUrl = directDlUrl.replace('/u/', '/api/file/');
                    }

                    let streamRes;
                    try {
                        streamRes = await axios({
                            method: 'GET',
                            url: directDlUrl,
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            responseType: 'stream',
                            timeout: 25000 // 25s connection timeout
                        });
                    } catch (connErr) {
                        if (connErr.code === 'ETIMEDOUT' || connErr.message.includes('timeout') || connErr.message.includes('ETIMEDOUT')) {
                            throw new Error("මෙම Direct Download Server එක ක්‍රියා විරහිතයි හෝ සම්බන්ධ වීමේ කාලය ඉක්මවා ගියේය (Server Timeout / Offline). කරුණාකර MEGA හෝ GDrive පිටපතක් තෝරන්න.");
                        }
                        throw connErr;
                    }

                    const cl = streamRes.headers['content-length'];
                    if (cl) formattedSize = formatBytes(parseInt(cl, 10));

                    tempFilePath = path.join(tempDir, `plk_${randId}.mkv`);
                    const writer = fs.createWriteStream(tempFilePath);
                    await pipeline(streamRes.data, writer);
                }

                // Verify file exists on disk
                if (!tempFilePath || !fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
                    throw new Error("බාගත කළ File එක හිස් (Empty) හෝ බාගත කිරීමට නොහැකි විය.");
                }

                // Upload to WhatsApp as Document Stream (0 RAM heap impact)
                const caption = `*↳ ❝ [🎬 𝗣𝗜𝗥𝗔𝗧𝗘𝗟𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${item.title}\n` +
                    `🎞️ *Quality:* ${item.quality || 'HD'}\n` +
                    `📦 *Size:* ${formattedSize}\n` +
                    `📡 *Source:* PirateLK (${item.host})\n\n` +
                    `> 👑 *𝗦𝗔𝗗𝗘𝗪-𝗠𝗜𝗡𝗜 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗕𝗢𝗧* 👑`;

                await socket.sendMessage(destJid, {
                    document: { stream: fs.createReadStream(tempFilePath) },
                    mimetype: fileName.endsWith('.mp4') ? 'video/mp4' : 'video/x-matroska',
                    fileName: fileName,
                    caption: caption
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                if (destJid !== sender) {
                    await reply(`✅ *${item.title}* සාර්ථකව \`${destJid}\` වෙත යවා අවසන් කරන ලදී!`);
                }

            } catch (e) {
                console.error("[PirateLK Download Error]:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply(`❌ *Download දෝෂයක් ඇතිවිය:* ${e.message}`);
            } finally {
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try { fs.unlinkSync(tempFilePath); } catch (_) {}
                }
                if (global.gc) try { global.gc(); } catch (_) {}
            }
        }
    }
};
