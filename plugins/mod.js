const axios = require("axios");
const crypto = require("crypto");

// ═══════ API CONFIG & SHORT STORE ═══════
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api/modapk";
const botName = "👑 SADEW-MINI 👑";

if (!global.modStore) global.modStore = {};

const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_MOD" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew ModApk\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "mod_downloader_buttons",
    category: 1, // 👈 Category 1 (Download Menu)
    description: "🎮 Search and download MOD APK games using buttons",
    commands: ["mod", "mod_dl"],

    handler: async ({ socket, msg, sender, command, args }) => {

        // ==========================================
        // 🔥 1. SEARCH COMMAND (.mod)
        // ==========================================
        if (command === "mod") {
            const query = args.join(" ").trim();

            if (!query) {
                return await socket.sendMessage(sender, {
                    text: `🎮 *MOD APK Downloader*\n\n*භාවිතය:*\n• .mod <game name>\n\n*උදාහරණ:*\n.mod subway surfers\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: msg });
            }

            await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

            try {
                const searchRes = await axios.get(`${API_BASE}/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`, { timeout: 15000 });
                
                if (!searchRes.data?.success || !searchRes.data?.result?.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return await socket.sendMessage(sender, { text: `❌ *"${query}" සඳහා ප්‍රතිඵල හමුවූයේ නැත!*` }, { quoted: msg });
                }

                // WhatsApp Button Limit එකට අනුකූලව 3ක් තෝරාගැනීම
                const results = searchRes.data.result.slice(0, 3); 
                let listMsg = `🎮 *MOD APK Results*\n🔍 *Search:* ${query}\n\n`;
                
                const buttons = results.map((game, i) => {
                    listMsg += `*${i+1}.* ${game.title}\n👤 ${game.developer || "Unknown"} | ⭐ ${game.rating || "N/A"}\n\n`;
                    
                    // 🛡️ Short ID generator (Prevents WhatsApp Button Payload Overflow)
                    const shortId = crypto.randomBytes(4).toString('hex');
                    global.modStore[shortId] = {
                        url: game.url,
                        title: game.title
                    };

                    // TTL Memory Cleanup (15 mins)
                    setTimeout(() => {
                        if (global.modStore[shortId]) delete global.modStore[shortId];
                    }, 15 * 60 * 1000);

                    return {
                        buttonId: `.mod_dl ${shortId}`,
                        buttonText: { displayText: `📥 ${game.title.substring(0, 16)}...` },
                        type: 1
                    };
                });
                
                listMsg += `> 💡 *ඔබට අවශ්‍ය Game එක පහත Button වලින් තෝරන්න.*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                await socket.sendMessage(sender, {
                    text: listMsg,
                    footer: botName,
                    buttons: buttons,
                    headerType: 1
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "📑", key: msg.key } });

            } catch (err) {
                console.error("Mod Search error:", err.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(sender, { text: `❌ *Search failed:*\n_${err.message}_` }, { quoted: msg });
            }
        }

        // ==========================================
        // 🔥 2. DOWNLOAD COMMAND (.mod_dl)
        // ==========================================
        else if (command === "mod_dl") {
            const shortId = args[0]?.trim();
            const storedData = global.modStore[shortId];

            if (!storedData) {
                return await socket.sendMessage(sender, { 
                    text: "❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත .mod search කරන්න.*" 
                }, { quoted: msg });
            }

            const gameUrl = encodeURIComponent(storedData.url);
            const gameTitle = storedData.title;

            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await socket.sendMessage(sender, { 
                text: `📥 *Downloading ${gameTitle}...*\n_මෙයට සුළු වේලාවක් ගත විය හැක, රැඳී සිටින්න..._` 
            }, { quoted: msg });

            try {
                const dlRes = await axios.get(`${API_BASE}/dl?apiKey=${API_KEY}&url=${gameUrl}`, { timeout: 20000 });
                if (!dlRes.data?.success || !dlRes.data?.download_url) throw new Error("Download link එක හමුවූයේ නැත");

                const downloadUrl = dlRes.data.download_url;
                const safeFileName = `${gameTitle.replace(/[^a-zA-Z0-9._-]/g, '_')}_MOD.apk`;
                const caption = `🎮 *${gameTitle}* [MOD]\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // 🚀 Direct URL Stream (No ArrayBuffer, 0% RAM Usage)
                await socket.sendMessage(sender, {
                    document: { url: downloadUrl },
                    mimetype: "application/vnd.android.package-archive",
                    fileName: safeFileName,
                    caption: caption
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (downloadErr) {
                console.error("Mod DL Error:", downloadErr.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(sender, { text: `❌ *Download failed:*\n_${downloadErr.message}_` }, { quoted: msg });
            }
        }
    }
};