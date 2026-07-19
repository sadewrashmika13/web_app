const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Memory Leak නොවී ඩේටා තියාගන්න Global Store එකක්
if (!global.mbStore) global.mbStore = {};

// GDrive File ID එක හොයන ෆන්ක්ෂන් එක
function extractFileId(url) {
    let match = url.match(/\/file\/d\/([^\/]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return match[1];
    match = url.match(/\/d\/([^\/]+)/);
    if (match) return match[1];
    return null;
}

// 🔥 අලුත් ෆන්ක්ෂන් එක: ලින්ක් එකේ වර්ගය අඳුරගන්නවා
function getLinkType(url) {
    if (!url) return "Unknown";
    url = url.toLowerCase();
    if (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) return "GDrive";
    if (url.includes('t.me')) return "Telegram";
    if (url.includes('pixeldrain.com')) return "Pixeldrain";
    if (url.includes('.workers.dev') || url.match(/\.(mp4|mkv|avi|zip|rar)$/i)) return "Direct";
    return "Web Link";
}

module.exports = {
    name: "baiscopes",
    category: 1,
    description: "Search and download movies with Sinhala Subtitles from Baiscopes",
    commands: ["baiscopes", "baiscope", "bsget", "bslink"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const apikey = "frontoffice9876@gmail.com:vajira-88173";
        const API_BASE = "https://vajiraofc-apis.vercel.app";

        // ==============================================================
        // 1. CHOOSE MOVIE (Baiscopes Search)
        // ==============================================================
        if (command === "baiscopes" || command === "baiscope") {
            const query = args.join(' ').trim();
            if (!query) {
                return reply("🎥 *කරුණාකර චිත්‍රපටයක නමක් ලබා දෙන්න!*\n💡 උදා: `.baiscopes 2026`");
            }

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

                const searchUrl = `${API_BASE}/api/baiscopes/search?apikey=${apikey}&q=${encodeURIComponent(query)}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.results || res.data?.data || [];

                if (!items || items.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply("❌ *සමාවෙන්න, චිත්‍රපටයක් සොයාගත නොහැකි විය!*");
                }

                let listText = `*🔍 SADEW-MINI MOVIE SEARCH*\n\n`;
                let buttons = [];

                items.slice(0, 5).forEach((m, i) => {
                    const title = m.title || 'Unknown Title';
                    const year = m.year || 'N/A';
                    
                    listText += `*${i + 1}.* ${title}\n`;
                    listText += `📅 Year: ${year} | ⭐ IMDb: ${m.imdbRate || 'N/A'}\n\n`;

                    const shortId = crypto.randomBytes(4).toString('hex');
                    global.mbStore[shortId] = { movieUrl: m.url };

                    // විනාඩි 30න් මැකෙනවා
                    setTimeout(() => {
                        if (global.mbStore[shortId]) delete global.mbStore[shortId];
                    }, 30 * 60 * 1000);

                    buttons.push({
                        buttonId: `.bsget ${shortId}`,
                        buttonText: { displayText: `🎬 ${title.substring(0, 18)}...` },
                        type: 1
                    });
                });

                listText += `> *ඔබට අවශ්‍ය නිර්මාණයට අදාළ අංකය පහතින් තෝරන්න.*`;

                const firstCover = items[0]?.image;
                const msgOpts = {
                    caption: listText,
                    footer: "👑 SADEW-MINI 👑",
                    buttons: buttons,
                    headerType: 4
                };
                
                if (firstCover) msgOpts.image = { url: firstCover };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error("Baiscopes Search Error:", e.message);
                try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 2. CHOOSE QUALITY / GET LINKS
        // ==============================================================
        else if (command === "bsget") {
            const shortId = args[0];
            const storedData = global.mbStore[shortId];

            if (!storedData || !storedData.movieUrl) {
                return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

                const detailUrl = `${API_BASE}/api/baiscopes/details?apikey=${apikey}&url=${encodeURIComponent(storedData.movieUrl)}`;
                const res = await axios.get(detailUrl, { timeout: 20000 });

                const downloadLinks = res.data?.data?.downloads || res.data?.downloads || [];

                if (!downloadLinks || downloadLinks.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links දැනට නොමැත.*");
                }

                const movieTitle = res.data?.data?.title || res.data?.title || "Movie";
                const coverUrl = res.data?.data?.image || res.data?.image;

                let qList = `*🎬 SADEW-MINI MOVIE LINKS*\n\n📽️ *${movieTitle}*\n\n`;
                let buttons = [];

                downloadLinks.forEach((dl, i) => {
                    const fileSize = dl.size && dl.size !== 'N/A' ? dl.size : 'Unknown Size';
                    const fileQuality = dl.quality && dl.quality !== 'N/A' ? dl.quality : `Link ${i + 1}`;
                    const fileUrl = dl.url || dl.original_link;

                    if (!fileUrl) return;

                    // 🔥 ලින්ක් එකේ වර්ගය අඳුරගන්නවා
                    const linkType = getLinkType(fileUrl);

                    qList += `*${i + 1}.* ${fileQuality} - ${fileSize} [${linkType}]\n`;

                    const linkId = crypto.randomBytes(4).toString('hex');
                    global.mbStore[linkId] = {
                        url: fileUrl,
                        title: movieTitle,
                        size: fileSize
                    };

                    // විනාඩි 30ක් යනකන් අනිත් ලින්ක් ඔබන්න පුළුවන් වෙන විදිහට තියාගන්නවා
                    setTimeout(() => {
                        if (global.mbStore[linkId]) delete global.mbStore[linkId];
                    }, 30 * 60 * 1000);

                    // 🔥 බටන් එකට ලින්ක් එකේ නම දානවා (උදා: "📥 1. GDrive")
                    buttons.push({
                        buttonId: `.bslink ${linkId}`,
                        buttonText: { displayText: `📥 ${i + 1}. ${linkType}` },
                        type: 1
                    });
                });

                qList += `\n> *ඔබට අවශ්‍ය Link එකට අදාළ අංකය තෝරන්න.*`;

                const msgOpts = {
                    caption: qList,
                    footer: "👑 SADEW-MINI 👑",
                    buttons: buttons,
                    headerType: 4
                };

                if (coverUrl) msgOpts.image = { url: coverUrl };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error("Baiscopes Details Error:", e.message);
                reply("❌ *තොරතුරු ලබාගැනීමට නොහැකි විය!*");
            }
        }

        // ==============================================================
        // 3. AUTO DOWNLOAD (GDRIVE, DIRECT) OR SEND LINK (TELEGRAM/PIXELDRAIN)
        // ==============================================================
        else if (command === "bslink") {
            const shortId = args[0];
            const movieData = global.mbStore[shortId];

            if (!movieData || !movieData.url) {
                return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");
            }

            const url = movieData.url;
            const fileId = extractFileId(url);

            // 🟢 CATEGORY 1: Google Drive Links
            if (fileId) {
                try {
                    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                    await reply(`🔍 *Processing Movie (GDrive)...*\n🎬 ${movieData.title}\n\n_Please wait, downloading to server..._`);

                    const API_TOKEN = "VK4fry";
                    const API_BASE_WS = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";
                    const standardUrl = `https://drive.google.com/file/d/${fileId}/view`;
                    const apiUrl = `${API_BASE_WS}?url=${encodeURIComponent(standardUrl)}&apitoken=${API_TOKEN}`;

                    const response = await axios.get(apiUrl, { timeout: 20000 });
                    const data = response.data;

                    if (!data || data.success !== true) {
                        throw new Error(data?.error || data?.message || "Unknown API error");
                    }

                    let downloadUrl = data.downloadUrl || data.download_url || data.url || data.result?.downloadUrl || data.result?.download_url || data.result?.url;
                    const fileName = data.fileName || data.file_name || data.filename || data.result?.fileName || data.result?.file_name || `Movie_${fileId}.mp4`;
                    
                    if (!downloadUrl) throw new Error("No download URL received from API");

                    await reply(`📥 *Downloading to Server...*\n📄 File: ${fileName}\n📦 Size: ${movieData.size}\n⏳ This may take a few minutes for large files (1GB+)...`);

                    let ext = 'mp4';
                    let mimetype = 'video/mp4';
                    const nameParts = fileName.split('.');
                    if (nameParts.length > 1) {
                        ext = nameParts.pop().toLowerCase();
                        if (ext === 'mkv') mimetype = 'video/x-matroska';
                        else if (ext === 'avi') mimetype = 'video/x-msvideo';
                        else if (ext === 'zip') mimetype = 'application/zip';
                    }

                    const finalFileName = `SadewMini_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const tempFilePath = path.join(__dirname, finalFileName);
                    const writer = fs.createWriteStream(tempFilePath);

                    const fileRes = await axios({
                        method: 'GET',
                        url: downloadUrl,
                        responseType: 'stream',
                        timeout: 0, 
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': '*/*'
                        },
                        maxRedirects: 5
                    });

                    fileRes.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    const stats = fs.statSync(tempFilePath);
                    const actualSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                    if (stats.size > 2000 * 1024 * 1024) {
                        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                        return reply(`❌ *File is too large!*\n📦 Size: ${actualSizeMB} MB\n⚠️ WhatsApp document limit is 2GB.`);
                    }

                    const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n🎬 *Title:* ${movieData.title}\n📦 *Size:* ${actualSizeMB} MB\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                    await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });

                    await socket.sendMessage(sender, {
                        document: { stream: fs.createReadStream(tempFilePath) },
                        mimetype: mimetype,
                        fileName: finalFileName,
                        caption: caption
                    }, { quoted: msg });

                    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    // 🔥 මෙතනින් global.mbStore මකන කෑල්ල අයින් කළා! Menu එක 계속 වැඩ කරනවා.

                } catch (error) {
                    console.error("GDrive Download Error:", error);
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    reply(`❌ *සේවාදායකයෙන් චිත්‍රපටය බාගත කිරීම අසාර්ථක විය.*\n\n*ඔබට පහත ලින්ක් එකෙන් එය කෙලින්ම Download කරගත හැක:*\n🔗 ${url}`);
                }
            } 
            // 🟢 CATEGORY 2: Direct Links (workers.dev OR contains media extensions, BUT NOT Telegram/Pixeldrain)
            else if ( (url.includes('.workers.dev') || url.match(/\.(mp4|mkv|avi|zip|rar)$/i)) && !url.includes('t.me') && !url.includes('pixeldrain.com') ) {
                try {
                    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                    await reply(`🔍 *Processing Direct Link...*\n🎬 ${movieData.title}\n\n_Please wait, downloading to server..._`);

                    let decodedUrl = decodeURIComponent(url);
                    let fileNameExt = decodedUrl.split('/').pop().split('?')[0];
                    if (!fileNameExt || !fileNameExt.includes('.')) fileNameExt = `${movieData.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;

                    let ext = 'mp4';
                    let mimetype = 'video/mp4';
                    const nameParts = fileNameExt.split('.');
                    if (nameParts.length > 1) {
                        ext = nameParts.pop().toLowerCase();
                        if (ext === 'mkv') mimetype = 'video/x-matroska';
                        else if (ext === 'avi') mimetype = 'video/x-msvideo';
                        else if (ext === 'zip') mimetype = 'application/zip';
                    }

                    const finalFileName = `SadewMini_${fileNameExt.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const tempFilePath = path.join(__dirname, finalFileName);
                    const writer = fs.createWriteStream(tempFilePath);

                    const fileRes = await axios({
                        method: 'GET',
                        url: url,
                        responseType: 'stream',
                        timeout: 0, 
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': '*/*'
                        },
                        maxRedirects: 10
                    });

                    fileRes.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    const stats = fs.statSync(tempFilePath);
                    const actualSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                    if (stats.size > 2000 * 1024 * 1024) {
                        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                        return reply(`❌ *File is too large!*\n📦 Size: ${actualSizeMB} MB\n⚠️ WhatsApp document limit is 2GB.`);
                    }

                    const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n🎬 *Title:* ${movieData.title}\n📦 *Size:* ${actualSizeMB} MB\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                    await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });

                    await socket.sendMessage(sender, {
                        document: { stream: fs.createReadStream(tempFilePath) },
                        mimetype: mimetype,
                        fileName: finalFileName,
                        caption: caption
                    }, { quoted: msg });

                    await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    // 🔥 මෙතනින් global.mbStore මකන කෑල්ල අයින් කළා! Menu එක 계속 වැඩ කරනවා.

                } catch (e) {
                    console.error("Direct Link Stream Error:", e.message);
                    await socket.sendMessage(sender, { react: { text: '🔗', key: msg.key } });
                    
                    const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n🎬 *Title:* ${movieData.title}\n📦 *Size:* ${movieData.size}\n\n✅ *කරුණාකර පහත ලින්ක් එක Click කර Browser එකෙන් බාගන්න.*\n\n🔗 *Download Link:*\n${url}\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
                    await socket.sendMessage(sender, { text: caption }, { quoted: msg });
                }
            }
            // 🟢 CATEGORY 3: Telegram, Pixeldrain, or other HTML Web Links
            else {
                try {
                    await socket.sendMessage(sender, { react: { text: '🔗', key: msg.key } });

                    let specialNote = "";
                    if (url.includes('t.me')) {
                        specialNote = "✅ *මෙය Telegram Link එකක් බැවින්, පහත ලින්ක් එක Click කර Telegram හරහා බාගන්න.*";
                    } else if (url.includes('pixeldrain.com')) {
                        specialNote = "✅ *මෙය Pixeldrain Link එකක් බැවින්, පහත ලින්ක් එක Click කර Browser එකෙන් බාගන්න.*";
                    } else {
                        specialNote = "✅ *මෙම ලින්ක් එක සෘජුවම බාගත නොහැකි බැවින්, කරුණාකර එය Browser එක හරහා ලබාගන්න.*";
                    }

                    const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n` +
                                    `🎬 *Title:* ${movieData.title}\n` +
                                    `📦 *Size:* ${movieData.size}\n\n` +
                                    `${specialNote}\n\n` +
                                    `🔗 *Download Link:*\n${url}\n\n` +
                                    `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                    await socket.sendMessage(sender, { text: caption }, { quoted: msg });

                } catch (e) {
                    console.error("Movie Link Send Error:", e.message);
                    reply(`❌ *Link එක ලබා ගැනීමේදී දෝෂයක් මතු විය.*`);
                }
            }
        }
    }
};
