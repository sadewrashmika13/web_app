const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE — short IDs for button data (cinesubz2 සඳහා පමණක් වෙන් කර ඇත)
// ════════════════════════════════════════════════════════
if (!global.cz2Store) global.cz2Store = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 15 * 60 * 1000) {
    const id = genId();
    global.cz2Store[id] = data;
    setTimeout(() => { delete global.cz2Store[id]; }, ttlMs);
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
        if (matchIndex !== -1) {
            query = raw.substring(0, matchIndex).replace(/,$/, '').trim();
        }

        if (extracted.includes('@g.us') || extracted.includes('@s.whatsapp.net')) {
            targetJid = extracted;
        } else {
            let num = extracted.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 10) {
                num = '94' + num.slice(1);
            }
            if (num.length >= 10) {
                targetJid = num + '@s.whatsapp.net';
            }
        }
    }

    if (!targetJid && raw.includes(',')) {
        let parts = raw.split(',');
        let lastPart = parts.pop().trim();
        let num = lastPart.replace(/[^0-9]/g, '');
        
        if (num.length >= 10 && num.length <= 15) {
            targetJid = num + '@s.whatsapp.net';
            query = parts.join(',').trim();
        } else if (num.length > 15) {
            targetJid = num + '@g.us';
            query = parts.join(',').trim();
        }
    }

    return { query, targetJid };
}

