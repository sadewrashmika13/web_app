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
        const CZ_API = "https://cz-dnuz.vercel.app";
        
        // 🔥 META AI FAKE QUOTE 🔥
        const metaAiName = "Meta AI";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: metaAiName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${metaAiName}\nORG:WhatsApp\nTEL;waid=16505361212:+1 (650) 536-1212\nEND:VCARD` } }
        };

        if (command === "cz" || command === "cinesubz" || command === "cinesend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*\n_උදා: .cz batman_");
            const parsed = parseCineSend(fullText);
            const query = parsed.query;
            const targetJid = parsed.targetJid;

            if (command === "cinesend" && !targetJid) return reply("❌ *කරුණාකර කොමාවකින් (,) වෙන් කර නිවැරදි Group JID එකක් හෝ Phone Number එකක් ලබාදෙන්න!*\n_උදා: .cinesend Harry Potter , 0771234567_");
            if (!query) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });
                const res = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`, { timeout: 20000 });
                const data = res.data;

                if (!data.success || !data.result || data.result.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Movies කිසිවක් හමුවූයේ නැත.*");
                }

                // තවමත් Result 10ක් එන්නමයි හදලා තියෙන්නේ! (Cinesubz වල ඊට අඩුවෙන් තිබ්බොත් තියෙන ගාන එයි)
                const topResults = data.result.slice(0, 10);
                
                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${topResults.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`; else listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.date || 'N/A'} | ⏱ ${mv.runtime || 'N/A'}\n\n`;
                    const id = storeData({ url: mv.url, title: mv.title, img: mv.img, date: mv.date, genres: mv.genres, imdb: mv.imdb, runtime: mv.runtime, id: mv.id, targetJid: targetJid });
                    buttons.push({ buttonId: `.cs_sel ${id}`, buttonText: { displayText: `🎬 ${i + 1}. ${(mv.title || '').slice(0, 20)}` }, type: 1 });
                });

                listText += `> *📩 පහලින් Movie එක තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                // 🔥 RANDOM SEARCH BACKGROUND PHOTOS 🔥
                const searchBgs = [
                    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790344904/ChatGPT_Image_Sep_25_2026_07_28_02_PM_tk3oxd.png",
                    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790345148/ChatGPT_Image_Sep_25_2026_07_32_04_PM_grtzqp.png",
                    "https://res.cloudinary.com/p6lu5bpe/image/upload/v1790345308/ChatGPT_Image_Sep_25_2026_07_36_29_PM_t4htf2.png"
                ];
                const randomBg = searchBgs[Math.floor(Math.random() * searchBgs.length)];

                await socket.sendMessage(sender, { 
                    image: { url: randomBg },
                    caption: listText, 
                    footer: botName, 
                    buttons: buttons, 
                    headerType: 4 // Image header
                }, { quoted: metaQuote });
                
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            } catch (e) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත .cinesend search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා Download Links සකසමින්...`);

                let downloads = [];
                try {
                    const movidlUrl = `${CZ_API}/movidl?url=${encodeURIComponent(movie.url)}`;
                    const dlRes = await axios.get(movidlUrl, { timeout: 25000 });
                    downloads = dlRes.data.result?.downloads || [];
                } catch (dlErr) { console.log("[CZ] /movidl Error:", dlErr.message); }

                if (!downloads || downloads.length === 0) {
                    delete global.czStore[id];
                    return reply("❌ *මෙම චිත්‍රපටය සඳහා Download Links හමු නොවිණි.*");
                }

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n🎭 *Genres:* ${movie.genres || 'N/A'}\n⭐ *IMDB:* ${movie.imdb || 'N/A'}\n⏱ *Runtime:* ${movie.runtime || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const resolvedUrl = dl.resolvedUrl || dl.url || '';
                    if (!resolvedUrl) return;

                    let label = dl.meta || dl.quality || 'HD';
                    label = label.replace('WEBRip', '').replace('English', '').replace('•', '-').trim();
                    if (label.length > 17) label = label.substring(0, 17).trim(); 

                    const dlId = storeData({ title: movie.title, quality: label, url: resolvedUrl, targetJid: movie.targetJid, img: movie.img, date: movie.date, genres: movie.genres, imdb: movie.imdb, runtime: movie.runtime });
                    buttons.push({ buttonId: `.cs_dl ${dlId}`, buttonText: { displayText: `🎥 ${label}` }, type: 1 });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };
                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });
                delete global.czStore[id];

            } catch (e) {
                reply("❌ *Movie details ලබා ගැනීමේදී දෝෂයක්.*");
            }
        }

        else if (command === "cs_dl") {
            const id = args[0];
            const dl = global.czStore[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                if (dl.targetJid) await reply(`🚀 *[CineSend]* \`${dl.title}\` (${dl.quality}) ඩවුන්ලෝඩ් කර \`${dl.targetJid}\` වෙත යවමින් පවතී...`);
                else await reply(`📥 *Downloading ${dl.title} (${dl.quality})...*\n_Link සකසමින්..._`);

                const captionBase = `🎬 *Movie Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📅 *Release Year:* ${dl.date || 'N/A'}`;
                const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗠𝗢𝗩𝗜𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n🎬 *Title:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📅 *Year:* ${dl.date || 'N/A'}\n🎭 *Genres:* ${dl.genres || 'N/A'}\n⭐ *IMDb:* ${dl.imdb || 'N/A'}\n⏱ *Runtime:* ${dl.runtime || 'N/A'}\n\n🍿 *චිත්‍රපටය පහතින් ලබාගන්න.* \n\n> 👑 *SADEW-MINI* 👑`;
                const fileName = `${(dl.title || 'Movie').substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${dl.quality}.mp4`;
                
                let finalVidUrl = dl.url.trim();
                let apiBypassWorked = false;

                if (finalVidUrl.includes('drive.csplayer') || finalVidUrl.includes('server')) {
                    const tryDownloadUrl = async (urlToTry) => {
                        try {
                            const dlApiUrl = `${CZ_API}/download?url=${encodeURIComponent(urlToTry)}`;
                            const dlRes = await axios.get(dlApiUrl, { timeout: 20000 });
                            if (dlRes.data?.success && dlRes.data?.result?.downloadUrls) {
                                const httpUrl = dlRes.data.result.downloadUrls.find(u => 
                                    u.url && u.url.startsWith('http') && 
                                    !u.url.includes('t.me') && 
                                    !u.url.includes('telegram.me') && 
                                    !u.url.includes('telegram.dog')
                                );
                                if (httpUrl) return httpUrl.url;
                            }
                        } catch (e) { return null; }
                        return null;
                    };

                    let resolvedStreamUrl = await tryDownloadUrl(finalVidUrl);

                    if (!resolvedStreamUrl && finalVidUrl.includes('/server')) {
                        console.log("[CZ] Original server failed. Trying alternate servers 1-20...");
                        const altServers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
                        for (let s of altServers) {
                            const altUrl = finalVidUrl.replace(/\/server\d+\//, `/server${s}/`);
                            if (altUrl === finalVidUrl) continue; 
                            resolvedStreamUrl = await tryDownloadUrl(altUrl);
                            if (resolvedStreamUrl) {
                                console.log(`[CZ] Successfully bypassed using server${s} !`);
                                break;
                            }
                        }
                    }

                    if (resolvedStreamUrl) {
                        finalVidUrl = resolvedStreamUrl;
                        apiBypassWorked = true;
                    }

                    if (!apiBypassWorked) {
                        await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                        return reply("❌ *DanuZz API Error:* මෙම චිත්‍රපටයේ ලින්ක් එක සර්වර් 20ම පරීක්ෂා කිරීමෙන් පසුවත් Bypass කිරීමට අසමත් විය.");
                    }
                }

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                // FULL STREAM DOWNLOAD
                try {
                    console.log("[CZ] Streaming from:", finalVidUrl);
                    const streamRes = await axios({
                        method: 'GET', url: finalVidUrl, responseType: 'stream', timeout: 1800000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, maxRedirects: 10
                    });
                    
                    const ct = streamRes.headers['content-type'] || '';
                    if (ct.includes('text/html')) { 
                        streamRes.data.destroy(); 
                        throw new Error("HTML page received instead of video"); 
                    }

                    const cl = parseInt(streamRes.headers['content-length'] || '0');
                    const size = cl ? (cl / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown';
                    const finalCap = `${captionBase}\n📦 *Size:* ${size}\n\n> 👑 *SADEW-MINI* 👑`;
                    
                    await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName, caption: finalCap }, { quoted: metaQuote });
                    await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                    try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch (err) {}
                    setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

                } catch (e2) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    await reply(`❌ *Download Failed!* Error: ${e2.message}`);
                }
                
                delete global.czStore[id];

            } catch (e) {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Download Error!*");
            }
        }
    }
};
