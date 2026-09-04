const axios = require('axios');
const moment = require('moment-timezone');

// ═══════ API CONFIG (Handler එකෙන් පිටතට ගත්තා) ═══════
const API_TOKEN = "4ehG6P";
const BASE_API_URL = "https://whiteshadow-x-api.onrender.com/api/download/apkmody";

module.exports = {
    name: "mod-apkmody",
    category: 1, // Download Menu
    description: "Search and download MOD APKs from APKMody",
    commands: ["mod2", "apkmody", "game"],
    
    async handler({ socket, msg, sender, args, reply }) {
        try {
            const query = args.join(' ').trim();
            if (!query) return reply("🎮 *කරුණාකර Game හෝ App එකක නමක් ලබා දෙන්න!*\n\n💡 උදා: `.mod2 subway surfers`");

            try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}
            reply(`🔍 _*${query}* සොයමින් පවතී... කරුණාකර රැඳී සිටින්න._`);

            const apiUrl = `${BASE_API_URL}?q=${encodeURIComponent(query)}&auto=true&apitoken=${API_TOKEN}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });
            const data = response.data;

            // API Validation
            if (!data || !data.status || !data.result || !data.result.downloads || data.result.downloads.length === 0) {
                try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return reply("❌ *සමාවෙන්න, එම නමින් Mod එකක් සොයාගැනීමට නොහැකි විය!*");
            }

            const appDetails = data.result;
            const dlDetails = appDetails.downloads[0]; 

            const appName = appDetails.title || "Modded App";
            const appVersion = appDetails.version || "Unknown";
            const modInfo = appDetails.mod || "N/A";
            const fileSize = dlDetails.size || "Unknown";
            const downloadUrl = dlDetails.url;

            if (!downloadUrl) {
                try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return reply("❌ *Download Link එක සොයාගැනීමට නොහැකි විය!*");
            }

            // Filename Sanitization (විශේෂ සංකේත ඉවත් කිරීම)
            const rawFileName = dlDetails.fileName || `${appName}_Mod.apk`;
            const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

            // Icon Fallback
            const appIcon = appDetails.icon || global.akira || 'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg';

            const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
            const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

            let caption = `*↳ ❝🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮.apk ¡! ❞*\n\n` +
                          `📱 *NAME :* ${appName}\n` +
                          `🏷️ *VERSION :* ${appVersion}\n` +
                          `⚙️ *MOD INFO :* ${modInfo}\n` +
                          `⚖️ *SIZE :* ${fileSize}\n` +
                          `__________________________\n\n` +
                          `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                          `> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

            try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}

            // 1. Icon එක යැවීම (Image එක Fail වුණත් APK එක යන විදිහට Try/Catch දැම්මා)
            try {
                await socket.sendMessage(sender, {
                    image: { url: appIcon },
                    caption: caption
                }, { quoted: msg });
            } catch (imgErr) {
                console.log("APK Icon Send Failed, sending text caption instead:", imgErr.message);
                await reply(caption);
            }

            // 2. Direct Stream APK Document
            await socket.sendMessage(sender, {
                document: { url: downloadUrl },
                mimetype: 'application/vnd.android.package-archive',
                fileName: safeFileName,
                caption: `📥 *${appName}* Mod Apk`
            }, { quoted: msg });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (e) {
            console.log("MOD2 PLUGIN ERROR:", e.message);
            reply("❌ *ERROR: සේවාදායකයේ ගැටලුවක්! කරුණාකර පසුව නැවත උත්සාහ කරන්න.*");
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    }
};