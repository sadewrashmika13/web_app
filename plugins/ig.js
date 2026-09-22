const axios = require('axios');

module.exports = {
    name: "instagram-downloader",
    category: 1,
    description: "Download Instagram Reels (Heroku Fix)",
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
            await socket.sendMessage(sender, { text: `📥 *Instagram Media Download කරමින්...*\n_රැඳී සිටින්න..._` }, { quoted: msg });

            // 1. අලුත් API එකට Request එක යැවීම
            const apiUrl = `https://instadl.kcey.workers.dev/?url=${encodeURIComponent(url)}`;
            const apiResponse = await axios.get(apiUrl);
            
            const data = apiResponse.data;

            // API එකෙන් ලින්ක් එක ඇවිත්ද කියලා චෙක් කිරීම
            if (!data.status || !data.downloads || !data.downloads.video) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                return await socket.sendMessage(sender, { text: `❌ *Download Link එක සොයාගැනීමට නොහැක!*` }, { quoted: msg });
            }

            const downloadUrl = data.downloads.video;
            
            // 2. Heroku Block එක Bypass කරන්න Buffer එකක් විදිහට වීඩියෝව බාගැනීම
            const videoResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 60000 // ලොකු ෆයිල් බාන්න තත්පර 60ක් දෙනවා
            });

            const mediaBuffer = Buffer.from(videoResponse.data, 'binary');

            const caption = `*↳ ❝ [📸 𝗜𝗻𝘀𝘁𝗮𝗴𝗿𝗮𝗺 𝗗𝗟 📸] ¡! ❞*\n\n` +
                            `📡 *API:* ${data.creator || 'KCeY'}\n` +
                            `🔗 *Quality:* HD\n\n` +
                            `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            // 3. Buffer එක කෙලින්ම WhatsApp එකට යැවීම
            await socket.sendMessage(sender, { 
                video: mediaBuffer, 
                mimetype: 'video/mp4', 
                caption: caption 
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("IG Error:", e.message);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            await socket.sendMessage(sender, { 
                text: `❌ *Instagram Download Error!*\n_${e.message}_\n\n> *Heroku IP Block එකක් හෝ ලින්ක් එකේ දෝෂයක් විය හැක.*` 
            }, { quoted: msg });
        }
    }
};
