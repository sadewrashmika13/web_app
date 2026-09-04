const axios = require("axios");
const crypto = require("crypto");

// ═══════ CONSTANTS & SHORT STORE ═══════
const botName = "👑 SADEW-MINI 👑";
if (!global.wpStore) global.wpStore = {};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_WP" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Wallpaper\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "wallpaper_search",
    category: "search",
    description: "Search and download HD Wallpapers sequentially without limits",
    commands: ["wallpaper", "wp", "wpdl"],

    handler: async ({ socket, msg, sender, command, args }) => {
        
        // ==========================================
        // 🔥 1. DOWNLOAD COMMAND (.wpdl shortId)
        // ==========================================
        if (command === "wpdl") {
            const shortId = args[0]?.trim();
            const downloadUrl = global.wpStore[shortId] || (shortId?.startsWith('http') ? shortId : null);

            if (!downloadUrl) {
                return await socket.sendMessage(sender, { 
                    text: "❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත Search කරන්න.*" 
                }, { quoted: msg });
            }

            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await socket.sendMessage(sender, { text: "📥 _Downloading high-quality wallpaper..._" }, { quoted: msg });

            try {
                // 🚀 Direct URL Stream (0% RAM Usage - No Buffer)
                await socket.sendMessage(sender, {
                    document: { url: downloadUrl },
                    mimetype: 'image/jpeg',
                    fileName: `SadewMini_WP_${Date.now()}.jpg`,
                    caption: `🖼️ *HD Wallpaper Downloaded*\n\n> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (err) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(sender, { text: `❌ *Download failed:* ${err.message}` }, { quoted: msg });
            }
            return; 
        }

        // ==========================================
        // 🔥 2. SEARCH COMMAND (.wallpaper / .wp) 
        // ==========================================
        const query = args.join(" ").trim();

        if (!query) {
            return await socket.sendMessage(sender, {
                text: `🖼️ *Wallpaper Search*\n\n*භාවිතය:*\n• .wallpaper <query>\n\n*උදාහරණ:*\n.wallpaper bmw\n\n> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲 w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
            }, { quoted: metaQuote });
        }

        await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });
        await socket.sendMessage(sender, { text: `🔍 _Searching wallpapers for "${query}"..._` }, { quoted: msg });

        try {
            const apiRes = await axios.get(`https://apis.davidcyril.name.ng/search/wallpaper?text=${encodeURIComponent(query)}`, { timeout: 15000 });
            const data = apiRes.data;

            if (!data.success || !data.result || data.result.length === 0) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                return await socket.sendMessage(sender, { text: "❌ *ඔබ සෙවූ නමට අදාළ Wallpapers හමුවූයේ නැත.*" }, { quoted: msg });
            }

            const results = data.result; // No limits - Sends all photos
            await socket.sendMessage(sender, { 
                text: `✅ *Found ${results.length} wallpapers!*\n_Sending images one by one with a 4-second delay..._` 
            }, { quoted: msg });

            // 🚀 Send each photo sequentially with 4s delay
            for (let i = 0; i < results.length; i++) {
                const wp = results[i];
                if (!wp.image) continue;

                const shortTitle = wp.title ? (wp.title.length > 50 ? wp.title.substring(0, 47) + '...' : wp.title) : 'HD Wallpaper';

                // Short ID Generator for Lightweight Buttons
                const shortId = crypto.randomBytes(4).toString('hex');
                global.wpStore[shortId] = wp.image;

                // Memory Cleanup (15 mins)
                setTimeout(() => {
                    if (global.wpStore[shortId]) delete global.wpStore[shortId];
                }, 15 * 60 * 1000);

                try {
                    // Direct Image Stream (0% RAM Usage)
                    await socket.sendMessage(sender, {
                        image: { url: wp.image },
                        caption: `*📸 ${i + 1}/${results.length}*\n\n🖼️ *${shortTitle}*\n\n> *𝗦𝗮𝗱𝗲 w-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮dem w 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`,
                        footer: botName,
                        buttons: [
                            {
                                buttonId: `.wpdl ${shortId}`,
                                buttonText: { displayText: "📥 Download HD" },
                                type: 1
                            }
                        ],
                        headerType: 4
                    }, { quoted: metaQuote });

                    // ⏱️ Strictly 4-Second Delay
                    if (i < results.length - 1) {
                        await delay(4000);
                    }
                } catch (imgErr) {
                    console.log(`Wallpaper ${i + 1} send failed:`, imgErr.message);
                }
            }

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("Wallpaper Error:", err.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await socket.sendMessage(sender, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
        }
    }
};