const axios = require('axios');

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

                const topItems = items.slice(0, 4);

                for (let i = 0; i < topItems.length; i++) {
                    const item = topItems[i];
                    
                    try {
                        let captionText = `*🎬 Title:* ${item.title}\n`;
                        captionText += `⏱️ *Duration:* ${item.duration}`;

                        // 1. Image එක ගන්න Try කරනවා
                        let imageMessage = null;
                        let hasImage = false;

                        if (item.thumb) {
                            try {
                                const msgContent = await generateWAMessageContent({ 
                                    image: { url: item.thumb } 
                                }, { upload: socket.waUploadToServer });
                                imageMessage = msgContent.imageMessage;
                                hasImage = true;
                            } catch (imgErr) {
                                console.log(`[XX Plugin] Image failed for item ${i + 1}, sending without image.`);
                            }
                        }

                        // 2. Image එක තියෙනවද නැද්ද බලලා Header එක හදනවා
                        const headerProps = hasImage ? {
                            "hasMediaAttachment": true,
                            "imageMessage": imageMessage
                        } : {
                            "hasMediaAttachment": false
                        };

                        // 3. Core Message එක හදනවා
                        const interactiveMessage = {
                            "viewOnceMessage": {
                                "message": {
                                    "interactiveMessage": {
                                        "header": headerProps,
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

                        // 4. Message එක යවනවා
                        const waMessage = generateWAMessageFromContent(sender, interactiveMessage, { quoted: msg });
                        await socket.relayMessage(sender, waMessage.message, { messageId: waMessage.key.id });

                    } catch (innerError) {
                        console.log(`[XX Plugin] Completely failed to send item ${i + 1}`);
                        // මොකක් හරි ලොකු අවුලක් ගියොත් මේක අතෑරලා ඊළඟ එකට යනවා
                    }

                    // අන්තිම Video එකට පස්සේ Delay එකක් ඕනේ නෑ
                    if (i < topItems.length - 1) {
                        await delay(5000); // තත්පර 5ක් ඉන්නවා
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
