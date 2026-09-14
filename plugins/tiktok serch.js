const axios = require('axios');

module.exports = {
    name: "tiktoksearch",
    category: 1,
    description: "Search and download 10 TikTok videos directly",
    commands: ["ts"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply("🎥 *කරුණාකර TikTok වීඩියෝවක් සෙවීමට නමක් ලබා දෙන්න!*\n💡 `.ts mrbeast`");

        try {
            await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            await reply(`🔍 _Searching TikTok for: "${query}"... Please wait!_`);

            // Kavindu API එකෙන් Search කිරීම
            const searchUrl = `https://kavindu-download-web.vercel.app/api/search/tiktok?q=${encodeURIComponent(query)}`;
            const { data } = await axios.get(searchUrl);

            if (!data.status || !data.result || data.result.length === 0) {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                return reply("❌ *සෙවූ වීඩියෝව හමු වුනේ නැහැ.*");
            }

            // මුල් වීඩියෝ 10 වෙන් කරගැනීම
            const results = data.result.slice(0, 10);
            
            await reply(`✅ *වීඩියෝ ${results.length} ක් සොයාගත්තා. දැන් එකින් එක එවනු ලැබේ... (තත්පර 3ක පරතරයකින්)*`);

            // වීඩියෝ 10 එකින් එක යැවීම (Loop එක)
            for (let i = 0; i < results.length; i++) {
                const video = results[i];
                const videoUrl = video.play; // No Watermark Video (Top Quality)
                
                if (!videoUrl) continue;

                const title = video.title || 'No Title';
                const author = video.author?.nickname || 'Unknown';
                const views = video.play_count || 0;

                const caption = `*🎬 Title:* ${title}\n👤 *Author:* ${author}\n👁️ *Views:* ${views}\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                try {
                    // කෙලින්ම URL එකෙන් වීඩියෝ එක යවනවා (RAM එකට බර නෑ)
                    await socket.sendMessage(sender, {
                        video: { url: videoUrl },
                        caption: caption,
                        mimetype: 'video/mp4'
                    }, { quoted: msg });
                } catch (sendErr) {
                    console.error(`Failed to send video ${i+1}:`, sendErr.message);
                }

                // ඊළඟ වීඩියෝව යවන්න කලින් තත්පර 3ක Delay එකක් දෙනවා
                if (i < results.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await reply("✅ *වීඩියෝ සියල්ලම යවා අවසන්!*");

        } catch (e) {
            console.error("[tiktok search] Error:", e.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply(`❌ *Search error: ${e.message}*`);
        }
    }
};
