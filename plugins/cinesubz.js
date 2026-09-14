const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE 
// ════════════════════════════════════════════════════════
if (!global.czStore) global.czStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 15 * 60 * 1000) {
    const id = genId();
    global.czStore[id] = data;
    setTimeout(() => { delete global.czStore[id]; }, ttlMs);
    return id;
}

function parseCineSend(fullText) {
    if (!fullText) return { query: "", targetJid: null };
    let raw = fullText.trim();
    let targetJid = null;
    let query = raw;

    const endMatch = raw.match(/(?:,|\s)*([0-9]+@g\.us|[0-9]+@s\.whatsapp\.net|\+?94[0-9]{9}|0[0-9]{9})$/i);
    if (endMatch) {
        let extracted = endMatch[1];
        let matchStr = endMatch[0];
        let matchIndex = raw.lastIndexOf(matchStr);
        if (matchIndex !== -1) query = raw.substring(0, matchIndex).replace(/,$/, '').trim();

        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) {
            targetJid = extracted;
        } else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            if (num.length >= 10) targetJid = num + '@s.whatsapp.net';
        }
    }
    return { query, targetJid };
}

module.exports = {
    name: "cinesubz-fixed",
    category: "Movies",
    description: "Download Cinesubz movies using Danuz Updated API",
    commands: ["cz", "cinesubz", "cinesend", "cs_sel", "cs_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const CZ_API = "https://cz-dnuz.vercel.app";
        
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // 1. SEARCH (.cz)
        if (command === "cz" || command === "cinesubz" || command === "cinesend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*\n_උදා: .cz batman_");

            const { query, targetJid } = parseCineSend(fullText);

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (!res.data.success || !res.data.result?.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Movies කිසිවක් හමුවූයේ නැත.*");
                }

                const topResults = res.data.result.slice(0, 10);
                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.date || 'N/A'}\n\n`;
                    const id = storeData({ url: mv.url, title: mv.title, img: mv.img, date: mv.date, targetJid: targetJid });
                    buttons.push({
                        buttonId: `.cs_sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${(mv.title || '').slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් Movie එක තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) {
                console.error(e);
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // 2. MOVIE SELECT (.cs_sel)
        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත .cz search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා Download Links සකසමින්...`);

                const movidlUrl = `${CZ_API}/movidl?url=${encodeURIComponent(movie.url)}`;
                const dlRes = await axios.get(movidlUrl, { timeout: 20000 });
                const czQualities = dlRes.data.result?.downloads || [];

                if (!czQualities.length) {
                    delete global.czStore[id];
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links හමු නොවිණි.*");
                }

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                czQualities.forEach((dl) => {
                    let label = dl.meta || 'HD'; 
                    let cleanLabel = label.split('•').map(x => x.trim()).join(' | ');

                    // API ටෙස්ට් එකට අනුව resolvedUrl තමයි නියම ලින්ක් එක
                    let rawLink = dl.resolvedUrl || dl.ztLink || dl.link || dl.url || "";

                    const dlId = storeData({
                        title: movie.title,
                        qualityLabel: cleanLabel,
                        rawLink: rawLink, 
                        targetJid: movie.targetJid,
                        img: movie.img, 
                        date: movie.date
                    });

                    buttons.push({
                        buttonId: `.cs_dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${cleanLabel}` },
                        type: 1
                    });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });
                delete global.czStore[id];
            } catch (e) {
                console.error(e);
                reply("❌ *Movie details ලබා ගැනීමේ දෝෂයක්.*");
            }
        }

        // 3. DOWNLOAD (.cs_dl) - ✅ 100% FIXED WITH LIVE API TEST
        else if (command === "cs_dl") {
            const id = args[0];
            const dl = global.czStore[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");
            if (!dl.rawLink) return reply("❌ *Download link එක හමුවූයේ නැත.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) await reply(`🚀 *[CineSend]* \`${dl.title}\` (${dl.qualityLabel}) ඩවුන්ලෝඩ් කරමින් පවතී...`);
                else await reply(`📥 *Downloading ${dl.title}*\n🎯 ${dl.qualityLabel}\n_Direct MP4 Link එක ලබාගනිමින් පවතී..._`);

                let apiEndpoint = "";
                if (dl.rawLink.includes("zt-links") || dl.rawLink.includes("cinesubz.net/api-")) {
                    apiEndpoint = `${CZ_API}/resolve?url=${encodeURIComponent(dl.rawLink)}`;
                } else {
                    apiEndpoint = `${CZ_API}/download?url=${encodeURIComponent(dl.rawLink)}`;
                }

                const apiRes = await axios.get(apiEndpoint, { timeout: 20000 });
                let finalMp4Url = "";

                // Danuz ගේ API එකෙන් එන JSON එක හරියටම කියවීම
                if (apiRes.data?.result?.downloadUrls) {
                    // Telegram එක නැති Direct Server ලින්ක් එක තෝරාගැනීම
                    let dls = apiRes.data.result.downloadUrls;
                    let direct = dls.find(x => !x.url.includes("telegram.me"));
                    finalMp4Url = direct ? direct.url : dls[0].url;
                } else if (apiRes.data?.result?.url) {
                    finalMp4Url = apiRes.data.result.url;
                } else if (typeof apiRes.data?.result === 'string') {
                    finalMp4Url = apiRes.data.result;
                } else if (apiRes.data?.url) {
                    finalMp4Url = apiRes.data.url;
                }

                if (!finalMp4Url || !finalMp4Url.startsWith("http")) {
                    return reply("❌ *Direct MP4 Link එක සර්වර් එකෙන් ලබාගැනීමට නොහැකි විය!*");
                }

                const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗩𝗜𝗗𝗘𝗢 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${dl.title}\n📽 *Quality:* ${dl.qualityLabel}\n📅 *Year:* ${dl.date || 'N/A'}\n\n` +
                    `🍿 *වීඩියෝව පහතින් ලබාගන්න.* \n\n> 👑 *SADEW-MINI* 👑`;

                const fileName = `${(dl.title || 'Video').substring(0, 40).replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${dl.qualityLabel.includes('480') ? '480p' : (dl.qualityLabel.includes('1080') ? '1080p' : '720p')}.mp4`;

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                // නියම Direct MP4 URL එකෙන් වීඩියෝව Stream කිරීම
                const streamRes = await axios({
                    method: 'GET', 
                    url: finalMp4Url, 
                    responseType: 'stream', 
                    timeout: 300000,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    maxRedirects: 10
                });

                let actualSize = 'Unknown';
                const cl = parseInt(streamRes.headers['content-length'] || '0');
                if (cl) actualSize = (cl / 1024 / 1024).toFixed(1) + ' MB';

                const finalCap = `🎬 *Name:* ${dl.title}\n📽 *Quality:* ${dl.qualityLabel}\n📦 *Size:* ${actualSize}\n\n> 👑 *SADEW-MINI* 👑`;

                await socket.sendMessage(destJid, {
                    document: { stream: streamRes.data },
                    mimetype: "video/mp4", fileName: fileName, caption: finalCap
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e2) {
                console.error("[CZ] Stream failed:", e2.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක්. (" + e2.message + ")");
            }
            delete global.czStore[id];
        }
    }
};