module.exports = {
    name: "cinesubz2-downloader",
    category: 0,
    description: "Search and download Sinhala Subbed movies/tv shows from Cinesubz (Old API Backup)",
    
    // අනිත් කෝඩ් එක එක්ක හැප්පෙන්නේ නැති වෙන්න cinesubz2 පමණක් යොදා ඇත
    commands: ["cinesubz2"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const NEW_API = "https://cinesubz-api-cnw.vercel.app/api";
        
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
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
        // 1. MOVIE / TV SHOW SELECT (--cz2sel) 
        // ════════════════════════════════════════════════════════
        if (subCmd === "--cz2sel") {
            const id = subId;
            const movie = global.cz2Store[id];
            if (!movie) return reply("❌ *Link expired. නැවත search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා දත්ත ලබා ගනිමින්...`);

                const dlApiUrl = `${NEW_API}/dl-links?url=${encodeURIComponent(movie.url)}`;
                const dlRes = await axios.get(dlApiUrl, { timeout: 25000 });
                const dlData = dlRes.data || {};

                // 📺 [ TV SHOW MODE ] 
                if (dlData.allEpisodes && dlData.allEpisodes.length > 0) {
                    const buttons = [];
                    let capText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 - TV Series (V2)] ¡! ❞*\n\n`;
                    capText += `🎬 *Title:* ${movie.title}\n`;
                    capText += `📺 *Total Episodes:* ${dlData.totalEpisodes || dlData.allEpisodes.length}\n`;
                    if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                    capText += `\n> *ඔබට අවශ්ය Episode එක තෝරන්න හෝ සියල්ලම එකවර ඩවුන්ලෝඩ් කරන්න* ⬇️`;

                    const eps = dlData.allEpisodes.slice(0, 50);

                    const dlAllId = storeData({
                        title: movie.title, episodes: eps, targetJid: movie.targetJid,
                        img: movie.img, date: movie.date
                    }, 60 * 60 * 1000); 

                    buttons.push({
                        buttonId: `.cinesubz2 --cz2dlall ${dlAllId}`,
                        buttonText: { displayText: `💎 DOWNLOAD ALL (Premium)` },
                        type: 1
                    });

                    eps.forEach(ep => {
                        const epId = storeData({
                            title: `${movie.title} - ${ep.title || 'Ep ' + ep.episode}`, url: ep.url,
                            targetJid: movie.targetJid, img: movie.img, date: movie.date
                        });
                        buttons.push({
                            buttonId: `.cinesubz2 --cz2sel ${epId}`,
                            buttonText: { displayText: `🎬 Ep ${ep.episode}: ${ep.title || ''}`.substring(0, 20) },
                            type: 1
                        });
                    });

                    const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                    if (movie.img) msgOpts.image = { url: movie.img };

                    await socket.sendMessage(sender, msgOpts, { quoted: msg });
                    await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                    delete global.cz2Store[id];
                    return; 
                }

                // 🎬 [ MOVIE / SINGLE EP MODE ] 
                let downloads = [];
                const arr = dlData.downloadLinks || dlData.result || dlData.data || [];

                arr.forEach(item => {
                    let resolvedUrl = item.direct_mp4_url || item.url || item.link;
                    if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http')) {
                        
                        // 🔥 අලුත් සර්වර් අප්ඩේට් එකට ගැලපෙන විදිහට පරණ URL එක මාරු කිරීම 🔥
                        resolvedUrl = resolvedUrl.replace('avatarzone.online', 'terracloud2.site');
                        
                        let q = item.quality || item.resolution || item.name || '';
                        if (!q) {
                            if (resolvedUrl.includes('480p')) q = '480p';
                            else if (resolvedUrl.includes('720p')) q = '720p';
                            else if (resolvedUrl.includes('1080p')) q = '1080p';
                            else q = 'HD';
                        }
                        downloads.push({
                            meta: q, size: item.fileSize || item.size || 'Unknown', resolvedUrl: resolvedUrl
                        });
                    }
                });

                if (!downloads.length) {
                    delete global.cz2Store[id];
                    return reply("❌ *මෙම වීඩියෝව සඳහා Download Links හමු නොවිණි.*");
                }

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 (V2)] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const dlId = storeData({
                        title: movie.title, quality: dl.meta, size: dl.size, url: dl.resolvedUrl,
                        targetJid: movie.targetJid, img: movie.img, date: movie.date
                    });
                    buttons.push({
                        buttonId: `.cinesubz2 --cz2dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${dl.meta} ${dl.size && dl.size !== 'Unknown' ? `(${dl.size})` : ''}`.trim() },
                        type: 1
                    });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });
                delete global.cz2Store[id];

            } catch (e) {
                console.error("[CZ2] Select Error:", e.message);
                reply("❌ *දත්ත ලබා ගැනීමේ දෝෂයක්.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. DOWNLOAD SINGLE ITEM (--cz2dl)
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--cz2dl") {
            const id = subId;
            const dl = global.cz2Store[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) {
                    await reply(`🚀 *[CineSend]* \`${dl.title}\` (${dl.quality}) ඩවුන්ලෝඩ් කර \`${dl.targetJid}\` වෙත යවමින් පවතී...`);
                } else {
                    await reply(`📥 *Downloading ${dl.title} (${dl.quality})...*\n_Direct Link සම්බන්ධ වෙමින් පවතී... (මෙයට සුළු වේලාවක් ගත විය හැක)_`);
                }

                const captionBase = `🎬 *Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📦 *Size:* ${dl.size || 'Unknown'}\n📅 *Year:* ${dl.date || 'N/A'}`;
                
                const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗩𝗜𝗗𝗘𝗢 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📅 *Year:* ${dl.date || 'N/A'}\n\n` +
                    `🍿 *වීඩියෝව පහතින් ලබාගන්න.* \n\n> 👑 *SADEW-MINI* 👑`;

                const fileName = `${(dl.title || 'Video').substring(0, 40).replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${dl.quality}.mp4`;

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                // 🔥 Timeout එක 0 කළා (ලොකු Movies මගින් කැඩෙන එක නවත්වන්න)
                const streamRes = await axios({
                    method: 'GET', url: dl.url, responseType: 'stream', timeout: 0,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cinesubz.net/' }, maxRedirects: 10
                });

                let actualSize = dl.size && dl.size !== 'Unknown' ? dl.size : 'Unknown';
                const cl = parseInt(streamRes.headers['content-length'] || '0');
                if (cl && actualSize === 'Unknown') actualSize = (cl / 1024 / 1024).toFixed(1) + ' MB';

                const finalCap = `${captionBase.replace('Unknown', actualSize)}\n\n> 👑 *SADEW-MINI* 👑`;

                await socket.sendMessage(destJid, {
                    document: { stream: streamRes.data },
                    mimetype: "video/mp4", fileName: fileName, caption: finalCap
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch (err) {}
                setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

            } catch (e2) {
                console.error("[CZ2] Stream failed:", e2.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ලබාගත නොහැකි විය.");
            }
            delete global.cz2Store[id];
        }

        // ════════════════════════════════════════════════════════
        // 3. 💎 PREMIUM DOWNLOAD ALL EPISODES (--cz2dlall) 
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--cz2dlall") {
            
            // 🚫 PREMIUM CHECK
            if (!isPremium) {
                return reply("❌ *සමාවෙන්න, 'Download All' පහසුකම Premium Users ලාට පමණි!* 💎");
            }

            const id = subId;
            const show = global.cz2Store[id];
            if (!show || !show.episodes) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = show.targetJid || sender;
            const eps = show.episodes;

            try {
                await socket.sendMessage(sender, { react: { text: "🚀", key: msg.key } });
                await reply(`🚀 *[PREMIUM Bulk]* \`${show.title}\` හි Episodes ${eps.length} ක් ඔටෝමැටික් ඩවුන්ලෝඩ් වීම ආරම්භ විය.\n_කරුණාකර රැඳී සිටින්න... (මෙයට වැඩි වේලාවක් ගත විය හැක)_`);

                const targetCardText = `*↳ ❝ [📺 𝗡𝗘𝗪 𝗧𝗩 𝗦𝗘𝗥𝗜𝗘𝗦 𝗔𝗥𝗥𝗜𝗩𝗔𝗟] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${show.title}\n` +
                    `📺 *Total Episodes:* ${eps.length}\n` +
                    `📅 *Year:* ${show.date || 'N/A'}\n\n` +
                    `🍿 *මෙම TV Series එකෙහි සියලුම කොටස් පහතින් ඩවුන්ලෝඩ් වෙමින් පවතී.* \n\n` +
                    `> 👑 *SADEW-MINI* 👑`;

                if (show.targetJid) {
                    try {
                        if (show.img) await socket.sendMessage(destJid, { image: { url: show.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                for (let i = 0; i < eps.length; i++) {
                    const ep = eps[i];
                    try {
                        const epApiUrl = `${NEW_API}/dl-links?url=${encodeURIComponent(ep.url)}`;
                        const dlRes = await axios.get(epApiUrl, { timeout: 25000 });
                        const arr = dlRes.data?.downloadLinks || dlRes.data?.result || dlRes.data?.data || [];
                        
                        let vidUrl = null;
                        let qualityStr = "480p"; 
                        for (let item of arr) {
                            let u = item.direct_mp4_url || item.url || item.link;
                            if (u && typeof u === 'string' && u.startsWith('http')) {
                                // 🔥 TV Series වලත් URL එක ඔටෝම මාරු කරනවා
                                vidUrl = u.replace('avatarzone.online', 'terracloud2.site');
                                qualityStr = item.quality || '480p';
                                break; 
                            }
                        }

                        if (!vidUrl) {
                            await socket.sendMessage(destJid, { text: `❌ *Ep ${ep.episode}* සඳහා Direct MP4 Link එකක් API එකෙන් හමු නොවීය.` });
                            continue; 
                        }

                        const fileName = `${(show.title || 'TVShow').substring(0, 30)} - Ep ${ep.episode}.mp4`.replace(/[^a-zA-Z0-9 .\-]/g, '');
                        const cap = `🎬 *${show.title}*\n📺 *Episode:* ${ep.episode} - ${ep.title || ''}\n📽 *Quality:* ${qualityStr}\n\n> 👑 *SADEW-MINI* 👑`;
                        
                        // 🔥 Timeout එක 0 කළා
                        const streamRes = await axios({
                            method: 'GET', url: vidUrl, responseType: 'stream', timeout: 0,
                            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cinesubz.net/' }, maxRedirects: 10
                        });

                        await socket.sendMessage(destJid, {
                            document: { stream: streamRes.data },
                            mimetype: "video/mp4", fileName: fileName, caption: cap
                        }, { quoted: metaQuote });

                        try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch(e){}

                        if (i < eps.length - 1) {
                            await new Promise(r => setTimeout(r, 5000));
                        }
                        try { if (global.gc) global.gc(); } catch (e) {}

                    } catch (err) {
                        console.error(`[CZ2 Bulk] Ep ${ep.episode} Failed:`, err.message);
                        await socket.sendMessage(destJid, { text: `❌ *Ep ${ep.episode}* ඩවුන්ලෝඩ් කිරීම අසාර්ථක විය.` });
                    }
                }

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                await reply(`✅ *[PREMIUM Bulk]* \`${show.title}\` හි සියලුම Episodes යවා අවසන්!`);
                delete global.cz2Store[id];

            } catch (e) {
                console.error("[CZ2 Bulk Error]:", e.message);
                reply("❌ *Bulk Download ක්රියාවලිය අතරමග නැවතුණි.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 4. NORMAL SEARCH (Main Command - cinesubz2)
        // ════════════════════════════════════════════════════════
        else {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie/TV Series එකේ නම ලබා දෙන්න!*\n_උදා: .cinesubz2 batman_");

            const parsed = parseCineSend(fullText);
            const query = parsed.query;
            const targetJid = parsed.targetJid;

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`${NEW_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                const data = res.data;
                const results = data.result || data.data || [];

                if (!results || !results.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් හමුවූයේ නැත.*");
                }

                const topResults = results.slice(0, 10);
                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 (V2) 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    const title = mv.title || mv.name || 'Movie';
                    const url = mv.url || mv.link;
                    const date = mv.date || mv.year || 'N/A';
                    
                    listText += `*${i + 1}.* ${title}\n   📅 ${date} | 🔗 ${url.split('/')[4] || 'Link'}\n\n`;

                    const id = storeData({
                        url: url, title: title, img: mv.img || mv.image,
                        date: date, genres: mv.genres, imdb: mv.imdb,
                        runtime: mv.runtime, id: mv.id || mv.post_id, targetJid: targetJid
                    });

                    buttons.push({
                        buttonId: `.cinesubz2 --cz2sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${title.slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් එකක් තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                await socket.sendMessage(sender, {
                    text: listText, footer: botName, buttons: buttons, headerType: 1
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[CZ2] Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.* API එක down වී තිබිය හැක.");
            }
        }
    }
};
