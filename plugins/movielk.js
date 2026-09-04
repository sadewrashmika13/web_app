const axios = require('axios');
const crypto = require('crypto');

// Memory Store
if (!global.mbStore) global.mbStore = {};

function extractFileId(url) {
    if (!url) return null;
    let match = url.match(/\/file\/d\/([^\/]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return match[1];
    match = url.match(/\/d\/([^\/]+)/);
    if (match) return match[1];
    return null;
}

module.exports = {
    name: "moviesublk",
    category: 0, // 👈 Category 0 
    description: "Search and directly stream movies from MovieSubLk to WhatsApp",
    commands: ["movielk", "msget", "msdl"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        const API_KEY = "zan_FIAO7Ayh_eo1vllkep6"; 
        const API_BASE = "https://api.zanta-mini.store"; 

        // ==============================================================
        // 1. SEARCH MOVIE (.movielk)
        // ==============================================================
        if (command === "movielk") {
            const query = args.join(' ').trim();
            if (!query) {
                return reply("🎥 *කරුණාකර චිත්‍රපටයක නමක් ලබා දෙන්න!*\n💡 උදා: `.movielk Home Alone`");
            }

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

                const searchUrl = `${API_BASE}/api/moviesub/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.results || [];

                if (!res.data?.success || items.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply("❌ *සමාවෙන්න, චිත්‍රපටයක් සොයාගත නොහැකි විය!*");
                }

                const uniqueItems = [];
                const seenUrls = new Set();
                for (const item of items) {
                    if (!seenUrls.has(item.url)) {
                        seenUrls.add(item.url);
                        uniqueItems.push(item);
                    }
                }

                let listText = `*🔍 SADEW-MINI MOVIE SEARCH (MovieSubLk)*\n\n`;
                let buttons = [];

                uniqueItems.slice(0, 5).forEach((m, i) => {
                    const title = m.title || 'Unknown Title';
                    listText += `*${i + 1}.* ${title}\n`;
                    listText += `🎭 Type: ${m.type || 'MOVIE'}\n\n`;

                    const shortId = crypto.randomBytes(4).toString('hex');
                    global.mbStore[shortId] = { movieUrl: m.url };

                    setTimeout(() => {
                        if (global.mbStore[shortId]) delete global.mbStore[shortId];
                    }, 30 * 60 * 1000);

                    buttons.push({
                        buttonId: `.msget ${shortId}`,
                        buttonText: { displayText: `🎬 ${title.substring(0, 18)}...` },
                        type: 1
                    });
                });

                listText += `> *ඔබට අවශ්‍ය නිර්මාණයට අදාළ අංකය පහතින් තෝරන්න.*`;

                const firstCover = uniqueItems[0]?.thumbnail;
                const msgOpts = { caption: listText, footer: "👑 SADEW-MINI 👑", buttons: buttons, headerType: 4 };
                if (firstCover) msgOpts.image = { url: firstCover };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 2. GET MOVIE INFO (.msget)
        // ==============================================================
        else if (command === "msget") {
            const shortId = args[0];
            const storedData = global.mbStore[shortId];

            if (!storedData || !storedData.movieUrl) {
                return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

                const detailUrl = `${API_BASE}/api/moviesub/dl?apiKey=${API_KEY}&text=${encodeURIComponent(storedData.movieUrl)}`;
                const res = await axios.get(detailUrl, { timeout: 20000 });
                const data = res.data;

                if (!data || !data.success || !data.direct_download_url) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Link එකක් සොයාගත නොහැකි විය.*");
                }

                const movieTitle = data.movie_info?.["Movie Name"] || data.title || "Movie";
                const coverUrl = data.image;
                const directUrl = data.direct_download_url;
                const info = data.movie_info || {};

                let qList = `*🎬 SADEW-MINI MOVIE INFO*\n\n`;
                qList += `📌 *Title:* ${movieTitle}\n`;
                if (info["Release Date"]) qList += `📅 *Release Date:* ${info["Release Date"]}\n`;
                if (info["IMDb Rating"]) qList += `⭐ *IMDb:* ${info["IMDb Rating"]}\n`;
                if (info["Genre"]) qList += `🎭 *Genre:* ${info["Genre"]}\n`;
                if (info["Director"]) qList += `🎬 *Director:* ${info["Director"]}\n`;
                qList += `\n> *චිත්‍රපටය බාගත කිරීම සඳහා පහත Button එක Click කරන්න.*`;

                const dlId = crypto.randomBytes(4).toString('hex');
                global.mbStore[dlId] = { url: directUrl, title: movieTitle };

                setTimeout(() => {
                    if (global.mbStore[dlId]) delete global.mbStore[dlId];
                }, 30 * 60 * 1000);

                const buttons = [{
                    buttonId: `.msdl ${dlId}`,
                    buttonText: { displayText: `📥 Download Movie` },
                    type: 1
                }];

                const msgOpts = { caption: qList, footer: "👑 SADEW-MINI 👑", buttons: buttons, headerType: 4 };
                if (coverUrl) msgOpts.image = { url: coverUrl };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                reply("❌ *තොරතුරු ලබාගැනීමට නොහැකි විය!*");
            }
        }

        // ==============================================================
        // 3. DIRECT STREAM TO WHATSAPP (.msdl - 2GB STRICT CHECK)
        // ==============================================================
        else if (command === "msdl") {
            const shortId = args[0];
            const movieData = global.mbStore[shortId];

            if (!movieData || !movieData.url) {
                return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");
            }

            const url = movieData.url;
            const fileId = extractFileId(url);

            if (!fileId) {
                return reply(`✅ *කරුණාකර පහත ලින්ක් එකෙන් චිත්‍රපටය ලබාගන්න:*\n🔗 ${url}`);
            }

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                await reply(`🔍 *Processing Movie (GDrive)...*\n🎬 ${movieData.title}\n\n_Bypassing and checking file size..._`);

                const API_TOKEN = "4ehG6P";
                const API_BASE_WS = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";
                const standardUrl = `https://drive.google.com/file/d/${fileId}/view`;
                const apiUrl = `${API_BASE_WS}?url=${encodeURIComponent(standardUrl)}&apitoken=${API_TOKEN}`;

                const response = await axios.get(apiUrl, { timeout: 20000 });
                const data = response.data;

                if (!data || data.success !== true) {
                    throw new Error("Unknown WhiteShadow API error");
                }

                let downloadUrl = data.downloadUrl || data.download_url || data.url || data.result?.downloadUrl;
                const fileName = data.fileName || data.file_name || data.filename || `Movie_${fileId}.mp4`;
                
                if (!downloadUrl) throw new Error("No bypass download URL received");

                // Stream Connection
                const fileRes = await axios({
                    method: 'GET',
                    url: downloadUrl,
                    responseType: 'stream',
                    timeout: 0, 
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*'
                    }
                });

                fileRes.data.on('error', (err) => {
                    console.error("[GDrive Stream Error]:", err.message);
                });

                const totalLength = fileRes.headers['content-length'];
                let actualSizeMB = "Unknown";
                let sizeInBytes = 0;

                if (totalLength) {
                    sizeInBytes = parseInt(totalLength, 10);
                    actualSizeMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
                }

                // 🛑 STRICT 2GB CHECK (2GB = 2,147,483,648 Bytes):
                const TWO_GB_BYTES = 2 * 1024 * 1024 * 1024;
                if (sizeInBytes > TWO_GB_BYTES) {
                    fileRes.data.destroy(); // Stream එක එතනම නවත්වනවා (RAM/Data Saver)
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply(`❌ *චිත්‍රපටයේ සයිස් එක 2GB ට වැඩියි! (Download එක අත්හිටුවන ලදී)*\n\n📦 *File Size:* ${actualSizeMB} MB\n⚠️ WhatsApp හරහා යැවිය හැක්කේ 2GB දක්වා වූ ෆයිල්ස් පමණි.`);
                }

                await reply(`📥 *Streaming to WhatsApp...*\n📄 File: ${fileName}\n📦 Size: ${actualSizeMB} MB\n⏳ කරුණාකර රැඳී සිටින්න...`);

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
                const caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n🎬 *Title:* ${movieData.title}\n📦 *Size:* ${actualSizeMB} MB\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });

                // Direct Stream
                await socket.sendMessage(sender, {
                    document: { stream: fileRes.data }, 
                    mimetype: mimetype,
                    fileName: finalFileName,
                    caption: caption
                }, { quoted: msg });

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                
            } catch (error) {
                console.error("\n[📥 MOVIELK-DL] ❌ ERROR:", error.message);
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                reply(`❌ *චිත්‍රපටය බාගත කිරීම අසාර්ථක විය.*\n\n🔗 ලින්ක් එක: ${url}`);
            }
        }
    }
};