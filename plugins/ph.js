const axios = require('axios');

// Baileys Require (Bot එකේ තියෙන විදිහට)
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
const { generateWAMessageFromContent, generateWAMessageContent } = baileys;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: "xx_search_direct",
    category: "18+",
    description: "Search videos and send photos with CTA buttons one by one",
    commands: ["xx"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        if (command === "xx") {
            const query = args.join(' ').trim();
            if (!query) return reply("🔍 *කරුණාකර නමක් ලබා දෙන්න!*\n💡 උදා: `.xx new`");

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
                
                const searchUrl = `https://mizuki-md-api.netlify.app/api/search/pornhub?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.data || [];
                if (!res.data?.status || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් සොයාගත නොහැකි විය!*");
                }

                await reply("✅ *ප්‍රතිඵල සොයාගන්නා ලදී. එකින් එක එවීම ආරම්භ කරමි...*");

                // මුල් ප්‍රතිඵල 4 පමණක් ගන්නවා
                const topItems = items.slice(0, 4);

                for (let i = 0; i < topItems.length; i++) {
                    const item = topItems[i];
                    
                    let captionText = `*🎬 Title:* ${item.title}\n`;
                    captionText += `⏱️ *Duration:* ${item.duration}`;

                    // 1. Image එක කෙලින්ම WhatsApp Server එකට Upload කරලා Message Content එක හදාගන්නවා (Error එන්නේ නැති වෙන්න)
                    const msgContent = await generateWAMessageContent({ 
                        image: { url: item.thumb } 
                    }, { upload: socket.waUploadToServer });

                    // 2. Core Interactive Message එක හදනවා (Protobuf)
                    const interactiveMessage = {
                        "viewOnceMessage": {
                            "message": {
                                "interactiveMessage": {
                                    "header": {
                                        "hasMediaAttachment": true,
                                        "imageMessage": msgContent.imageMessage // Upload කරපු Image එක
                                    },
                                    "body": { "text": captionText },
                                    "footer": { "text": "👑 SADEW-MINI 👑" },
                                    "nativeFlowMessage": {
                                        "buttons": [
                                            {
                                                "name": "cta_url",
                                                "buttonParamsJson": `{"display_text":"🌐 Open in Browser","url":"${item.url}","merchant_url":"${item.url}"}`
                                            },
                                            {
                                                "name": "cta_copy",
                                                "buttonParamsJson": `{"display_text":"📋 Copy Link","id":"copy_btn_${i}","copy_code":"${item.url}"}`
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    };

                    // 3. Message එක යවනවා
                    const waMessage = generateWAMessageFromContent(sender, interactiveMessage, { quoted: msg });
                    await socket.relayMessage(sender, waMessage.message, { messageId: waMessage.key.id });

                    // අන්තිම Video එකට පස්සේ Delay එකක් ඕනේ නෑ
                    if (i < topItems.length - 1) {
                        await delay(5000); // හරියටම තත්පර 5ක් ඉන්නවා
                    }
                }

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }
    }
};
