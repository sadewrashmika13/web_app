const axios = require('axios');
const moment = require('moment-timezone');
const crypto = require('crypto');

// ═══════ API CONFIG & SHORT STORE ═══════
const API_TOKEN = "4ehG6P";
const BASE_API_URL = "https://whiteshadow-x-api.onrender.com/api/download/getmodapk";
const botName = "👑 SADEW-MINI 👑";

if (!global.getmodStore) global.getmodStore = {};

const metaQuote = {
    key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_GETMOD" },
    message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew GetModApk\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
};

module.exports = {
    name: "getmodapk",
    category: 1, // Download Menu
    description: "Search and download MOD APKs from GetModApk",
    commands: ["mod3", "getmod", "getmoddl"], 
    
    async handler({ socket, msg, sender, args, command, reply, sessionConfig }) {
        try {
            const prefix = sessionConfig?.PREFIX || '.';

            // ── 1. MOD SEARCH & BUTTON GENERATION ──
            if (command === "mod3" || command === "getmod") {
                const query = args.join(' ').trim();
                if (!query) return reply(`🎮 *කරුණාකර Game හෝ App එකක නමක් ලබා දෙන්න!*\n\n💡 උදා: \`${prefix}mod3 subway surfers\` හෝ \`${prefix}getmod tiktok\``);

                try { await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } }); } catch (_) {}
                reply(`🔍 _*${query}* සොයමින් පවතී... කරුණාකර රැඳී සිටින්න._`);

                const apiUrl = `${BASE_API_URL}?q=${encodeURIComponent(query)}&auto=true&apitoken=${API_TOKEN}`;
                const response = await axios.get(apiUrl, { timeout: 30000 });
                const data = response.data;

                if (!data || !data.status || !data.result || !data.result.directFileLinks || data.result.directFileLinks.length === 0) {
                    try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return reply("❌ *සමාවෙන්න, එම නමින් Mod එකක් සොයාගැනීමට නොහැකි විය!*");
                }

                const appDetails = data.result;
                const title = appDetails.title || "Modded App";
                const version = appDetails.version || "Unknown";
                const size = appDetails.size || "Unknown";
                const desc = appDetails.description || "N/A";
                
                const topLinks = appDetails.directFileLinks.slice(0, 3);
                let fileDetailsText = `*📦 AVAILABLE MOD FILES:*\n`;
                const buttons = [];

                topLinks.forEach((link, index) => {
                    const fileNameMatch = link.url.match(/\/([^\/?#]+)$/);
                    const exactFileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : "Unknown File";
                    fileDetailsText += `*${index + 1}.* 📥 ${link.label}\n╰┈➤ _${exactFileName}_\n\n`;

                    const shortId = crypto.randomBytes(4).toString('hex');
                    global.getmodStore[shortId] = {
                        url: link.url,
                        title: title
                    };

                    setTimeout(() => {
                        if (global.getmodStore[shortId]) delete global.getmodStore[shortId];
                    }, 15 * 60 * 1000);

                    buttons.push({
                        buttonId: `${prefix}getmoddl ${shortId}`, 
                        buttonText: { displayText: `📥 ${link.label || 'Download'}` },
                        type: 1
                    });
                });

                const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
                const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

                let caption = `*↳ ❝ [🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮] ¡! ❞*\n\n` +
                              `📱 *NAME :* ${title}\n` +
                              `🏷️ *VERSION :* ${version}\n` +
                              `⚖️ *SIZE :* ${size}\n` +
                              `📝 *INFO :* ${desc}\n` +
                              `__________________________\n\n` +
                              `${fileDetailsText}` +
                              `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                              `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;

                const defaultImage = global.akira || 'https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg';

                const buttonMessage = {
                    image: { url: defaultImage },
                    caption: caption,
                    footer: botName,
                    buttons: buttons,
                    headerType: 4
                };

                await socket.sendMessage(sender, buttonMessage, { quoted: metaQuote });
            }

            // ── 2. HIDDEN DOWNLOADER (BUTTON CLICK CATCHER) ──
            else if (command === "getmoddl") {
                const shortId = args[0]?.trim();
                const storedData = global.getmodStore[shortId];
                
                if (!storedData || !storedData.url) {
                    return reply("❌ *සමාවෙන්න, ලින්ක් එක කල් ඉකුත් වී ඇත. කරුණාකර මුල සිට Search කරන්න.*");
                }

                const downloadUrl = storedData.url;
                const appTitle = storedData.title;

                try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch (_) {}
                
                reply(`📥 _*🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*_ Downloading APK File... (කරුණාකර රැඳී සිටින්න)_`);

                const slDate = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
                const slTimeNow = moment().tz('Asia/Colombo').format('HH:mm:ss');

                let caption = `*↳ ❝ [🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮] ¡! ❞*\n\n` +
                              `📱 *File:* ${appTitle}\n` +
                              `__________________________\n\n` +
                              `📅 *DATE :* ${slDate} | ⌚ *TIME :* ${slTimeNow}\n\n` +
                              `> *🔮 ⟡ ꜱ ᴀ ᴅ ᴇ ᴡ - ᴍ ɪ ɴ ɪ ⟡ 🔮*`;

                // 🎯 APK Name first, then 'by_sadew_mini' at the end
                const safeAppName = appTitle.replace(/[^a-zA-Z0-9._-]/g, '_');
                const customFileName = `${safeAppName}_by_sadew_mini.apk`;

                // Direct URL Stream
                await socket.sendMessage(sender, {
                    document: { url: downloadUrl },
                    mimetype: 'application/vnd.android.package-archive',
                    fileName: customFileName,
                    caption: caption
                }, { quoted: metaQuote });

                try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (_) {}
            }

        } catch (e) {
            console.log("MOD3 PLUGIN ERROR:", e.message);
            reply("❌ *ERROR: සේවාදායකයේ ගැටලුවක්! කරුණාකර පසුව නැවත උත්සාහ කරන්න.*");
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (_) {}
        }
    }
};