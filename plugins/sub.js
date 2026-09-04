const axios = require('axios');
const crypto = require('crypto');

// ගූගල් ඩ්‍රයිව් ලින්ක් එකෙන් File ID එක අදින ෆන්ක්ෂන් එක
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

// Memory Store
if (!global.sublkStore) global.sublkStore = {};
let listenerAttached = false;

// Clean JID Helper
function cleanJid(jid) {
    if (!jid) return "";
    return jid.split('@')[0].split(':')[0] + '@s.whatsapp.net';
}

// ==============================================================
// Global Message Listener (අංක රිප්ලයි අල්ලගන්නා තැන)
// ==============================================================
function attachListener(socket) {
    if (listenerAttached) return;
    listenerAttached = true;

    socket.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mekUpdate = chatUpdate.messages[0];
            if (!mekUpdate || !mekUpdate.message) return;
            
            const extendedText = mekUpdate.message.extendedTextMessage;
            if (!extendedText || !extendedText.contextInfo) return;

            const quotedMsgId = extendedText.contextInfo.stanzaId;
            const userReplyText = extendedText.text || "";
            const rawSender = mekUpdate.key.participant || mekUpdate.key.remoteJid;
            const senderJid = cleanJid(rawSender);

            const session = global.sublkStore[quotedMsgId];
            if (!session) return; 
            if (cleanJid(session.sender) !== senderJid) return; 

            const selectedNumber = parseInt(userReplyText.trim(), 10);
            if (isNaN(selectedNumber)) return;

            // ----------------------------------------------------
            // STEP 2: චිත්‍රපටය තේරීම
            // ----------------------------------------------------
            if (session.type === 'SEARCH') {
                if (selectedNumber < 1 || selectedNumber > session.results.length) return;
                
                const selectedMovie = session.results[selectedNumber - 1];
                await socket.sendMessage(mekUpdate.key.remoteJid, { react: { text: "⏳", key: mekUpdate.key } });

                const detailsUrl = `https://whiteshadow-x-api.onrender.com/api/movie/sublk?url=${encodeURIComponent(selectedMovie.link)}&apitoken=4ehG6P`;
                const detailsRes = await axios.get(detailsUrl, { timeout: 20000 });
                
                if (!detailsRes.data?.result || !detailsRes.data?.result?.downloadLinks) {
                    return await socket.sendMessage(mekUpdate.key.remoteJid, { text: "❌ *තොරතුරු ලබාගැනීමට නොහැකි විය!*" }, { quoted: mekUpdate });
                }

                const movieData = detailsRes.data.result;

                let dlMsg = `🎬 *${movieData.title}*\n\n`;
                dlMsg += `*මෙම චිත්‍රපටයේ ඔබට අවශ්‍ය Quality එකෙහි අංකය Reply කරන්න:*\n\n`;
                
                movieData.downloadLinks.forEach((linkObj, index) => {
                    dlMsg += `*${index + 1}.* ${linkObj.quality} - ${linkObj.size}\n`;
                });

                const sentDlMsg = await socket.sendMessage(mekUpdate.key.remoteJid, {
                    image: { url: movieData.image },
                    caption: dlMsg
                }, { quoted: mekUpdate });

                // TTL Expiry (15 mins) for Step 2
                const newMsgId = sentDlMsg.key.id;
                global.sublkStore[newMsgId] = {
                    type: 'DOWNLOAD',
                    links: movieData.downloadLinks,
                    sender: senderJid,
                    movieTitle: movieData.title
                };

                setTimeout(() => {
                    if (global.sublkStore[newMsgId]) delete global.sublkStore[newMsgId];
                }, 15 * 60 * 1000);
                
                delete global.sublkStore[quotedMsgId];
            }

            // ----------------------------------------------------
            // STEP 3: ඩවුන්ලෝඩ් කිරීම (GDrive Bypass & Streaming)
            // ----------------------------------------------------
            else if (session.type === 'DOWNLOAD') {
                if (selectedNumber < 1 || selectedNumber > session.links.length) return;
                
                const selectedLinkObj = session.links[selectedNumber - 1];
                await socket.sendMessage(mekUpdate.key.remoteJid, { react: { text: "⬇️", key: mekUpdate.key } });
                
                const gdriveUrl = selectedLinkObj.downloadUrl;
                const fileId = extractFileId(gdriveUrl);

                if (!fileId) {
                    return await socket.sendMessage(mekUpdate.key.remoteJid, { text: "❌ *Google Drive File ID එක සොයාගත නොහැකි විය!*" }, { quoted: mekUpdate });
                }

                await socket.sendMessage(mekUpdate.key.remoteJid, { 
                    text: `📥 *Processing Movie (GDrive)...*\n🎬 ${session.movieTitle}\n📦 *Size:* ${selectedLinkObj.size}\n\n_Please wait, bypassing link..._` 
                }, { quoted: mekUpdate });

                // WhiteShadow Bypass API
                const API_TOKEN = "4ehG6P";
                const API_BASE_WS = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";
                const standardUrl = `https://drive.google.com/file/d/${fileId}/view`;
                const apiUrl = `${API_BASE_WS}?url=${encodeURIComponent(standardUrl)}&apitoken=${API_TOKEN}`;

                const gdriveRes = await axios.get(apiUrl, { timeout: 25000 });
                const data = gdriveRes.data;

                if (!data || data.success !== true) {
                    return await socket.sendMessage(mekUpdate.key.remoteJid, { text: "❌ *API දෝෂයක් මතු විය!*" }, { quoted: mekUpdate });
                }

                let downloadUrl = data.downloadUrl || data.download_url || data.url || data.result?.downloadUrl;
                const fileName = data.fileName || data.file_name || data.filename || `Movie_${fileId}.mp4`;

                if (!downloadUrl) return await socket.sendMessage(mekUpdate.key.remoteJid, { text: "❌ *Download ලින්ක් එක ලබාගැනීමට නොහැකි විය!*" }, { quoted: mekUpdate });

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

                // 🛡️ Safe Stream Error Handling
                fileRes.data.on('error', (streamErr) => {
                    console.error("[SubLK Stream Error]:", streamErr.message);
                });

                const totalLength = fileRes.headers['content-length'];
                let sizeInBytes = totalLength ? parseInt(totalLength, 10) : 0;
                let actualSizeMB = sizeInBytes ? (sizeInBytes / (1024 * 1024)).toFixed(2) : selectedLinkObj.size;

                // 2GB (2000MB) සීමාව පරීක්ෂා කිරීම
                const TWO_GB_BYTES = 2000 * 1024 * 1024;
                if (sizeInBytes > TWO_GB_BYTES) {
                    fileRes.data.destroy(); // Stream එක නතර කිරීම
                    return await socket.sendMessage(mekUpdate.key.remoteJid, { text: `❌ *ෆිල්ම් එකේ සයිස් එක වැඩියි! (${actualSizeMB} MB)*\n⚠️ WhatsApp හරහා යැවිය හැක්කේ 2GB දක්වා වූ ෆයිල්ස් පමණි.` }, { quoted: mekUpdate });
                }

                await socket.sendMessage(mekUpdate.key.remoteJid, { react: { text: "⬆️", key: mekUpdate.key } });

                const safeTitle = session.movieTitle.replace(/[^a-zA-Z0-9._-]/g, '_');
                const captionMsg = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗠𝗼𝘃𝗶𝗲𝘀 🎀] ¡! ❞*\n\n🎬 *Title:* ${session.movieTitle}\n🌟 *Quality:* ${selectedLinkObj.quality}\n📦 *Size:* ${actualSizeMB} MB\n\n> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
                const finalFileName = `SubLK_${safeTitle}_${selectedLinkObj.quality}.mp4`;

                // කෙලින්ම WhatsApp වෙත Stream කිරීම (0% Buffer)
                await socket.sendMessage(mekUpdate.key.remoteJid, {
                    document: { stream: fileRes.data }, 
                    mimetype: 'video/mp4',
                    fileName: finalFileName,
                    caption: captionMsg
                }, { quoted: mekUpdate });

                await socket.sendMessage(mekUpdate.key.remoteJid, { react: { text: "✅", key: mekUpdate.key } });
                delete global.sublkStore[quotedMsgId];
            }

        } catch (err) {
            console.error("Reply Listener Error:", err.message);
        }
    });
}

