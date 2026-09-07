const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE — short IDs for button data (URL truncation fix)
// ════════════════════════════════════════════════════════
if (!global.czStore) global.czStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 15 * 60 * 1000) {
    const id = genId();
    global.czStore[id] = data;
    setTimeout(() => { delete global.czStore[id]; }, ttlMs);
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
    name: "cinesubz-downloader",
    category: 0,
    description: "Search and download Sinhala Subbed movies from Cinesubz (Inbox/Groups)",
    commands: ["cz", "cinesubz", "cinesend", "cs_sel", "cs_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        
        // 🔥 අලුත්ම WhiteShadow Cinesubz API එක
        const NEW_API = "https://cinesubz-api-cnw.vercel.app/api";
        
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH (.cz / .cinesubz / .cinesend)
        // ════════════════════════════════════════════════════════
        if (command === "cz" || command === "cinesubz" || command === "cinesend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*\n_උදා: .cz batman_");

            const parsed = parseCineSend(fullText);
            const query = parsed.query;
            const targetJid = parsed.targetJid;

            if (command === "cinesend" && !targetJid) {
                return reply("❌ *කරුණාකර කොමාවකින් (,) වෙන් කර නිවැරදි Group JID එකක් හෝ Phone Number එකක් ලබාදෙන්න!*\n_උදා: .cinesend Harry Potter , 0771234567_");
            }
            if (!query) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`${NEW_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                const data = res.data;

                // API Result Array එක හඳුනාගැනීම
                const results = data.result || data.data || [];

                if (!results || !results.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Movies කිසිවක් හමුවූයේ නැත.*");
                }

                const topResults = results.slice(0, 10);

                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n`;
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
                        buttonId: `.cs_sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${title.slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් Movie එක තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                await socket.sendMessage(sender, {
                    text: listText,
                    footer: botName,
                    buttons: buttons,
                    headerType: 1
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[CZ] Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.* API එක down වී තිබිය හැක.");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. MOVIE SELECT (.cs_sel) — Get Details & direct_mp4_url
        // ════════════════════════════════════════════════════════
        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත .cinesend search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා Download Links සකසමින්...`);

                let downloads = [];

                try {
                    const dlApiUrl = `${NEW_API}/dl-links?url=${encodeURIComponent(movie.url)}`;
                    const dlRes = await axios.get(dlApiUrl, { timeout: 25000 });
                    
                    const dlData = dlRes.data || {};
                    // අලුත් API එකේ Array එක එන්නේ downloadLinks කියන නමින්!
                    const arr = dlData.downloadLinks || dlData.result || dlData.data || [];

                    arr.forEach(item => {
                        const resolvedUrl = item.direct_mp4_url || item.url || item.link;
                        
                        // iframe වගේ ඒවා මඟහැර නියම http mp4 links විතරක් ගන්නවා
                        if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http')) {
                            downloads.push({
                                meta: item.quality || item.resolution || item.name || 'HD',
                                size: item.fileSize || item.size || 'Unknown',
                                resolvedUrl: resolvedUrl
                            });
                        }
                    });

                } catch (dlErr) {
                    console.log("[CZ] dl-links Error:", dlErr.message);
                }

                if (!downloads.length) {
                    delete global.czStore[id];
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links හමු නොවිණි.* API එකෙන් direct links ලබාදුන්නේ නැත.");
                }

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n🎭 *Genres:* ${movie.genres || 'N/A'}\n⭐ *IMDB:* ${movie.imdb || 'N/A'}\n⏱ *Runtime:* ${movie.runtime || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const dlId = storeData({
                        title: movie.title,
                        quality: dl.meta,
                        size: dl.size,
                        url: dl.resolvedUrl,
                        targetJid: movie.targetJid,
                        img: movie.img, date: movie.date, genres: movie.genres, imdb: movie.imdb, runtime: movie.runtime
                    });

                    buttons.push({
                        buttonId: `.cs_dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${dl.meta} ${dl.size && dl.size !== 'Unknown' ? `(${dl.size})` : ''}`.trim() },
                        type: 1
                    });
                });

                const msgOpts = {
                    caption: capText,
                    footer: botName,
                    buttons: buttons,
                    headerType: movie.img ? 4 : 1
                };
                if (movie.img) msgOpts.image = { url: movie.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });
                delete global.czStore[id];

            } catch (e) {
                console.error("[CZ] Select Error:", e.message);
                reply("❌ *Movie details error.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. DOWNLOAD (.cs_dl) — Direct Pipe
        // ════════════════════════════════════════════════════════
        else if (command === "cs_dl") {
            const id = args[0];
            const dl = global.czStore[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) {
                    await reply(`🚀 *[CineSend]* \`${dl.title}\` (${dl.quality}) ඩවුන්ලෝඩ් කර \`${dl.targetJid}\` වෙත යවමින් පවතී...`);
                } else {
                    await reply(`📥 *Downloading ${dl.title} (${dl.quality})...*\n_Direct Link සම්බන්ධ වෙමින් පවතී..._`);
                }

                const captionBase = `🎬 *Movie Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📦 *Size:* ${dl.size || 'Unknown'}\n📅 *Release Year:* ${dl.date || 'N/A'}`;
                
                const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗠𝗢𝗩𝗜𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${dl.title}\n` +
                    `📽 *Quality:* ${dl.quality}\n` +
                    `📅 *Year:* ${dl.date || 'N/A'}\n` +
                    `🎭 *Genres:* ${dl.genres || 'N/A'}\n` +
                    `⭐ *IMDb:* ${dl.imdb || 'N/A'}\n\n` +
                    `🍿 *චිත්‍රපටය පහතින් ලබාගන්න.* \n\n` +
                    `> 👑 *SADEW-MINI* 👑`;

                const fileName = `${(dl.title || 'Movie').substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${dl.quality}.mp4`;

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                const vidUrl = dl.url;

                try {
                    const streamRes = await axios({
                        method: 'GET', 
                        url: vidUrl,
                        responseType: 'stream', 
                        timeout: 300000,
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                            'Referer': 'https://cinesubz.net/' 
                        },
                        maxRedirects: 10
                    });

                    let actualSize = dl.size && dl.size !== 'Unknown' ? dl.size : 'Unknown';
                    const cl = parseInt(streamRes.headers['content-length'] || '0');
                    if (cl && actualSize === 'Unknown') {
                        actualSize = (cl / 1024 / 1024).toFixed(1) + ' MB';
                    }

                    const finalCap = `${captionBase.replace('Unknown', actualSize)}\n\n> 👑 *SADEW-MINI* 👑`;

                    await socket.sendMessage(destJid, {
                        document: { stream: streamRes.data },
                        mimetype: "video/mp4", 
                        fileName: fileName, 
                        caption: finalCap
                    }, { quoted: metaQuote });

                    await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                    try {
                        if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy();
                    } catch (err) {}

                    setTimeout(() => {
                        try { if (global.gc) global.gc(); } catch (e) {}
                    }, 5000);

                } catch (e2) {
                    console.log("[CZ] Stream failed:", e2.message);
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ලබාගත නොහැකි විය.");
                }

                delete global.czStore[id];

            } catch (e) {
                console.error("[CZ] DL Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Download Error.*");
            }
        }
    }
};
