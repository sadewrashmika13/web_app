const axios = require('axios');
const crypto = require('crypto');

// Memory Store
if (!global.xhamStore) global.xhamStore = {};

module.exports = {
    name: "xham_search",
    category: "18+",
    description: "Search and download xHamster videos via Mizuki API",
    commands: ["xham", "xhamget", "xhamdl"], // 👈 Commands ටික

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        // ඔයා දුන්න API Key එක
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        // ==============================================================
        // 1. SEARCH (.xham)
        // ==============================================================
        if (command === "xham") {
            const query = args.join(' ').trim();
            if (!query) return reply("🔍 *කරුණාකර නමක් ලබා දෙන්න!*\n💡 උදා: `.xham new`");

            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
                
                // Search API Request
                const searchUrl = `https://mizuki-md-api.netlify.app/api/search/xhamster?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.data || [];
                if (!res.data?.status || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් සොයාගත නොහැකි විය!*");
                }

                let listText = `*🔥 SADEW-MINI XHAMSTER SEARCH*\n\n`;
                let buttons = [];

                // මුල් ප්‍රතිඵල 5 පමණක් ගන්නවා
                let count = 0;
                for (const item of items) {
                    if (count >= 5) break;

                    // සමහර Ads/Shorts වල එන අවුල් Links අයින් කරනවා
                    if (item.url.includes("xhamster.com/ff/out")) continue; 
                    
                    const shortId = crypto.randomBytes(3).toString('hex');
                    global.xhamStore[shortId] = { 
                        url: item.url, 
                        title: item.title, 
                        thumb: item.thumbnail,
                        duration: item.duration 
                    };

                    count++;
                    listText += `*${count}.* ${item.title}\n⏱️ *Duration:* ${item.duration}\n\n`;
                    
                    buttons.push({
                        buttonId: `.xhamget ${shortId}`,
                        buttonText: { displayText: `📥 Get Video ${count}` },
                        type: 1
                    });
                }

                if (buttons.length === 0) {
                    return reply("❌ *සමාවෙන්න, නිවැරදි ප්‍රතිඵල සොයාගත නොහැකි විය!*");
                }

                listText += `> *ඔබට අවශ්‍ය වීඩියෝව පහතින් තෝරන්න.*`;

                const msgOpts = { 
                    caption: listText, 
                    footer: "👑 SADEW-MINI 👑", 
                    buttons: buttons, 
                    headerType: 4 
                };
                
                // පළවෙනි වීඩියෝ එකේ Thumbnail එක දානවා
                if (items[0]?.thumbnail) {
                    msgOpts.image = { url: items[0].thumbnail };
                }

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API දෝෂයකි! පසුව නැවත උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 2. GET DETAILS (.xhamget)
        // ==============================================================
        else if (command === "xhamget") {
            const shortId = args[0];
            const item = global.xhamStore[shortId];

            if (!item) return reply("❌ *මෙම ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                
                const dlApiUrl = `https://mizuki-md-api.netlify.app/api/download/xhamster?q=${encodeURIComponent(item.url)}&apiKey=${API_KEY}`;
                
                // ⚠️ මෙතන Timeout එක තත්පර 60ක් කරා (60000ms)
                const res = await axios.get(dlApiUrl, { timeout: 60000 }); 
                
                const formats = res.data?.data?.formats || [];
                const dlUrl = formats[0]?.url;

                if (!res.data?.status || !dlUrl) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *මෙම වීඩියෝව සඳහා Download Link එකක් API එකෙන් ලබා දුන්නේ නැත. සමහරවිට එය ඉවත් කර තිබිය හැක.*");
                }

                item.dlUrl = dlUrl;

                let infoText = `*🎬 SADEW-MINI XHAMSTER INFO*\n\n`;
                infoText += `📌 *Title:* ${res.data.data.title || item.title}\n`;
                infoText += `⏱️ *Duration:* ${res.data.data.duration || item.duration}\n\n`;
                infoText += `> *බාගත කිරීම සඳහා පහත Button එක Click කරන්න.*`;

                const thumb = res.data.data.thumbnail || item.thumb;

                const buttons = [{
                    buttonId: `.xhamdl ${shortId}`,
                    buttonText: { displayText: `📥 Download Video` },
                    type: 1
                }];

                await socket.sendMessage(sender, {
                    image: { url: thumb },
                    caption: infoText,
                    footer: "👑 SADEW-MINI 👑",
                    buttons: buttons,
                    headerType: 4
                }, { quoted: msg });
                
                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

            } catch (e) {
                console.error(e);
                reply("❌ *API එකෙන් ප්‍රතිචාරයක් නොලැබුණි (Timeout). වෙනත් වීඩියෝවක් උත්සාහ කරන්න.*");
            }
        }

        // ==============================================================
        // 3. FULL STREAM DOWNLOAD (.xhamdl)
        // ==============================================================
        else if (command === "xhamdl") {
            const shortId = args[0];
            const item = global.xhamStore[shortId];

            if (!item || !item.dlUrl) return reply("❌ *ලින්ක් එක කල් ඉකුත් වී ඇත. නැවත Search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });

                let sizeMB = "Unknown";
                try {
                    // මෙතනත් Timeout එක තත්පර 30ක් කරා
                    const headRes = await axios.head(item.dlUrl, { timeout: 30000 });
                    const contentLength = headRes.headers['content-length'];
                    if (contentLength) {
                        sizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
                    }
                } catch (e) {
                    console.log("HEAD request failed, moving on...");
                }

                await reply(`📥 *Downloading...*\n🎬 ${item.title.substring(0, 30)}...\n📦 Size: ~${sizeMB} MB\n⏳ _Directly streaming..._`);
                await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
                
                const streamRes = await axios({
                    method: 'GET',
                    url: item.dlUrl,
                    responseType: 'stream',
                    timeout: 0 // මෙතන 0 තියෙන්නේ Download වෙන්න ඕන තරම් වෙලාවක් ගන්න දෙනවා
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
                reply(`❌ *බාගත කිරීම අසාර්ථක විය (Stream Error).*\n\n🔗 *Link:* ${item.dlUrl}`);
            }
        }
    }
};