// ==============================================================
// Main Module Export (බොට්ගේ කමාන්ඩ් එක)
// ==============================================================
module.exports = {
    name: "sublk",
    category: 1,
    description: "Search and download movies from Sub.lk via Number Reply",
    commands: ["sublk", "smd"],
    
    handler: async ({ socket, msg, sender, args, reply }) => {
        const query = args.join(' ').trim();
        
        if (!query) {
            return reply("🎥 *කරුණාකර චිත්‍රපටයක නමක් ලබා දෙන්න!*\n💡 උදා: `.sublk Batman`");
        }

        try {
            attachListener(socket);
            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

            const searchApiUrl = `https://whiteshadow-x-api.onrender.com/api/movie/sublk?q=${encodeURIComponent(query)}&apitoken=4ehG6P`;
            const searchRes = await axios.get(searchApiUrl, { timeout: 20000 });

            if (!searchRes.data.status || !searchRes.data.results || searchRes.data.results.length === 0) {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                return reply("❌ *සමාවෙන්න, චිත්‍රපටයක් සොයාගත නොහැකි විය!*");
            }

            let results = searchRes.data.results.slice(0, 10);
            let listMsg = `🎬 *SUB.LK MOVIE SEARCH* 🎬\n\n`;
            
            results.forEach((movie, index) => {
                listMsg += `*${index + 1}.* ${movie.title} (${movie.year || 'N/A'})\n`;
                listMsg += `⭐ Rating: ${movie.rating || "N/A"}\n\n`;
            });

            listMsg += `> *ඔබට අවශ්‍ය චිත්‍රපටයේ අංකය මෙම පණිවිඩයට Reply කරන්න.*`;

            let sentMsg = await socket.sendMessage(sender, { 
                image: { url: results[0].image }, 
                caption: listMsg 
            }, { quoted: msg });

            // Store with 15-Minute TTL Clean-up
            const msgId = sentMsg.key.id;
            global.sublkStore[msgId] = {
                type: 'SEARCH',
                sender: sender,
                results: results
            };

            setTimeout(() => {
                if (global.sublkStore[msgId]) delete global.sublkStore[msgId];
            }, 15 * 60 * 1000);

            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (e) {
            console.error("Sublk Command Error:", e.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
        }
    }
};