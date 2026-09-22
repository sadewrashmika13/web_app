const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE FOR TV 
// ════════════════════════════════════════════════════════
if (!global.tvOldStore) global.tvOldStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }
function storeData(data, ttlMs = 20 * 60 * 1000) { 
    const id = genId(); 
    global.tvOldStore[id] = data; 
    setTimeout(() => { delete global.tvOldStore[id]; }, ttlMs);
    return id; 
}

// 🎯 ULTRA SMART PARSER
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
    name: "cinesubz-tv-old",
    category: 10,
    description: "Search and download TV Series using Old API",
    
    // 🔥 මෙනු එකේ පේන්න 'tv' කමාන්ඩ් එක විතරක් තිබ්බා. අනිත්වා හැංගුවා.
    commands: ["tv"], 

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const OLD_API = "https://cinesubz-api-cnw.vercel.app/api";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_TV" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // 💎 PREMIUM USERS CHECK
        const premiumUsers = [
            "194601394663437", 
            "94769634033"      
        ];
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isPremium = premiumUsers.some(id => actualSender.includes(id));

        const subCmd = args[0];
        const subId = args[1];

        // ════════════════════════════════════════════════════════
        // 2. GET EPISODES (--ep) [Hidden Command]
        // ════════════════════════════════════════════════════════
        if (subCmd === "--ep") {
            const tv = global.tvOldStore[subId];
            if (!tv) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
            await reply(`📥 *${tv.title}* හි Episodes සකසමින්...`);

            try {
                const dlRes = await axios.get(`${OLD_API}/dl-links?url=${encodeURIComponent(tv.url)}`, { timeout: 25000 });
                const dlData = dlRes.data || {};

                if (dlData.allEpisodes && dlData.allEpisodes.length > 0) {
                    const eps = dlData.allEpisodes.slice(0, 50);
                    const buttons = [];
                    let capText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n`;
                    capText += `🎬 *Title:* ${tv.title}\n📺 *Total Episodes:* ${dlData.totalEpisodes || eps.length}\n`;
                    if (tv.targetJid) capText += `🎯 *Send Target:* \`${tv.targetJid}\`\n`;
                    capText += `\n> *ඔබට අවශ්ය Episode එක තෝරන්න* ⬇️`;

                    const dlAllId = storeData({ title: tv.title, episodes: eps, targetJid: tv.targetJid, img: tv.img, date: tv.date }, 60 * 60 * 1000); 
                    
                    // 💎 Premium Button
                    buttons.push({ buttonId: `.tv --dlall ${dlAllId}`, buttonText: { displayText: `💎 DOWNLOAD ALL (Premium)` }, type: 1 });

                    eps.forEach(ep => {
                        const epId = storeData({ 
                            title: `${tv.title} - ${ep.title || 'Ep ' + ep.episode}`, 
                            url: ep.url, 
                            targetJid: tv.targetJid 
                        });
                        buttons.push({ buttonId: `.tv --dl ${epId}`, buttonText: { displayText: `🎬 Ep ${ep.episode}: ${ep.title || ''}`.substring(0, 20) }, type: 1 });
                    });

                    const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: tv.img ? 4 : 1 };
                    if (tv.img) msgOpts.image = { url: tv.img };

                    await socket.sendMessage(sender, msgOpts, { quoted: msg });
                    await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                } else { reply("❌ *Episodes කිසිවක් හමු නොවිණි.*"); }
            } catch (e) { reply("❌ Error fetching episodes."); }
        }

        // ════════════════════════════════════════════════════════
        // 3. DIRECT DOWNLOAD EPISODE (--dl) [Hidden Command]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--dl") {
            const ep = global.tvOldStore[subId];
            if (!ep) return reply("❌ *Link expired. නැවත search කරන්න.*");
            const destJid = ep.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                if (ep.targetJid) await reply(`🚀 *[CineSend]* \`${ep.title}\` යවමින් පවතී...`);
                else await reply(`📥 *Downloading ${ep.title}...*`);

                const dlRes = await axios.get(`${OLD_API}/dl-links?url=${encodeURIComponent(ep.url)}`, { timeout: 25000 });
                const arr = dlRes.data?.downloadLinks || [];
                
                let vidUrl = null;
                let qualityStr = "720p"; 

                for (let item of arr) {
                    let u = item.direct_mp4_url || item.url || item.link;
                    if (u && typeof u === 'string' && u.startsWith('http')) {
                        // 🔥 අලුත් සර්වර් Fix එක!
                        vidUrl = u.replace('avatarzone.online', 'terracloud2.site'); 
                        qualityStr = item.quality || item.resolution || item.name || '720p';
                        break; 
                    }
                }

                if (!vidUrl) return reply("❌ *මෙම කොටස සඳහා Direct MP4 Link එකක් හමු නොවිණි.*");

                const fileName = `${(ep.title || 'Video').substring(0, 40).replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${qualityStr}.mp4`;
                const finalCap = `🎬 *Name:* ${ep.title}\n📽 *Quality:* ${qualityStr}\n\n> 👑 *SADEW-MINI* 👑`;
                
                // 🔥 Timeout එක 0 කර ඇත
                const streamRes = await axios({ method: 'GET', url: vidUrl, responseType: 'stream', timeout: 0, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cinesubz.net/' }, maxRedirects: 10 });
                
                await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName: fileName, caption: finalCap }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ලබාගත නොහැකි විය.");
            }
        }

        // ════════════════════════════════════════════════════════
        // 4. 💎 PREMIUM DOWNLOAD ALL (--dlall) [Hidden Command]
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--dlall") {
            if (!isPremium) return reply("❌ *සමාවෙන්න, 'Download All' පහසුකම Premium Users ලාට පමණි!* 💎");

            const show = global.tvOldStore[subId];
            if (!show || !show.episodes) return reply("❌ *Link expired. නැවත search කරන්න.*");
            const destJid = show.targetJid || sender;
            const eps = show.episodes;

            try {
                await socket.sendMessage(sender, { react: { text: "🚀", key: msg.key } });
                await reply(`🚀 *[PREMIUM Bulk]* \`${show.title}\` හි Episodes ${eps.length} ක් ඔටෝමැටික් ඩවුන්ලෝඩ් වීම ආරම්භ විය.\n_කරුණාකර රැඳී සිටින්න..._`);

                for (let i = 0; i < eps.length; i++) {
                    const ep = eps[i];
                    try {
                        const epApiUrl = `${OLD_API}/dl-links?url=${encodeURIComponent(ep.url)}`;
                        const dlRes = await axios.get(epApiUrl, { timeout: 25000 });
                        const arr = dlRes.data?.downloadLinks || [];
                        
                        let vidUrl = null;
                        let qualityStr = "720p"; 
                        for (let item of arr) {
                            let u = item.direct_mp4_url || item.url || item.link;
                            if (u && typeof u === 'string' && u.startsWith('http')) {
                                // 🔥 අලුත් සර්වර් Fix එක!
                                vidUrl = u.replace('avatarzone.online', 'terracloud2.site'); 
                                qualityStr = item.quality || '720p'; break; 
                            }
                        }

                        if (!vidUrl) continue;

                        const fileName = `${(show.title || 'TVShow').substring(0, 30)} - Ep ${ep.episode}.mp4`.replace(/[^a-zA-Z0-9 .\-]/g, '');
                        const cap = `🎬 *${show.title}*\n📺 *Episode:* ${ep.episode} - ${ep.title || ''}\n📽 *Quality:* ${qualityStr}\n\n> 👑 *SADEW-MINI* 👑`;
                        
                        // 🔥 Timeout එක 0 කර ඇත
                        const streamRes = await axios({ method: 'GET', url: vidUrl, responseType: 'stream', timeout: 300000, headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cinesubz.net/' }, maxRedirects: 10 });
                        await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName: fileName, caption: cap }, { quoted: metaQuote });
                        
                        if (i < eps.length - 1) await new Promise(r => setTimeout(r, 5000));
                    } catch (err) {
                        await socket.sendMessage(destJid, { text: `❌ *Ep ${ep.episode}* ඩවුන්ලෝඩ් කිරීම අසාර්ථක විය.` });
                    }
                }
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                await reply(`✅ *[PREMIUM Bulk]* \`${show.title}\` හි සියලුම Episodes යවා අවසන්!`);
            } catch (e) { reply("❌ *Bulk Download ක්රියාවලිය අතරමග නැවතුණි.*"); }
        }

        // ════════════════════════════════════════════════════════
        // 1. SEARCH TV SERIES (Main .tv command)
        // ════════════════════════════════════════════════════════
        else {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර TV Series එකේ නම දෙන්න!*\n_උදා: .tv arrow_");

            const { query, targetJid } = parseCineSend(fullText);

            await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });
            try {
                const searchRes = await axios.get(`${OLD_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (!searchRes.data.status || !searchRes.data.data.length) return reply("❌ *කිසිවක් හමුවූයේ නැත.*");

                const tvShows = searchRes.data.data.filter(x => x.isTV).slice(0, 10);
                if (!tvShows.length) return reply("❌ *TV Series කිසිවක් හමුවූයේ නැත.*");

                let listText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                tvShows.forEach((tv, i) => {
                    listText += `*${i + 1}.* 📺 ${tv.title}\n   📅 Year: ${tv.year} | ⭐ IMDb: ${tv.imdb}\n\n`;
                    const id = storeData({ url: tv.url, title: tv.title, img: tv.img, date: tv.year, targetJid: targetJid });
                    
                    // 🔥 Button ID එක .tv --ep විදිහට හැදුවා
                    buttons.push({ buttonId: `.tv --ep ${id}`, buttonText: { displayText: `📺 ${(tv.title).slice(0, 20)}` }, type: 1 });
                });

                listText += `> *📩 පහලින් TV Series එක තෝරන්න*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) { reply("❌ Error: " + e.message); }
        }
    }
};
