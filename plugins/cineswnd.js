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

// 🎯 ULTRA SMART PARSER — කොමාවක් තිබ්බත් නැතත් අනිවාර්යයෙන්ම JID එක වෙන් කරගන්නා ක්‍රමය!
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
    // සියලුම Commands මෙතනට ඇතුලත් කර ඇත
    commands: ["cz", "cinesubz", "cinesend", "cs_sel", "cs_dl"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const CZ_API = "https://cz-dnuz.vercel.app";
        const OLD_API = "https://cinesubz-api-cnw.vercel.app/api";
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
            if (!query) {
                return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*");
            }

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                console.log(`[CZ SEARCH] Pure Movie Query: "${query}" | TargetJID: "${targetJid || 'None'}"`);

                const res = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                const data = res.data;

                if (!data.success || !data.result?.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Movies කිසිවක් හමුවූයේ නැත.*");
                }

                const topResults = data.result.slice(0, 10);

                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.date || 'N/A'} | ⏱ ${mv.runtime || 'N/A'}\n\n`;

                    const id = storeData({
                        url: mv.url, title: mv.title, img: mv.img,
                        date: mv.date, genres: mv.genres, imdb: mv.imdb,
                        runtime: mv.runtime, id: mv.id, targetJid: targetJid
                    });

                    buttons.push({
                        buttonId: `.cs_sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${(mv.title || '').slice(0, 20)}` },
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
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. MOVIE SELECT (.cs_sel) — details + quality buttons
        // ════════════════════════════════════════════════════════
        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත .cinesend search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා Download Links සකසමින්...`);

                let downloads = [];

                // TRY 1: New API (/movidl)
                try {
                    const movidlUrl = `${CZ_API}/movidl?url=${encodeURIComponent(movie.url)}`;
                    const dlRes = await axios.get(movidlUrl, { timeout: 20000 });
                    downloads = dlRes.data.result?.downloads || [];
                    console.log("[CZ] movidl downloads:", downloads.length);
                } catch (dlErr) {
                    console.log("[CZ] movidl Error:", dlErr.message);

                    // TRY 2: Old API Fallback
                    if (dlErr.response && (dlErr.response.status >= 500 || dlErr.response.status === 404)) {
                        try {
                            const oldRes = await axios.get(`${OLD_API}/extract?id=${movie.id}&type=mv`, { timeout: 15000 });
                            if (oldRes.data?.data) {
                                const directVideo = oldRes.data.data.find(v => v.is_direct_mp4) || oldRes.data.data[0];
                                if (directVideo?.link?.includes('player')) {
                                    downloads = [
                                        { meta: "480p", resolvedUrl: directVideo.link, isPlayer: true },
                                        { meta: "720p", resolvedUrl: directVideo.link, isPlayer: true }
                                    ];
                                    console.log("[CZ] Old API fallback success");
                                }
                            }
                        } catch (oldErr) {
                            console.log("[CZ] Old API also failed:", oldErr.message);
                        }
                    }
                }

                if (!downloads.length) {
                    delete global.czStore[id];
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links හමු නොවිණි.*");
                }

                // Quality buttons — short IDs (no URL truncation)
                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n🎭 *Genres:* ${movie.genres || 'N/A'}\n⭐ *IMDB:* ${movie.imdb || 'N/A'}\n⏱ *Runtime:* ${movie.runtime || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const resolvedUrl = dl.resolvedUrl || '';
                    const label = dl.meta || 'HD';
                    if (!resolvedUrl) return;

                    const dlId = storeData({
                        title: movie.title,
                        quality: label,
                        url: resolvedUrl,
                        isPlayer: !!dl.isPlayer,
                        targetJid: movie.targetJid,
                        img: movie.img, date: movie.date, genres: movie.genres, imdb: movie.imdb, runtime: movie.runtime
                    });

                    buttons.push({
                        buttonId: `.cs_dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${label}` },
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
        // 3. DOWNLOAD (.cs_dl) — EXACT OLD CODE LOGIC + TARGET JID
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
                    await reply(`📥 *Downloading ${dl.title} (${dl.quality})...*\n_Link සකසමින්..._`);
                }

                const captionBase = `🎬 *Movie Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📅 *Release Year:* ${dl.date || 'N/A'}`;
                
                const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗠𝗢𝗩𝗜𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${dl.title}\n` +
                    `📽 *Quality:* ${dl.quality}\n` +
                    `📅 *Year:* ${dl.date || 'N/A'}\n` +
                    `🎭 *Genres:* ${dl.genres || 'N/A'}\n` +
                    `⭐ *IMDb:* ${dl.imdb || 'N/A'}\n` +
                    `⏱ *Runtime:* ${dl.runtime || 'N/A'}\n\n` +
                    `🍿 *චිත්‍රපටය පහතින් ලබාගන්න.* \n\n` +
                    `> 👑 *SADEW-MINI* 👑`;

                const fileName = `${(dl.title || 'Movie').substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${dl.quality}.mp4`;
                let downloadSuccess = false;

                const sendDetailsCardToTarget = async () => {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {
                        console.log("[CZ] Card send error:", cardErr.message);
                    }
                };

                // ═══════ OLD API (Player page — extract from HTML) ═══════
                if (dl.isPlayer) {
                    try {
                        console.log("[CZ] Old API player extract:", dl.url);
                        const htmlRes = await axios.get(dl.url, { timeout: 15000 });
                        const match = htmlRes.data.match(/const ALL_QUALITIES = (\[.*?\]);/);

                        if (match) {
                            const qualities = JSON.parse(match[1]);
                            const reqQ = dl.quality.toLowerCase().includes('480') ? '480p' : '720p';
                            const matched = qualities.find(q =>
                                q.html?.toLowerCase().includes(reqQ) || q.url?.toLowerCase().includes(reqQ)
                            );

                            if (matched?.url) {
                                console.log(`[CZ] Old API ${reqQ} URL:`, matched.url);
                                if (dl.targetJid) await sendDetailsCardToTarget();
                                
                                const finalCap = `${captionBase}\n\n> 👑 *SADEW-MINI* 👑`;
                                await socket.sendMessage(destJid, {
                                    document: { url: matched.url },
                                    mimetype: "video/mp4",
                                    fileName, caption: finalCap
                                }, { quoted: metaQuote });
                                downloadSuccess = true;
                            }
                        }
                    } catch (e) {
                        console.log("[CZ] Old API extraction failed:", e.message);
                    }
                }

                // ═══════ NEW API (/download) — EXACT OLD LOGIC ═══════
                if (!downloadSuccess && !dl.isPlayer) {
                    let resolvedUrl = dl.url.trim();

                    // OLD CODE URL FIXES — critical for API to work!
                    resolvedUrl = resolvedUrl.replace(/\/(server\d+)\/\d+:\//g, '/$1/');
                    if (resolvedUrl.endsWith('.mp4') && !resolvedUrl.includes('?ext=')) {
                        resolvedUrl = resolvedUrl.replace(/\.mp4$/, '?ext=mp4');
                    }

                    let fallbackUrl = resolvedUrl.replace(/\/server\d+\//, '/server1/');

                    const tryDownloadApi = async (urlToTry) => {
                        try {
                            // ⚠️ NO encodeURIComponent — API expects RAW URL!
                            const dlApiUrl = `${CZ_API}/download?url=${urlToTry}`;
                            console.log("[CZ] Trying /download:", dlApiUrl);

                            const dlRes = await axios.get(dlApiUrl, { timeout: 20000 });
                            const dlData = dlRes.data;

                            if (dlData.success && dlData.result?.downloadUrls) {
                                // Log ALL URLs for debug
                                console.log("[CZ] All download URLs:", JSON.stringify(dlData.result.downloadUrls.map(u => u.url)));

                                const isTelegram = (url) => {
                                    const l = url.toLowerCase();
                                    return l.includes('t.me/') || l.includes('telegram.me/') ||
                                           l.includes('telegram.dog/') || l.includes('telegram.org/');
                                };

                                // Find REAL video URL (not telegram)
                                const httpUrl = dlData.result.downloadUrls.find(u =>
                                    u.url && u.url.startsWith('http') && !isTelegram(u.url)
                                );

                                if (!httpUrl?.url) {
                                    console.log("[CZ] ❌ Only Telegram links found — no direct download");
                                    return false;
                                }

                                const vidUrl = httpUrl.url;
                                console.log("[CZ] Direct URL:", vidUrl);

                                if (dl.targetJid) await sendDetailsCardToTarget();

                                    // FULL STREAM DOWNLOAD (Direct stream pipe)
                                    try {
                                        const streamRes = await axios({
                                            method: 'GET', url: vidUrl,
                                            responseType: 'stream', timeout: 300000,
                                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                                            maxRedirects: 10
                                        });
                                        const ct = streamRes.headers['content-type'] || '';
                                        if (ct.includes('text/html')) { streamRes.data.destroy(); return false; }

                                        const cl = parseInt(streamRes.headers['content-length'] || '0');
                                        const size = cl ? (cl / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown';
                                        
                                        const finalCap = `${captionBase}\n📦 *Size:* ${size}\n\n> 👑 *SADEW-MINI* 👑`;

                                        console.log(`[CZ] Streaming ${size}...`);
                                        await socket.sendMessage(destJid, {
                                            document: { stream: streamRes.data },
                                            mimetype: "video/mp4", fileName, caption: finalCap
                                        }, { quoted: metaQuote });
                                        console.log("[CZ] Stream SUCCESS ✅");

                                        // 🧹 RAM Cleanup (Memory Management for 512MB Heroku)
                                        try {
                                            if (streamRes.data && typeof streamRes.data.destroy === 'function') {
                                                streamRes.data.destroy(); // Destroy axios stream stream completely
                                            }
                                        } catch (err) {}

                                        // Force Garbage Collection if enabled
                                        setTimeout(() => {
                                            try { if (global.gc) global.gc(); } catch (e) {}
                                            console.log("🧹 [CZ] Post-Download RAM Cleanup Executed");
                                        }, 5000);

                                        return true;
                                    } catch (e2) {
                                        console.log("[CZ] Stream failed:", e2.message);
                                    }
                            }
                            return false;
                        } catch (e) {
                            console.log("[CZ] /download error:", e.message);
                            return false;
                        }
                    };

                    // Try original server, then fallback to server1
                    downloadSuccess = await tryDownloadApi(resolvedUrl);
                    if (!downloadSuccess && fallbackUrl !== resolvedUrl) {
                        console.log("[CZ] Trying server1 fallback...");
                        downloadSuccess = await tryDownloadApi(fallbackUrl);
                    }
                }

                if (downloadSuccess) {
                    await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                } else {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    await reply("❌ *Download Failed! සර්වර් එකේ ලින්ක් එක Expire වී ඇත.*");
                }

                delete global.czStore[id];

            } catch (e) {
                console.error("[CZ] DL Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Download Failed!*");
            }
        }
    }
};