const { fbdl } = require('api-dylux');
const axios = require('axios');

module.exports = {
    name: "facebook-dl",
    category: 1, 
    description: "Download Facebook Videos in HD/SD.",
    commands: ["fb", "fbdl", "facebook"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const url = args.join(" ");

        if (!url) return reply("📌 *කරුණාකර Facebook Video ලින්ක් එකක් ලබා දෙන්න!*\n💡 උදා: `.fb https://www.facebook.com/watch/?v=123456789`");

        // Basic FB URL validation
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return reply("❌ *Error:* කරුණාකර නිවැරදි Facebook Video ලින්ක් එකක් ලබා දෙන්න.");
        }

        await socket.sendMessage(actualSender, { text: "⏳ _Video එක Download කරමින් පවතී... කරුණාකර රැඳී සිටින්න._" });

        try {
            // 1. api-dylux හරහා විස්තර ගැනීම (NPM Package එක Test කිරීම)
            const result = await fbdl(url);

            if (!result || (!result.video_hd && !result.video_sd && !result.hd && !result.sd)) {
                return reply("❌ *Error:* Video එක සොයාගත නොහැකි විය. Private Group/Profile එකක Video එකක් විය හැක.");
            }

            // HD ලින්ක් එක ගන්නවා, HD නැත්නම් SD ගන්නවා
            const videoUrl = result.video_hd || result.hd || result.video_sd || result.sd;
            const title = result.title || "Facebook Video";
            const quality = result.video_hd || result.hd ? 'HD' : 'SD';

            const caption = `🎬 *Facebook Downloader*\n\n📌 *Title:* ${title}\n✨ *Quality:* ${quality}\n\n╰┈⪼ _Downloaded Successfully_ ⪻`;

            // වීඩියෝ එක යැවීම
            await socket.sendMessage(actualSender, { 
                video: { url: videoUrl }, 
                caption: caption 
            });

        } catch (error) {
            console.log("Dylux NPM Error, Trying Fallback API:", error.message);
            
            // 2. NPM එක වැඩ කරේ නැත්නම් Public API එකක් හරහා ගන්නවා (Fallback)
            try {
                const fallback = await axios.get(`https://api.vreden.my.id/api/fbdl?url=${encodeURIComponent(url)}`);
                if (fallback.data && fallback.data.result) {
                    
                    const vidUrl = fallback.data.result.hd || fallback.data.result.sd || fallback.data.result.video;
                    const titleFallback = fallback.data.result.title || "Facebook Video";
                    const qualityFallback = fallback.data.result.hd ? 'HD' : 'SD';

                    await socket.sendMessage(actualSender, { 
                        video: { url: vidUrl }, 
                        caption: `🎬 *Facebook Downloader*\n\n📌 *Title:* ${titleFallback}\n✨ *Quality:* ${qualityFallback}\n\n╰┈⪼ _Downloaded Successfully_ ⪻` 
                    });
                    return;
                }
            } catch (e2) {
                console.log("Fallback API Error:", e2.message);
            }

            reply("❌ *Internal Error:* Video එක Download කිරීමට නොහැකි විය. (Link එක Private හෝ ලින්ක් එක අවලංගු වී ඇත).");
        }
    }
};
