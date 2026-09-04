const axios = require('axios');
const crypto = require('crypto');

// Memory Store
if (!global.phxStore) global.phxStore = {};

module.exports = {
    name: "xx_search",
    category: "18+",
    description: "Search and download videos via Mizuki API",
    commands: ["xx", "xxget", "xxdl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        // ඔයා දුන්න API Key එක
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        // ==============================================================
        // 1. SEARCH (.xx)
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

                let listText = `*🔥 SADEW-MINI SEARCH RESULTS*\n\n`;
                let buttons = [];

                // මුල් ප්‍රතිඵල 5 පමණක් ගන්නවා
                items.slice(0, 5).forEach((item, i) => {
                    const shortId = crypto.randomBytes(3).toString('hex');
                    
                    global.phxStore[shortId] = { 
                        url: item.url, 
                        title: item.title, 
                        thumb: item.thumb,
                        duration: item.duration 
                    };

                    listText += `*${i + 1}.* ${item.title}\n⏱️ *Duration:* ${item.duration}\n\n`;
                    
                    buttons.push({
                        buttonId: `.xxget ${shortId}`,
                        buttonText: { displayText: `📥 Get Video ${i + 1}` },
                        type: 1
                    });
                });

                listText += `> *ඔබට අවශ්‍ය වීඩියෝව පහතින් තෝරන්න.*`;

                const msgOpts = { 
                    caption: listText, 
                    footer: "👑 SADEW-MINI 👑", 
                    buttons: buttons, 
                    headerType: 4 
                };
                
                if (items[0]?.thumb) {
                    msgOpts.image = { url: items[0].thumb };
                }

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 2. GET DETAILS (.xxget)
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

                item.dlUrl = dlUrl; // Store එකට දාගන්නවා

                let infoText = `*🎬 SADEW-MINI VIDEO INFO*\n\n`;
                infoText += `📌 *Title:* ${item.title}\n`;
                infoText += `⏱️ *Duration:* ${item.duration}\n\n`;
                infoText += `> *බාගත කිරීම සඳහා පහත Button එක Click කරන්න.*`;

                const buttons = [{
                    buttonId: `.xxdl ${shortId}`,
                    buttonText: { displayText: `📥 Download Video` },
                    type: 1
                }];

                await socket.sendMessage(sender, {
                    image: { url: item.thumb },
                    caption: infoText,
                    footer: "👑 SADEW-MINI 👑",
                    buttons: buttons,
                    headerType: 4
                }, { quoted: msg });
                
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 3. FULL STREAM DOWNLOAD (.xxdl) - NO SIZE LIMIT
        // ==============================================================
        else if (command === "xxdl") {
            const shortId = args[0];
            const item = global.phxStore[shortId];

            if (!item || !item.dlUrl) return reply("❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත Search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });

                // Size එක පෙන්නන්න විතරක් HEAD Request එකක් යවනවා
                let sizeMB = "Unknown";
                try {
                    const headRes = await axios.head(item.dlUrl);
                    const contentLength = headRes.headers['content-length'];
                    if (contentLength) {
                        sizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
                    }
                } catch (e) {
                    console.log("HEAD request failed, moving on...");
                }

                await reply(`📥 *Downloading...*\n🎬 ${item.title.substring(0, 30)}...\n📦 Size: ~${sizeMB} MB\n⏳ _Directly streaming..._`);
                await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
                
                // Unlimited Streaming
                const streamRes = await axios({
                    method: 'GET',
                    url: item.dlUrl,
                    responseType: 'stream',
                    timeout: 0 // Limit එකක් නෑ, ලොකු ෆයිල්ස් වලට වෙලා දෙනවා
                });

                await socket.sendMessage(sender, {
                    document: { stream: streamRes.data },
                    mimetype: 'video/mp4',
                    fileName: `SadewMini_${shortId}.mp4`,
                    caption: `*🎬 Title:* ${item.title}\n> *👑 SADEW-MINI 👑*`
                }, { quoted: msg });

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                reply(`❌ *බාගත කිරීම අසාර්ථක විය.*\n\n🔗 *Link:* ${item.dlUrl}`);
            }
        }
    }
};
