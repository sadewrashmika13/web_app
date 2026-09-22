const axios = require('axios');

module.exports = {
    name: "instagram-downloader",
    category: 1,
    description: "Download Instagram Reels (Super Fast Stream)",
    commands: ["ig", "insta", "instagram"],

    handler: async ({ socket, msg, sender, command, args }) => {
        const url = args.join(" ").trim();

        if (!url || !url.includes("instagram.com")) {
            return await socket.sendMessage(sender, {
                text: `❌ *Instagram Link එකක් දෙන්න!*\n\n📌 *උදාහරණ:*\n.ig https://www.instagram.com/reel/xxx`
            }, { quoted: msg });
        }

        try {
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

            // 1. අලුත් API එකට Request එක යැවීම
            const apiUrl = `https://instadl.kcey.workers.dev/?url=${encodeURIComponent(url)}`;
            const apiResponse = await axios.get(apiUrl);
            const data = apiResponse.data;

            if (!data.status || !data.downloads || !data.downloads.video) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                return await socket.sendMessage(sender, { text: `❌ *Download Link එක සොයාගැනීමට නොහැක!*` }, { quoted: msg });
            }

            const downloadUrl = data.downloads.video;
            
            // 2. Buffer නොකර කෙලින්ම Stream කිරීම (වේගවත්ම ක්‍රමය)
            const streamResponse = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream', // 🔥 Buffer වෙනුවට කෙලින්ම Stream කරනවා
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                }
            });

            const caption = `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗟 📸] ¡! ❞*\n\n` +
                            `📡 *API:* ${data.creator || 'KCeY'}\n` +
                            `🔗 *Quality:* HD\n\n` +
                            `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            // 3. Stream එක කෙලින්ම Baileys හරහා WhatsApp එකට යැවීම
            await socket.sendMessage(sender, { 
                video: { stream: streamResponse.data }, // 🔥 මෙතනින් Stream එකම දෙනවා
                mimetype: 'video/mp4', 
                caption: caption 
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("IG Stream Error:", e.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await socket.sendMessage(sender, { 
                text: `❌ *Instagram Download Error!*\n_${e.message}_\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*` 
            }, { quoted: msg });
        }
    }
};
