const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE (TV Series සඳහා වෙනම Store එකක්)
// ════════════════════════════════════════════════════════
if (!global.tvStore) global.tvStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 20 * 60 * 1000) {
    const id = genId();
    global.tvStore[id] = data;
    setTimeout(() => { delete global.tvStore[id]; }, ttlMs);
    return id;
}

// 🎯 JID Forward Parser (කලින් එකමයි)
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
    name: "cinesubz-tvseries",
    category: "TV Series",
    description: "Search and download Sinhala Subbed TV Series",
    commands: ["tv", "tvsend", "tv_sel", "tv_ep", "tv_dl", "tv_all"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const CZ_API = "https://cz-dnuz.vercel.app";
        
        // 💎 Premium Users LIDs & Numbers (මෙහි ඔයාගේ ඒවා දාන්න)
        const premiumUsers = [
            "194601394663437", // ඔයාගේ LID එක
            "94769634033"      // ඔයාගේ නම්බර් එක
        ];
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isPremium = premiumUsers.some(id => actualSender.includes(id));

        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH TV SERIES (.tv)
        // ════════════════════════════════════════════════════════
        if (command === "tv" || command === "tvsend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර TV Series එකේ නම ලබා දෙන්න!*\n_උදා: .tv batman beyond_");

            const { query, targetJid } = parseCineSend(fullText);

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (!res.data.success || !res.data.result?.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, TV Series කිසිවක් හමුවූයේ නැත.*");
                }

                // 📺 TV Series පමණක් ෆිල්ටර් කිරීම
                const tvShows = res.data.result.filter(mv => mv.type === 'tvshows' || mv.url.includes('/tvshows/')).slice(0, 10);
                if (!tvShows.length) return reply("❌ *TV Series පමණක් හමුවූයේ නැත. කරුණාකර වෙනත් නමක් ලබාදෙන්න.*");

                let listText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 𝗦𝗲𝗮𝗿𝗰𝗵 📺] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${tvShows.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                tvShows.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.date || 'N/A'}\n\n`;
                    const id = storeData({ url: mv.url, title: mv.title, img: mv.img, targetJid: targetJid });
                    buttons.push({
                        buttonId: `.tv_sel ${id}`,
                        buttonText: { displayText: `📺 ${i + 1}. ${(mv.title || '').slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් TV Series එක තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[TV] Search Error:", e.message);
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. TV SERIES SELECT (.tv_sel) - GET EPISODES
        // ════════════════════════════════════════════════════════
        else if (command === "tv_sel") {
            const id = args[0];
            const tv = global.tvStore[id];
            if (!tv) return reply("❌ *Link expired. නැවත .tv search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${tv.title}* හි Episodes සකසමින්...`);

                const movidlUrl = `${CZ_API}/movidl?url=${encodeURIComponent(tv.url)}`;
                const dlRes = await axios.get(movidlUrl, { timeout: 25000 });
                const episodes = dlRes.data.result?.episodes || [];

                if (!episodes.length) {
                    delete global.tvStore[id];
                    return reply("❌ *මෙම TV Series එක සඳහා Episodes හමු නොවිණි.*");
                }

                // සම්පූර්ණ Data එක අලුත් ID එකකින් Save කරනවා
                const tvId = storeData({ title: tv.title, episodes: episodes, targetJid: tv.targetJid, img: tv.img });

                let capText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n`;
                capText += `📺 *Title:* ${tv.title}\n🔢 *Total Episodes:* ${episodes.length}\n`;
                if (tv.targetJid) capText += `🎯 *Send Target:* \`${tv.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Episode එක පහලින් තෝරන්න* ⬇️`;

                const buttons = [];
                // 💎 Download All Button (For Premium)
                buttons.push({
                    buttonId: `.tv_all ${tvId}`,
                    buttonText: { displayText: `💎 Download All (Premium)` },
                    type: 1
                });

                // Episode Buttons
                episodes.forEach((ep, index) => {
                    buttons.push({
                        buttonId: `.tv_ep ${tvId} ${index}`,
                        buttonText: { displayText: `🎬 Ep ${ep.episode} - ${ep.episodeTitle || 'Full'}` },
                        type: 1
                    });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: tv.img ? 4 : 1 };
                if (tv.img) msgOpts.image = { url: tv.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (e) {
                console.error("[TV] Episode Fetch Error:", e.message);
                reply("❌ *Episodes ලබා ගැනීමේ දෝෂයක්.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. EPISODE SELECT (.tv_ep) - GET QUALITIES
        // ════════════════════════════════════════════════════════
        else if (command === "tv_ep") {
            const tvId = args[0];
            const epIndex = parseInt(args[1]);
            const tv = global.tvStore[tvId];
            if (!tv || !tv.episodes[epIndex]) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const ep = tv.episodes[epIndex];
            const downloads = ep.downloads || [];

            if (!downloads.length) return reply(`❌ *Episode ${ep.episode} සඳහා ලින්ක්ස් හමු නොවිණි.*`);

            const buttons = [];
            let capText = `📺 *${tv.title}*\n🎬 *Episode ${ep.episode}:* ${ep.episodeTitle || 'N/A'}\n\n> *Quality එක තෝරන්න* ⬇️`;

            downloads.forEach((dl) => {
                let label = dl.meta || 'HD';
                let rawUrl = dl.resolvedUrl || dl.ztLink || dl.url || '';
                
                const dlId = storeData({
                    title: `${tv.title} - Ep ${ep.episode}`,
                    quality: label, url: rawUrl, targetJid: tv.targetJid, img: tv.img
                });

                buttons.push({
                    buttonId: `.tv_dl ${dlId}`,
                    buttonText: { displayText: `🎥 ${label.split('•')[0].trim()}` },
                    type: 1
                });
            });

            await socket.sendMessage(sender, { text: capText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: msg });
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD CORE LOGIC (Reusable Function)
        // ════════════════════════════════════════════════════════
        const processAndDownloadVideo = async (urlToFix, movieDetails) => {
            const destJid = movieDetails.targetJid || sender;
            let resolvedUrl = urlToFix.trim();

            // ⚠️ OLD CODE URL FIXES — critical for API to work!
            resolvedUrl = resolvedUrl.replace(/\/(server\d+)\/\d+:\//g, '/$1/');
            if (resolvedUrl.endsWith('.mp4') && !resolvedUrl.includes('?ext=')) {
                resolvedUrl = resolvedUrl.replace(/\.mp4$/, '?ext=mp4');
            }
            let fallbackUrl = resolvedUrl.replace(/\/server\d+\//, '/server1/');

            const tryDownloadApi = async (urlToTry) => {
                try {
                    const dlApiUrl = `${CZ_API}/download?url=${urlToTry}`; // NO encodeURIComponent!
                    const dlRes = await axios.get(dlApiUrl, { timeout: 20000 });
                    const dlData = dlRes.data;

                    if (dlData.success && dlData.result?.downloadUrls) {
                        const isTelegram = (u) => u.toLowerCase().includes('telegram');
                        const httpUrl = dlData.result.downloadUrls.find(u => u.url && u.url.startsWith('http') && !isTelegram(u.url));

                        if (!httpUrl?.url) return false;
                        const vidUrl = httpUrl.url;

                        const fileName = `${(movieDetails.title).substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${movieDetails.quality.includes('480') ? '480p' : '720p'}.mp4`;
                        const cap = `🎬 *Title:* ${movieDetails.title}\n📽 *Quality:* ${movieDetails.quality}\n\n> 👑 *SADEW-MINI* 👑`;

                        // ⬇️ FULL STREAM DOWNLOAD (RAM Safe)
                        const streamRes = await axios({
                            method: 'GET', url: vidUrl, responseType: 'stream', timeout: 300000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 10
                        });
                        
                        await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName, caption: cap });

                        // 🧹 Garbage Collection
                        try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch (err) {}
                        setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

                        return true;
                    }
                    return false;
                } catch (e) {
                    console.log("[TV] /download API Error:", e.message);
                    return false;
                }
            };

            let success = await tryDownloadApi(resolvedUrl);
            if (!success && fallbackUrl !== resolvedUrl) success = await tryDownloadApi(fallbackUrl);
            return success;
        };

        // ════════════════════════════════════════════════════════
        // 5. DOWNLOAD SINGLE EPISODE (.tv_dl)
        // ════════════════════════════════════════════════════════
        else if (command === "tv_dl") {
            const dlId = args[0];
            const dl = global.tvStore[dlId];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
            await reply(`📥 *Downloading ${dl.title}...*`);

            const success = await processAndDownloadVideo(dl.url, dl);
            if (success) await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            else {
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *Download Failed! සර්වර් එකේ ලින්ක් එක Expire වී ඇත.*");
            }
            delete global.tvStore[dlId];
        }

        // ════════════════════════════════════════════════════════
        // 6. 💎 DOWNLOAD ALL EPISODES (.tv_all) - PREMIUM ONLY
        // ════════════════════════════════════════════════════════
        else if (command === "tv_all") {
            if (!isPremium) {
                return reply("❌ *මෙම පහසුකම භාවිතා කළ හැක්කේ Premium Users ලාට පමණි!* 💎\n_වෙන වෙනම බටන් ක්ලික් කර Episode එකෙන් එක ඩවුන්ලෝඩ් කරගන්න._");
            }

            const tvId = args[0];
            const tv = global.tvStore[tvId];
            if (!tv) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "💎", key: msg.key } });
            await reply(`🚀 *[PREMIUM]* \`${tv.title}\` හි Episodes ${tv.episodes.length} ම ඩවුන්ලෝඩ් වීම ආරම්භ විය...\n_කරුණාකර රැඳී සිටින්න._`);

            for (let i = 0; i < tv.episodes.length; i++) {
                const ep = tv.episodes[i];
                if (!ep.downloads || !ep.downloads.length) continue;

                // Auto Select Quality: 720p නැත්නම් තියෙන පළවෙනි එක ගන්නවා
                let selectedDl = ep.downloads.find(d => (d.meta || '').includes('720')) || ep.downloads[0];
                let rawUrl = selectedDl.resolvedUrl || selectedDl.ztLink || selectedDl.url || '';

                const details = {
                    title: `${tv.title} - Ep ${ep.episode}`,
                    quality: selectedDl.meta || 'HD',
                    targetJid: tv.targetJid
                };

                console.log(`[Premium Loop] Downloading Ep ${ep.episode}...`);
                await processAndDownloadVideo(rawUrl, details);

                // Anti-Spam / Rate Limit ආරක්ෂාව සඳහා තත්පර 5ක පරතරයක්
                await new Promise(r => setTimeout(r, 5000)); 
            }

            await reply(`✅ *[PREMIUM]* ${tv.title} හි Episodes සියල්ල යවා අවසන්!`);
        }
    }
};
