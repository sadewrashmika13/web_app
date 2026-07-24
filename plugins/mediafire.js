const axios = require("axios");

module.exports = {
    name: "mediafire",
    category: 1, // 1 = Download Menu
    description: "📥 කිසිදු API එකක් නොමැතිව කෙලින්ම MediaFire ෆයිල් ඩවුන්ලෝඩ් කරන්න",
    commands: ["mf", "mediafire", "mfdl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        try {
            const rawInput = args.join(" ").trim();
            
            if (!rawInput) {
                return reply(`📥 *MediaFire Downloader*\n\n*Usage:* .mediafire <mediafire_url>\n*Example:* .mediafire https://www.mediafire.com/file/xxxxx/test.zip`);
            }

            // ලින්ක් එක ක්ලීන් කර ගැනීම
            const mediafireRegex = /(https?:\/\/(?:www\.)?mediafire\.com\/[^\s]+)/;
            const match = rawInput.match(mediafireRegex);

            if (!match) {
                return reply("❌ *කරුණාකර වලංගු MediaFire ලින්ක් එකක් ලබා දෙන්න!*");
            }

            const cleanedUrl = match[0];
            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

            console.log(`[MediaFire] Direct Scrape එකක් පටන් ගන්නවා: ${cleanedUrl}`);

            let downloadUrl = null;
            let fileName = "MediaFire_File";
            let fileSize = "Unknown";

            // 🕵️‍♂️ ක්‍රමය 1: කෙලින්ම MediaFire වෙබ් පිටුවට රික්වෙස්ට් එකක් යවා HTML එක ගන්නවා
            try {
                const pageResponse = await axios.get(cleanedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 15000
                });

                const html = pageResponse.data;

                // HTML එක ඇතුලෙන් Direct Download Link එක Regex එකක් මඟින් ඇදලා ගන්නවා
                const dlMatch = html.match(/https?:\/\/download[0-9]+\.mediafire\.com\/[^\s"']+/);
                if (dlMatch) {
                    downloadUrl = dlMatch[0];
                }

                // HTML එක ඇතුලෙන් ෆයිල් එකේ නම ගන්නවා
                const nameMatch = html.match(/<div class="filename">([^<]+)<\/div>/) || html.match(/property="og:title" content="([^"]+)"/);
                if (nameMatch) fileName = nameMatch[1].trim();

                // HTML එක ඇතුලෙන් ෆයිල් සයිස් එක ගන්නවා
                const sizeMatch = html.match(/<span>\(([^)]+)\)<\/span>/) || html.match(/class="details">[^<]*<li><span>File size:<\/span><span>([^<]+)<\/span>/);
                if (sizeMatch) fileSize = sizeMatch[1].trim();

            } catch (scrapeError) {
                console.log("[MediaFire] Direct Scrape එක ෆේල් වුණා, Backup API එකට මාරු වෙනවා...");
            }

            // 🛠️ ක්‍රමය 2: කිසිසේත්ම Direct Scrape එක වැඩ නොකලොත් විතරක් ක්‍රියාත්මක වන Backup API එකක්
            if (!downloadUrl) {
                try {
                    const backupApi = `https://api.lolhuman.xyz/api/mediafire?apikey=GataDios&url=${encodeURIComponent(cleanedUrl)}`;
                    const apiRes = await axios.get(backupApi, { timeout: 15000 });
                    
                    if (apiRes.data && apiRes.data.result) {
                        downloadUrl = apiRes.data.result.link || apiRes.data.result.url;
                        fileName = apiRes.data.result.filename || fileName;
                        fileSize = apiRes.data.result.size || fileSize;
                    }
                } catch (apiErr) {
                    console.log("[MediaFire] Backup API එකත් ෆේල්!");
                }
            }

            // 📤 ෆයිල් එක WhatsApp එකට යැවීම
            if (downloadUrl) {
                await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });

                let caption = `*↳ ❝ [🎀 𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗠𝗲𝗱𝗶𝗮𝗙𝗶𝗿𝗲 🎀] ¡! ❞*\n\n`;
                caption += `📛 *Name:* ${fileName}\n`;
                caption += `⚖️ *Size:* ${fileSize}\n\n`;
                caption += `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // ෆයිල් එක ඩොකියුමන්ට් එකක් විදිහට සෙන්ඩ් කිරීම (Baileys URL stream ක්‍රමය)
                await socket.sendMessage(sender, {
                    document: { url: downloadUrl },
                    fileName: fileName,
                    mimetype: "application/octet-stream",
                    caption: caption
                }, { quoted: msg });

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            } else {
                await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                reply("❌ *කණගාටුයි මචං, MediaFire සර්වර් එකෙන් ඩේටා ඇදලා ගන්න බැහැ. ලින්ක් එක වලංගු දැයි පරීක්ෂා කර නැවත උත්සාහ කරන්න.*");
            }

        } catch (error) {
            console.error("MediaFire Error:", error.message);
            await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            reply("❌ *අනපේක්ෂිත Error එකක් මතු විය!*");
        }
    }
};
