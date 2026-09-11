const axios = require('axios');
const crypto = require('crypto');

// Memory Store
if (!global.xvStore) global.xvStore = {};

module.exports = {
    name: "xVideos",
    category: "18+",
    description: "Search and download xVideos",
    commands: ["xv", "xvideo"], // xvdl සම්පූර්ණයෙන්ම අයින් කළා! Menu එකේ පේන්නේ නෑ

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        
        const API_KEY = "slk_feb4c1b4888e42998f43b746336ca25e";

        if (command === "xvideo" || command === "xv") {
            const query = args.join(' ').trim();
            if (!query) return reply("🔍 *කරුණාකර නමක් හෝ ලින්ක් එකක් ලබා දෙන්න!*\n💡 උදා: `.xv new`");

            // ==============================================================
            // 1. DOWNLOAD LOGIC (Button එක එබුවම හෝ ලින්ක් එකක් දුන්නොත්)
            // ==============================================================
            const item = global.xvStore[query];
            
            if (item || query.includes('xvideos.com')) {
                let videoTargetUrl = item ? item.url : query;
                let videoTitle = item ? item.title : "XVideos Download";

                try {
                    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                    
                    const dlApiUrl = `https://mizuki-md-api.netlify.app/api/download/xvideo?q=${encodeURIComponent(videoTargetUrl)}&apiKey=${API_KEY}`;
                    const res = await axios.get(dlApiUrl, { timeout: 60000 }); 
                    
                    const resData = res.data?.data?.result;
                    const dlUrl = resData?.dl_link;

                    if (!res.data?.status || !dlUrl) {
                        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                        return reply("❌ *මෙම වීඩියෝව සඳහා Download Link එකක් ලබා ගත නොහැක.*");
                    }

                    videoTitle = resData.title || videoTitle;
                    const views = resData.views || "Unknown";
                    const likes = resData.likes || "Unknown";

                    let caption = `*🔞 SADEW-MINI X-VIDEOS DOWNLOADER*\n\n` +
                                  `🎬 *Title:* ${videoTitle}\n` +
                                  `👁️ *Views:* ${views}\n` +
                                  `👍 *Likes:* ${likes}\n` +
                                  `> *👑 SADEW-MINI 👑*`;

                    let sizeMB = "Unknown";
                    try {
                        const headRes = await axios.head(dlUrl, { timeout: 30000 });
                        const contentLength = headRes.headers['content-length'];
                        if (contentLength) {
                            sizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
                        }
                    } catch (e) {
                        console.log("HEAD request failed, moving on...");
                    }

                    await reply(`📥 *Downloading...*\n🎬 ${videoTitle.substring(0, 30)}...\n📦 Size: ~${sizeMB} MB\n⏳ _Directly streaming..._`);
                    await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
                    
                    const streamRes = await axios({
                        method: 'GET',
                        url: dlUrl,
                        responseType: 'stream',
                        timeout: 0,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });

                    await socket.sendMessage(sender, {
                        document: { stream: streamRes.data },
                        mimetype: 'video/mp4',
                        fileName: `${videoTitle.replace(/[^a-zA-Z0-9]/g, "_")}.mp4`,
                        caption: caption
                    }, { quoted: msg });

                    return await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

                } catch (e) {
                    console.error(e);
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply(`❌ *බාගත කිරීම අසාර්ථක විය (Stream Error).*`);
                }
            }

            // ==============================================================
            // 2. SEARCH LOGIC (නමක් Search කළොත්)
            // ==============================================================
            try {
                await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

                const searchUrl = `https://mizuki-md-api.netlify.app/api/search/xvideo?q=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                
                const items = res.data?.data || [];
                if (!res.data?.status || items.length === 0) {
                    await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    return reply("❌ *සමාවෙන්න, ප්‍රතිඵල කිසිවක් සොයාගත නොහැකි විය!*");
                }

                let listText = `*🔞 SADEW-MINI X-VIDEOS SEARCH*\n\n`;
                let buttons = [];

                let count = 0;
                for (const item of items) {
                    if (count >= 10) break;

                    // වෙනස් ID එකක් හදනවා dl_ වලින් පටන් ගන්න
                    const shortId = "dl_" + crypto.randomBytes(3).toString('hex');
                    global.xvStore[shortId] = { 
                        url: item.url, 
                        title: item.title, 
                        thumb: item.thumb,
                        duration: item.duration 
                    };

                    count++;
                    listText += `*${count}.* ${item.title}\n⏱️ *Duration:* ${item.duration}\n\n`;
                    
                    buttons.push({
                        buttonId: `.xv ${shortId}`, // මෙතනත් යන්නේ .xv මයි!
                        buttonText: { displayText: `📥 DOWNLOAD ${count}` },
                        type: 1
                    });
                }

                if (buttons.length === 0) {
                    return reply("❌ *සමාවෙන්න, නිවැරදි ප්‍රතිඵල සොයාගත නොහැකි විය!*");
                }

                listText += `> *ඔබට අවශ්‍ය වීඩියෝව පහතින් තෝරන්න 👇*`;

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
    }
};
