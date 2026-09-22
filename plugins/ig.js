const axios = require('axios');

module.exports = {
    name: "instagram-downloader",
    category: 1,
    description: "Download Instagram Reels, Posts & Carousels (Dual API)",
    commands: ["ig", "insta", "instagram"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        
        // ═══════ DUAL API CONFIG ═══════
        const API_1 = {
            name: "WhiteShadow",
            url: "https://whiteshadow-x-api.onrender.com/api/download/ig",
            token: "VK4fry",
            buildUrl: (igUrl) => `https://whiteshadow-x-api.onrender.com/api/download/ig?url=${encodeURIComponent(igUrl)}&apitoken=4ehG6P`
        };
        const API_2 = {
            name: "Zanta",
            url: "https://api.zanta-mini.store/api/insta",
            key: "zan_FIAO7Ayh_eo1vllkep6",
            buildUrl: (igUrl) => `https://api.zanta-mini.store/api/insta?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(igUrl)}`
        };

        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_IG" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Instagram\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const url = args.join(" ").trim();

        if (!url || !url.includes("instagram.com")) {
            return await socket.sendMessage(sender, {
                text: `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿 📸] ¡! ❞*\n\n❌ *Instagram Link එකක් දෙන්න!*\n\n📌 *භාවිතය:*\n┊ .ig https://www.instagram.com/reel/xxx\n┊ .ig https://www.instagram.com/p/xxx\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
            }, { quoted: metaQuote });
        }

        try {
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await socket.sendMessage(sender, { text: `📥 *Instagram Media Download කරමින්...*\n_HD Quality | රැඳී සිටින්න..._` }, { quoted: msg });

            let mediaItems = [];
            let usedApi = "";

            // ═══════════════════════════════════════════
            // TRY 1: WhiteShadow API
            // ═══════════════════════════════════════════
            try {
                console.log("IG: Trying WhiteShadow API...");
                const res1 = await axios.get(API_1.buildUrl(url), { timeout: 25000 });
                if (res1.data.success && res1.data.result && res1.data.result.length > 0) {
                    mediaItems = res1.data.result.map(item => ({ type: item.type || 'video', url: item.url }));
                    usedApi = API_1.name;
                }
            } catch (err1) {
                console.log("IG: WhiteShadow API failed:", err1.message);
            }

            // ═══════════════════════════════════════════
            // TRY 2: Zanta API fallback
            // ═══════════════════════════════════════════
            if (mediaItems.length === 0) {
                try {
                    console.log("IG: Falling back to Zanta API...");
                    const res2 = await axios.get(API_2.buildUrl(url), { timeout: 25000 });
                    if (res2.data.success && res2.data.downloadUrl) {
                        mediaItems = [{ type: 'video', url: res2.data.downloadUrl, thumbnail: res2.data.thumbnail || null }];
                        usedApi = API_2.name;
                    }
                } catch (err2) {
                    console.log("IG: Zanta API failed:", err2.message);
                }
            }

            if (mediaItems.length === 0) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                return await socket.sendMessage(sender, { text: `❌ *Instagram Download Failed!*\n\n_Link එක Private ද, නැත්නම් Expire ද බලන්න._\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*` }, { quoted: msg });
            }

            // ═══════════════════════════════════════════
            // SEND MEDIA (HEROKU FIX: Fetch Buffer First)
            // ═══════════════════════════════════════════
            const totalMedia = mediaItems.length;

            for (let i = 0; i < totalMedia; i++) {
                const item = mediaItems[i];
                const countLabel = totalMedia > 1 ? ` (${i + 1}/${totalMedia})` : '';
                const typeEmoji = item.type === 'video' ? '🎥' : '🖼️';
                const typeLabel = item.type === 'video' ? 'Video' : 'Image';
                const caption = `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗟 📸] ¡! ❞*\n\n${typeEmoji} *Type:* ${typeLabel}${countLabel}\n📡 *API:* ${usedApi}\n🔗 *Quality:* HD\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                try {
                    // 🔥 Heroku IP Block එක Bypass කිරීම 🔥
                    const response = await axios.get(item.url, {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                            'Referer': 'https://www.instagram.com/'
                        },
                        timeout: 30000 // ලොකු ෆයිල් බාන්න වෙලාව දෙනවා
                    });
                    
                    const mediaBuffer = Buffer.from(response.data, 'binary');

                    if (item.type === 'video') {
                        await socket.sendMessage(sender, { video: mediaBuffer, mimetype: 'video/mp4', caption: caption }, { quoted: metaQuote });
                    } else {
                        await socket.sendMessage(sender, { image: mediaBuffer, caption: caption }, { quoted: metaQuote });
                    }

                } catch (sendErr) {
                    console.log(`IG: Media ${i + 1} send failed on Heroku:`, sendErr.message);
                    await socket.sendMessage(sender, { text: `❌ *Media ${i + 1} Download Failed! (Heroku Block)*` }, { quoted: msg });
                }

                if (i < totalMedia - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("IG Error:", e.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await socket.sendMessage(sender, { text: `❌ *Instagram Download Error!*\n_${e.message}_\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*` }, { quoted: msg });
        }
    }
};
