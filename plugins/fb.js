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

        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return reply("❌ *Error:* කරුණාකර නිවැරදි Facebook Video ලින්ක් එකක් ලබා දෙන්න.");
        }

        await socket.sendMessage(actualSender, { text: "⏳ _Video එක Download කරමින් පවතී... කරුණාකර රැඳී සිටින්න._" });

        let videoUrl = null;
        let quality = 'SD';
        let title = "Facebook Video";

        // 🟢 1. උත්සාහය: @bochilteam/scraper (ඔයාගේ NPM Package එක)
        try {
            const { facebookdl, facebookdlv2 } = require('@bochilteam/scraper');
            let res = await facebookdl(url).catch(() => facebookdlv2(url));
            if (res && res.length > 0) {
                const hd = res.find(v => v.resolution === '720p (HD)' || v.resolution.includes('HD'));
                if (hd) {
                    videoUrl = hd.url;
                    quality = 'HD';
                } else {
                    videoUrl = res[0].url;
                    quality = 'SD';
                }
            }
        } catch (e1) {
            console.log("Bochilteam FB Scraper Failed:", e1.message);
        }

        // 🟡 2. උත්සාහය: BK9 API (ලෝකේ තියෙන හොඳම Public API එකක්)
        if (!videoUrl) {
            try {
                const { data } = await axios.get(`https://bk9.fun/scraper/fb?url=${encodeURIComponent(url)}`);
                if (data && data.status && data.BK9) {
                    videoUrl = data.BK9.HD || data.BK9.SD;
                    quality = data.BK9.HD ? 'HD' : 'SD';
                    title = data.BK9.title || title;
                }
            } catch (e2) {
                console.log("BK9 FB API Failed:", e2.message);
            }
        }

        // 🟠 3. උත්සාහය: api-dylux (පරණ NPM Package එක)
        if (!videoUrl) {
            try {
                const { fbdl } = require('api-dylux');
                const res = await fbdl(url);
                if (res) {
                    videoUrl = res.video_hd || res.hd || res.video_sd || res.sd;
                    quality = res.video_hd || res.hd ? 'HD' : 'SD';
                    title = res.title || title;
                }
            } catch (e3) {
                console.log("Dylux FB Failed:", e3.message);
            }
        }

        // 🔴 ඔක්කොම ෆේල් වුණොත් (100% ක් ලින්ක් එක Private)
        if (!videoUrl) {
            return reply("❌ *Error:* Video එක Download කිරීමට නොහැකි විය. (මෙම ලින්ක් එක Private Group එකක, Private Profile එකක හෝ වයස් සීමාවක් ඇති Video එකක් විය හැක).");
        }

        // ✅ වීඩියෝ එක යැවීම
        const caption = `🎬 *Facebook Downloader*\n\n📌 *Title:* ${title}\n✨ *Quality:* ${quality}\n\n╰┈⪼ _Downloaded Successfully_ ⪻`;

        try {
            await socket.sendMessage(actualSender, { 
                video: { url: videoUrl }, 
                caption: caption 
            });
        } catch (sendError) {
            reply("❌ *Error:* Video ෆයිල් එක ලොකු වැඩි නිසා හෝ සේවාදායක දෝෂයක් නිසා යැවීමට නොහැකි විය.");
        }
    }
};
