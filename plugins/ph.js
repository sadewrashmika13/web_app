const axios = require('axios');
const crypto = require('crypto');

// Baileys Require - (ඔයාගේ Bot එකේ තියෙන විදිහට)
let baileys;
try {
    baileys = require('@whiskeysockets/baileys');
} catch (err) {
    try {
        baileys = require('@adiwajshing/baileys');
    } catch (err) {
        baileys = require('baileys');
    }
}
const { generateWAMessageFromContent } = baileys;

// Memory Store
if (!global.phxStore) global.phxStore = {};

module.exports = {
    name: "xx_search_carousel",
    category: "18+",
    description: "Search videos and display as Horizontal Cards",
    commands: ["xx", "xxget"], // Download අයින් කරා, Link එක විතරක් දෙනවා

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        // ==============================================================
        // 1. SEARCH & SEND HORIZONTAL CARDS (.xx)
        // ==============================================================
        if (command === "xx") {
            const query = args.join(' ').trim();
            if (!query) return reply("🔍 *කරුණාකර නමක් ලබා දෙන්න!*\n💡 උදා: `.xx new`");

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
                
                // API Request
                const searchUrl = `https://mizuki-md-api.netlify.app/api/search/pornhub?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.data || [];
                if (!res.data?.status || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් සොයාගත නොහැකි විය!*");
                }

                let cards = [];

                // මුල් ප්‍රතිඵල 5 පමණක් ගන්නවා
                items.slice(0, 5).forEach((item, i) => {
                    const shortId = crypto.randomBytes(3).toString('hex');
                    
                    global.phxStore[shortId] = { 
                        url: item.url, 
                        title: item.title, 
                        thumb: item.thumb,
                        duration: item.duration 
                    };

                    // Horizontal Card එක හදනවා
                    cards.push({
                        "body": { "text": `*${item.title}*\n⏱️ *Duration:* ${item.duration}` },
                        "header": {
                            "title": `🎬 Video ${i + 1}`,
                            "hasMediaAttachment": true,
                            "imageMessage": {
                                "url": item.thumb // මේක WhatsApp එකෙන් load කරගන්නවා
                            }
                        },
                        "nativeFlowMessage": {
                            "buttons": [{
                                "name": "quick_reply",
                                "buttonParamsJson": `{"display_text":"🔗 Get Link","id":".xxget ${shortId}"}`
                            }]
                        }
                    });
                });

                // Carousel Message එක හදනවා
                const carouselMessage = {
                    "viewOnceMessage": {
                        "message": {
                            "interactiveMessage": {
                                "header": { "hasMediaAttachment": false },
                                "body": { "text": `*🔥 SADEW-MINI SEARCH RESULTS*\n\n> *පැත්තට Slide කරලා බලන්න.*` },
                                "carouselMessage": { "cards": cards }
                            }
                        }
                    }
                };

                const waMessage = generateWAMessageFromContent(sender, carouselMessage, { quoted: msg });
                await socket.relayMessage(sender, waMessage.message, { messageId: waMessage.key.id });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 2. GET DIRECT LINK (.xxget)
        // ==============================================================
        else if (command === "xxget") {
            const shortId = args[0];
            const item = global.phxStore[shortId];

            if (!item) return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                
                // Download API Request
                const dlApiUrl = `https://mizuki-md-api.netlify.app/api/download/pornhub?q=${encodeURIComponent(item.url)}&apiKey=${API_KEY}`;
                const res = await axios.get(dlApiUrl, { timeout: 15000 });
                
                const dlUrl = res.data?.data;
                if (!res.data?.status || !dlUrl) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *මෙම වීඩියෝව සඳහා Download Link එකක් සොයාගත නොහැකි විය.*");
                }

                // කෙලින්ම විස්තරයි Link එකයි යවනවා (Download වෙන්නේ නෑ)
                let infoText = `*🎬 SADEW-MINI VIDEO LINK*\n\n`;
                infoText += `📌 *Title:* ${item.title}\n`;
                infoText += `⏱️ *Duration:* ${item.duration}\n\n`;
                infoText += `🔗 *Download / Watch Link:*\n${dlUrl}\n\n`;
                infoText += `> *👑 SADEW-MINI 👑*`;

                await socket.sendMessage(sender, {
                    image: { url: item.thumb },
                    caption: infoText
                }, { quoted: msg });
                
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }
    }
};
