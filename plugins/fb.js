const axios = require('axios');

module.exports = {
    name: "facebook-dl",
    category: 1, 
    description: "Download Facebook Videos in HD/SD.",
    commands: ["fb", "fbdl", "facebook"],
    
    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const url = args.join(" ");

        if (!url) return reply("📌 *කරුණාකර Facebook Video ලින්ක් එකක් ලබා දෙන්න!*\n💡 උදා: `.fb https://www.facebook.com/watch/?v=...`");

        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return reply("❌ *Error:* කරුණාකර නිවැරදි Facebook Video ලින්ක් එකක් ලබා දෙන්න.");
        }

        await socket.sendMessage(actualSender, { text: "⏳ _Video එක Download කරමින් පවතී... කරුණාකර රැඳී සිටින්න._" });

        try {
            // ලින්ක් එකේ ජාතිය අනුව API එකට යවන Parameter එක තෝරාගැනීම
            let apiUrl = "";
            if (url.includes('fb.watch')) {
                apiUrl = `https://fbdl.kcey.workers.dev/?url=${encodeURIComponent(url)}`;
            } else {
                apiUrl = `https://fbdl.kcey.workers.dev/?fb=${encodeURIComponent(url)}`;
            }

            const { data } = await axios.get(apiUrl, { timeout: 20000 });

            // API එකෙන් එන Data අල්ලගැනීම
            const result = data.result || data.data || data;
            
            // HD හෝ SD ලින්ක් එක වෙන් කරගැනීම
            const hd = result.hd || result.hd_url || result.HD || result.video_hd || result.url_hd;
            const sd = result.sd || result.sd_url || result.SD || result.video_sd || result.url_sd || result.video || result.url;

            const videoUrl = hd || sd;
            const quality = hd ? 'HD' : 'SD';
            const title = result.title || result.desc || "Facebook Video";

            if (!videoUrl) {
                console.log("KCEY API Error Data:", data); 
                return reply("❌ *Error:* API එකෙන් Video ලින්ක් එක ලබාගැනීමට නොහැකි විය. (Link එක Private විය හැක).");
            }

            // ✅ වීඩියෝ එක යැවීම
            const caption = `🎬 *Facebook Downloader*\n\n📌 *Title:* ${title}\n✨ *Quality:* ${quality}\n\n╰┈⪼ _Downloaded Successfully_ ⪻`;

            await socket.sendMessage(actualSender, { 
                video: { url: videoUrl }, 
                caption: caption 
            });

        } catch (error) {
            console.log("FB DL ERROR:", error.message);
            reply("❌ *Internal Error:* Video එක Download කිරීමට නොහැකි විය. API එකෙන් ප්‍රතිචාරයක් නොමැත.");
        }
    }
};
