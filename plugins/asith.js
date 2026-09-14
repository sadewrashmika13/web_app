const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE FOR STREAMBOX
// ════════════════════════════════════════════════════════
if (!global.sbStore) global.sbStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }
function storeData(data, ttlMs = 30 * 60 * 1000) { 
    const id = genId(); 
    global.sbStore[id] = data; 
    setTimeout(() => { delete global.sbStore[id]; }, ttlMs);
    return id; 
}

// 🎯 SMART PARSER
function parseTarget(fullText) {
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

        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) targetJid = extracted;
        else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) num = '94' + num.slice(1);
            if (num.length >= 10) targetJid = num + '@s.whatsapp.net';
        }
    }
    if (!targetJid && raw.includes(',')) {
        let parts = raw.split(',');
        let lastPart = parts.pop().trim();
        let num = lastPart.replace(/[^0-9]/g, '');
        if (num.length >= 10 && num.length <= 15) { targetJid = num + '@s.whatsapp.net'; query = parts.join(',').trim(); } 
        else if (num.length > 15) { targetJid = num + '@g.us'; query = parts.join(',').trim(); }
    }
    return { query, targetJid };
}

module.exports = {
    name: "streambox-downloader",
    category: 1,
    description: "Search and download Movies & TV Shows directly from StreamBox API",
    commands: ["streambox", "sb"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const API_BASE = "https://moviebox.asitha.top/api";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_SB" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew StreamBox\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const subCmd = args[0];
        const subId = args[1];

        // ════════════════════════════════════════════════════════
        // 1. ITEM SELECTION (MOVIE OR TV) [--sbsel]
        // ════════════════════════════════════════════════════════
        if (subCmd === "--sbsel") {
            const item = global.sbStore[subId];
            if (!item) return reply("❌ *Link expired. නැවත search කරන්න.*");
            
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

            try {
                // 📺 [ TV SERIES MODE ]
                if (item.type === 2) {
                    const infoRes = await axios.get(`${API_BASE}/info/${item.subjectId}`);
                    const seasons = infoRes.data?.data?.seasons || [];
                    
                    if (!seasons.length) return reply("❌ *Seasons කිසිවක් හමු නොවිණි.*");

                    if (seasons.length > 1) {
                        let capText = `*↳ ❝ [📺 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 ] ¡! ❞*\n\n🎬 *Title:* ${item.title}\n📊 *Total Seasons:* ${seasons.length}\n\n> *අවශ්‍ය Season එක තෝරන්න* ⬇️`;
                        const buttons = [];
                        seasons.forEach(s => {
                            const sId = storeData({ ...item, se: s.se, maxEp: s.maxEp });
                            buttons.push({ buttonId: `.sb --sbsea ${sId}`, buttonText: { displayText: `Season ${s.se} (${s.maxEp} Eps)` }, type: 1 });
                        });
                        const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: item.img ? 4 : 1 };
                        if (item.img) msgOpts.image = { url: item.img };
                        return await socket.sendMessage(sender, msgOpts, { quoted: msg });
                    } else {
                        // Only 1 Season
                        const s = seasons[0];
                        let maxLimit = Math.min(s.maxEp, 70); // Button Limit Safety
                        let capText = `*↳ ❝ [📺 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 ] ¡! ❞*\n\n🎬 *Title:* ${item.title}\n📺 *Season:* ${s.se}\n\n> *අවශ්‍ය Episode එක තෝරන්න* ⬇️`;
                        const buttons = [];
                        for(let i = 1; i <= maxLimit; i++) {
                            const epId = storeData({ ...item, se: s.se, ep: i });
                            buttons.push({ buttonId: `.sb --sbep ${epId}`, buttonText: { displayText: `🎬 Episode ${i}` }, type: 1 });
                        }
                        const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: item.img ? 4 : 1 };
                        if (item.img) msgOpts.image = { url: item.img };
                        return await socket.sendMessage(sender, msgOpts, { quoted: msg });
                    }
                } 
                // 🎬 [ MOVIE MODE ]
                else {
                    const srcRes = await axios.get(`${API_BASE}/sources/${item.subjectId}`);
                    const dls = srcRes.data?.data?.downloads || [];
                    if (!dls.length) return reply("❌ *මෙම Movie එක සඳහා Download Links හමු නොවිණි.*");

                    let capText = `*↳ ❝ [🎬 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗠𝗼𝘃𝗶𝗲𝘀 ] ¡! ❞*\n\n🎬 *Title:* ${item.title}\n\n> *අවශ්‍ය Quality එක තෝරන්න* ⬇️`;
                    const buttons = [];
                    dls.forEach(dl => {
                        let url = dl.directUrl || dl.url;
                        if(url) {
                            let sizeMB = dl.size ? (parseInt(dl.size)/1024/1024).toFixed(1) + 'MB' : 'Unknown';
                            const dlId = storeData({ ...item, quality: dl.resolution, url: url, size: sizeMB });
                            buttons.push({ buttonId: `.sb --sbdl ${dlId}`, buttonText: { displayText: `🎥 ${dl.resolution} (${sizeMB})` }, type: 1 });
                        }
                    });
                    const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: item.img ? 4 : 1 };
                    if (item.img) msgOpts.image = { url: item.img };
                    return await socket.sendMessage(sender, msgOpts, { quoted: msg });
                }
            } catch (e) { return reply("❌ *දත්ත ලබා ගැනීමේ දෝෂයක්.*"); }
        }

        // ════════════════════════════════════════════════════════
        // 2. TV SERIES SEASON SELECTION [--sbsea]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--sbsea") {
            const item = global.sbStore[subId];
            if (!item) return reply("❌ *Link expired. නැවත search කරන්න.*");
            
            let maxLimit = Math.min(item.maxEp, 70); 
            let capText = `*↳ ❝ [📺 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 ] ¡! ❞*\n\n🎬 *Title:* ${item.title}\n📺 *Season:* ${item.se}\n\n> *අවශ්‍ය Episode එක තෝරන්න* ⬇️`;
            const buttons = [];
            for(let i = 1; i <= maxLimit; i++) {
                const epId = storeData({ ...item, ep: i });
                buttons.push({ buttonId: `.sb --sbep ${epId}`, buttonText: { displayText: `🎬 Episode ${i}` }, type: 1 });
            }
            const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: item.img ? 4 : 1 };
            if (item.img) msgOpts.image = { url: item.img };
            return await socket.sendMessage(sender, msgOpts, { quoted: msg });
        }

        // ════════════════════════════════════════════════════════
        // 3. EPISODE QUALITY SELECTION [--sbep]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--sbep") {
            const item = global.sbStore[subId];
            if (!item) return reply("❌ *Link expired. නැවත search කරන්න.*");
            
            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            try {
                const srcRes = await axios.get(`${API_BASE}/sources/${item.subjectId}?se=${item.se}&ep=${item.ep}`);
                const dls = srcRes.data?.data?.downloads || [];
                if (!dls.length) return reply("❌ *මෙම Episode එක සඳහා Download Links හමු නොවිණි.*");

                let capText = `*↳ ❝ [📺 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 ] ¡! ❞*\n\n🎬 *Title:* ${item.title}\n📺 *Season ${item.se} - Episode ${item.ep}*\n\n> *අවශ්‍ය Quality එක තෝරන්න* ⬇️`;
                const buttons = [];
                dls.forEach(dl => {
                    let url = dl.directUrl || dl.url;
                    if(url) {
                        let sizeMB = dl.size ? (parseInt(dl.size)/1024/1024).toFixed(1) + 'MB' : 'Unknown';
                        const dlId = storeData({ 
                            ...item, 
                            title: `${item.title} (S0${item.se}E${item.ep < 10 ? '0'+item.ep : item.ep})`, 
                            quality: dl.resolution, url: url, size: sizeMB 
                        });
                        buttons.push({ buttonId: `.sb --sbdl ${dlId}`, buttonText: { displayText: `🎥 ${dl.resolution} (${sizeMB})` }, type: 1 });
                    }
                });
                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: item.img ? 4 : 1 };
                if (item.img) msgOpts.image = { url: item.img };
                return await socket.sendMessage(sender, msgOpts, { quoted: msg });
            } catch (e) { return reply("❌ *Quality ලබා ගැනීමේ දෝෂයක්.*"); }
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD VIDEO [--sbdl]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--sbdl") {
            const dl = global.sbStore[subId];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");
            
            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) await reply(`🚀 *[StreamBox]* \`${dl.title}\` ඩවුන්ලෝඩ් කර \`${dl.targetJid}\` වෙත යවමින් පවතී...`);
                else await reply(`📥 *Downloading ${dl.title} (${dl.quality})...*\n_කරුණාකර රැඳී සිටින්න..._`);

                // 🌟 TARGET JID DETAILS CARD
                const isTv = dl.title.includes("S0"); // TV show identify
                const targetCardText = `*↳ ❝ [${isTv ? '📺 𝗡𝗘𝗪 𝗘𝗣𝗜𝗦𝗢𝗗𝗘' : '🎬 𝗡𝗘𝗪 𝗠𝗢𝗩𝗜𝗘'} 𝗔𝗥𝗥𝗜𝗩𝗔𝗟] ¡! ❞*\n\n` +
                    `🎬 *Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📦 *Size:* ${dl.size}\n\n` +
                    `🍿 *වීඩියෝව පහතින් ලබාගන්න.* \n\n> 👑 *SADEW-MINI* 👑`;

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                const fileName = `${dl.title.replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${dl.quality}.mp4`;
                const finalCap = `🎬 *Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📦 *Size:* ${dl.size}\n\n> 👑 *SADEW-MINI* 👑`;
                
                const streamRes = await axios({ method: 'GET', url: dl.url, responseType: 'stream', timeout: 300000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                
                await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName: fileName, caption: finalCap }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ලබාගත නොහැකි විය.");
            }
        }

        // ════════════════════════════════════════════════════════
        // 5. MAIN SEARCH [.sb]
        // ════════════════════════════════════════════════════════
        else {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie හෝ TV Series එකේ නම ලබා දෙන්න!*\n_උදා: .sb batman_");

            const { query, targetJid } = parseTarget(fullText);

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`${API_BASE}/search/${encodeURIComponent(query)}`, { timeout: 15000 });
                const items = res.data?.data?.items || [];

                if (!items.length) return reply("❌ *සමාවෙන්න, කිසිවක් හමුවූයේ නැත.*");

                const topResults = items.slice(0, 10);
                let listText = `*↳ ❝ [🍿 𝗦𝘁𝗿𝗲𝗮𝗺𝗕𝗼𝘅 𝗦𝗲𝗮𝗿𝗰𝗵 ] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    const icon = mv.subjectType === 2 ? '📺' : '🎬';
                    listText += `*${i + 1}.* ${icon} ${mv.title}\n   📅 ${mv.releaseDate || 'N/A'} | 🎭 ${mv.genre || 'N/A'}\n\n`;

                    const id = storeData({
                        subjectId: mv.subjectId, type: mv.subjectType, title: mv.title, 
                        img: mv.cover?.url, date: mv.releaseDate, targetJid: targetJid
                    });

                    buttons.push({
                        buttonId: `.sb --sbsel ${id}`,
                        buttonText: { displayText: `${icon} ${i + 1}. ${mv.title.slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් Movie එක හෝ TV Series එක තෝරන්න*`;

                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("SB Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.* සර්වර් එක Down වී තිබිය හැක.");
            }
        }
    }
};
