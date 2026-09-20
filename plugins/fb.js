const axios = require('axios');

module.exports = {
    name: "facebook-dl",
    category: 1, 
    description: "Download Facebook Videos using KCeY API.",
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
            // API URL එක තෝරාගැනීම (ඔයා කිව්ව විදිහට)
            let apiUrl = "";
            if (url.includes('fb.watch')) {
                apiUrl = `https://fbdl.kcey.workers.dev/?url=${encodeURIComponent(url)}`;
            } else {
                apiUrl = `https://fbdl.kcey.workers.dev/?fb=${encodeURIComponent(url)}`;
            }

            const { data } = await axios.get(apiUrl, { timeout: 20000 });

            if (!data || !data.status) {
                return reply("❌ *Error:* API එකෙන් Video එක සොයාගත නොහැකි විය.");
            }

            // 📌 ඔයා එවපු ලොග් එකට හරියටම ගැලපෙන විදිහට Data අල්ලගැනීම 📌
            const title = data.metadata?.title || "Facebook Video";
            let videoUrl = null;
            let quality = "SD";

            // Links array එකෙන් HD හෝ SD හොයාගැනීම
            if (data.downloads && Array.isArray(data.downloads.links) && data.downloads.links.length > 0) {
                const links = data.downloads.links;

                // 1. Array එක ඇතුලේ HD තියෙනවද කියලා බලනවා
                const hdObj = links.find(l => JSON.stringify(l).toUpperCase().includes('HD'));
                
                if (hdObj) {
                    // API එකේ Key එක මොකක් වුණත් ලින්ක් එක අල්ලගන්න පුළුවන් විදිහට හැදුවා
                    videoUrl = hdObj.url || hdObj.download || Object.values(hdObj).find(v => typeof v === 'string' && v.startsWith('http'));
                    quality = "HD";
                }

                // 2. HD නැත්නම් මුලින්ම තියෙන ලින්ක් එක (SD) ගන්නවා
                if (!videoUrl) {
                    const first = links[0];
                    videoUrl = first.url || first.download || Object.values(first).find(v => typeof v === 'string' && v.startsWith('http'));
                }
            }

            if (!videoUrl) {
                return reply("❌ *Error:* API එකෙන් Video ලින්ක් එක ලබාගැනීමට නොහැකි විය.");
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
