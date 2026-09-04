const axios = require('axios');
const crypto = require('crypto');

// ═══════ CONSTANTS & SHORT STORE ═══════
const PINTEREST_API = "https://www.movanest.xyz/v2/pinterest";
const botName = "👑 SADEW-MINI 👑";

if (!global.pinStore) global.pinStore = {};

const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_IMG" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Pinterest\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "pinterest-image-search",
    category: 9,
    description: "Search and download Pinterest images with horizontal cards",
    commands: ["img", "img_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {

        // ==========================================
        // 1. IMAGE SEARCH COMMAND (.img)
        // ==========================================
        if (command === "img") {
            const query = args.join(" ").trim();

            if (!query) {
                return await reply("🖼️ *කරුණාකර සෙවීමට නමක් ලබා දෙන්න!*\n_උදා: .img cute puppies_");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const searchUrl = `${PINTEREST_API}?query=${encodeURIComponent(query)}&pageSize=20`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                const data = res.data;

                if (!data.status || !data.results || data.results.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return await reply("❌ *සමාවෙන්න, එම නමින් Images කිසිවක් හමුවූයේ නැත.*");
                }

                // 🛑 Photos 10 ම ලබා ගැනීම (slice 0, 10)
                const imageResults = data.results.filter(r => !r.is_video && r.image).slice(0, 10);

                if (imageResults.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return await reply("❌ *Images හමුවූයේ නැත.*");
                }

                await socket.sendMessage(sender, { react: { text: "📤", key: msg.key } });

                // Cards 10 යැවීම (තත්පර 3 ක Delay එකක් සහිතව)
                for (let i = 0; i < imageResults.length; i++) {
                    const img = imageResults[i];
                    const imgTitle = img.title || 'Pinterest Image';
                    const shortTitle = imgTitle.length > 50 ? imgTitle.substring(0, 47) + '...' : imgTitle;
                    const imgUrl = img.image;

                    // Short ID Generator for Lightweight Buttons
                    const shortId = crypto.randomBytes(4).toString('hex');
                    global.pinStore[shortId] = imgUrl;

                    // TTL Memory Cleanup
                    setTimeout(() => {
                        if (global.pinStore[shortId]) delete global.pinStore[shortId];
                    }, 15 * 60 * 1000);

                    try {
                        const cardCaption = `*📸 ${i + 1}/${imageResults.length}*\n\n` +
                            `*${shortTitle}*\n\n` +
                            `👤 *By:* ${img.full_name || img.username || 'Unknown'}\n` +
                            `📌 *Board:* ${img.board || 'N/A'}\n\n` +
                            `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                        // 🚀 Direct URL Stream (0% RAM Buffer)
                        await socket.sendMessage(sender, {
                            image: { url: imgUrl },
                            caption: cardCaption,
                            footer: '👑 SADEW-MINI 👑',
                            buttons: [
                                {
                                    buttonId: `.img_dl ${shortId}`,
                                    buttonText: { displayText: '📥 Download HD' },
                                    type: 1
                                }
                            ],
                            headerType: 4
                        }, { quoted: metaQuote });

                        // ⏱️ හරියටම තත්පර 3 ක Delay එකක්
                        if (i < imageResults.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }
                    } catch (cardErr) {
                        console.log(`Pinterest card ${i + 1} failed:`, cardErr.message);
                    }
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("Pinterest Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Image Search එකේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ==========================================
        // 2. IMAGE DOWNLOAD COMMAND (.img_dl)
        // ==========================================
        else if (command === "img_dl") {
            const shortId = args[0]?.trim();
            if (!shortId) return;

            const imgUrl = global.pinStore[shortId] || (shortId.startsWith('http') ? shortId : null);

            if (!imgUrl) {
                return await reply("❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත .img search කරන්න.*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });

                const cleanUrl = imgUrl.split('?')[0].toLowerCase();
                let ext = 'jpg';
                if (cleanUrl.endsWith('.png')) ext = 'png';
                else if (cleanUrl.endsWith('.webp')) ext = 'webp';
                else if (cleanUrl.endsWith('.gif')) ext = 'gif';

                const fileName = `Pinterest_${Date.now()}.${ext}`;

                // 🚀 Direct URL Document Stream (0% RAM Buffer)
                await socket.sendMessage(sender, {
                    document: { url: imgUrl },
                    mimetype: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                    fileName: fileName,
                    caption: `📥 *Pinterest HD Image*\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("Pinterest DL Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!*");
            }
        }
    }
};