const axios = require('axios');

// ═══════ DUAL API CONFIG (Handler එකෙන් පිටතට ගත්තා - RAM Saver) ═══════
const API_1 = {
    name: "WhiteShadow",
    buildUrl: (igUrl) => `https://whiteshadow-x-api.onrender.com/api/download/ig?url=${encodeURIComponent(igUrl)}&apitoken=4ehG6P`
};

const API_2 = {
    name: "Zanta",
    buildUrl: (igUrl) => `https://api.zanta-mini.store/api/insta?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(igUrl)}`
};

const botName = "👑 SADEW-MINI 👑";
const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_IG" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Instagram\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "instagram-downloader",
    category: 1,
    description: "Download Instagram Reels, Posts & Carousels (Dual API)",
    commands: ["ig", "insta", "instagram"],

    handler: async ({ socket, msg, sender, command, args }) => {
        const url = args.join(" ").trim();

        // URL Validation
        if (!url || !url.includes("instagram.com")) {
            return await socket.sendMessage(sender, {
                text: `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿 📸] ¡! ❞*\n\n` +
                      `❌ *Instagram Link එකක් දෙන්න!*\n\n` +
                      `📌 *භාවිතය:*\n` +
                      `┊ .ig https://www.instagram.com/reel/xxx\n` +
                      `┊ .ig https://www.instagram.com/p/xxx\n\n` +
                      `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
            }, { quoted: metaQuote });
        }

        try {
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await socket.sendMessage(sender, {
                text: `📥 *Instagram Media Download කරමින්...*\n_HD Quality | රැඳී සිටින්න..._`
            }, { quoted: msg });

            let mediaItems = []; 
            let usedApi = "";

            // ════════════ TRY 1: WhiteShadow API ════════════
            try {
                const res1 = await axios.get(API_1.buildUrl(url), { timeout: 20000 });
                const data1 = res1.data;

                if (data1.success && Array.isArray(data1.result) && data1.result.length > 0) {
                    mediaItems = data1.result.map(item => {
                        const directUrl = typeof item === 'string' ? item : (item.url || item.downloadUrl);
                        const isVid = typeof item === 'object' && item.type ? item.type === 'video' : directUrl.includes('.mp4');
                        return { type: isVid ? 'video' : 'image', url: directUrl };
                    });
                    usedApi = API_1.name;
                }
            } catch (err1) {
                console.log("IG: WhiteShadow API failed, trying fallback...");
            }

            // ════════════ TRY 2: Zanta API Fallback ════════════
            if (mediaItems.length === 0) {
                try {
                    const res2 = await axios.get(API_2.buildUrl(url), { timeout: 20000 });
                    const data2 = res2.data;

                    if (data2.success && (data2.downloadUrl || data2.result)) {
                        const directUrl = data2.downloadUrl || data2.result;
                        mediaItems = [{
                            type: directUrl.includes('.mp4') ? 'video' : 'image',
                            url: directUrl
                        }];
                        usedApi = API_2.name;
                    }
                } catch (err2) {
                    console.log("IG: Zanta API failed too.");
                }
            }

            // ════════════ BOTH FAILED ════════════
            if (mediaItems.length === 0) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                return await socket.sendMessage(sender, {
                    text: `❌ *Instagram Download Failed!*\n\n_Link එක Private ද, නැත්නම් Expire ද බලන්න._\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: msg });
            }

            // ════════════ SEND MEDIA (MAX 10 CAROUSEL CAP) ════════════
            const safeMediaItems = mediaItems.slice(0, 10); // 🛡️ Memory/Timeout Cap
            const totalMedia = safeMediaItems.length;

            for (let i = 0; i < totalMedia; i++) {
                const item = safeMediaItems[i];
                const countLabel = totalMedia > 1 ? ` (${i + 1}/${totalMedia})` : '';
                const typeEmoji = item.type === 'video' ? '🎥' : '🖼️';
                const typeLabel = item.type === 'video' ? 'Video' : 'Image';

                const caption = `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗟 📸] ¡! ❞*\n\n` +
                                `${typeEmoji} *Type:* ${typeLabel}${countLabel}\n` +
                                `📡 *API:* ${usedApi}\n` +
                                `🔗 *Quality:* HD\n\n` +
                                `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                try {
                    if (item.type === 'video') {
                        await socket.sendMessage(sender, {
                            video: { url: item.url },
                            mimetype: 'video/mp4',
                            caption: caption
                        }, { quoted: metaQuote });
                    } else {
                        await socket.sendMessage(sender, {
                            image: { url: item.url },
                            caption: caption
                        }, { quoted: metaQuote });
                    }
                } catch (sendErr) {
                    // Document Fallback
                    const ext = item.type === 'video' ? 'mp4' : 'jpg';
                    await socket.sendMessage(sender, {
                        document: { url: item.url },
                        mimetype: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
                        fileName: `instagram_hd_${Date.now()}_${i + 1}.${ext}`,
                        caption: caption
                    }, { quoted: metaQuote });
                }

                if (i < totalMedia - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("IG Error:", e.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await socket.sendMessage(sender, {
                text: `❌ *Instagram Download Error!*\n_${e.message}_\n\n> *𝗦𝗮𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
            }, { quoted: msg });
        }
    }
};