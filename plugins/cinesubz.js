const axios = require('axios');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE 
// ════════════════════════════════════════════════════════
if (!global.czStore) global.czStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 20 * 60 * 1000) { 
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
    description: "Search and download Movies and TV Series from Cinesubz",
    commands: ["cz", "cinesubz", "cinesend", "cs_sel", "cs_dl", "cs_ep", "cs_all"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const CZ_API = "https://cz-dnuz.vercel.app";
        const OLD_API = "https://cinesubz-api-cnw.vercel.app/api";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        // 💎 Premium Users LIDs & Numbers
        const premiumUsers = [
            "194601394663437", 
            "94769634033"      
        ];
        const actualSender = msg.key.participant || msg.key.remoteJid || sender;
        const isPremium = premiumUsers.some(id => actualSender.includes(id));

        // ════════════════════════════════════════════════════════
        // ⚙️ CORE DOWNLOAD FUNCTION (Fixed placement)
        // ════════════════════════════════════════════════════════
        const executeDownload = async (dlDetails) => {
            const destJid = dlDetails.targetJid || sender;
            const captionBase = `🎬 *Name:* ${dlDetails.title}\n📽 *Quality:* ${dlDetails.quality}`;
            const targetCardText = `*↳ ❝ [🎬 𝗡𝗘𝗪 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 🎬] ¡! ❞*\n\n🎬 *Title:* ${dlDetails.title}\n📽 *Quality:* ${dlDetails.quality}\n\n> 👑 *SADEW-MINI* 👑`;
            const fileName = `${(dlDetails.title).substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '').trim()} - ${dlDetails.quality}.mp4`;
            let downloadSuccess = false;

            const sendCard = async () => {
                try {
                    if (dlDetails.img) await socket.sendMessage(destJid, { image: { url: dlDetails.img }, caption: targetCardText }, { quoted: metaQuote });
                    else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                } catch (e) {}
            };

            if (dlDetails.isPlayer) {
                try {
                    const htmlRes = await axios.get(dlDetails.url, { timeout: 15000 });
                    const match = htmlRes.data.match(/const ALL_QUALITIES = (\[.*?\]);/);
                    if (match) {
                        const qs = JSON.parse(match[1]);
                        const rq = dlDetails.quality.toLowerCase().includes('480') ? '480p' : '720p';
                        const matched = qs.find(q => q.html?.toLowerCase().includes(rq) || q.url?.toLowerCase().includes(rq));
                        if (matched?.url) {
                            if (dlDetails.targetJid) await sendCard();
                            await socket.sendMessage(destJid, { document: { url: matched.url }, mimetype: "video/mp4", fileName, caption: `${captionBase}\n> 👑 *SADEW-MINI*` }, { quoted: metaQuote });
                            downloadSuccess = true;
                        }
                    }
                } catch (e) {}
            }

            if (!downloadSuccess && !dlDetails.isPlayer) {
                let resolvedUrl = dlDetails.url.trim();
                resolvedUrl = resolvedUrl.replace(/\/(server\d+)\/\d+:\//g, '/$1/');
                if (resolvedUrl.endsWith('.mp4') && !resolvedUrl.includes('?ext=')) resolvedUrl = resolvedUrl.replace(/\.mp4$/, '?ext=mp4');
                let fallbackUrl = resolvedUrl.replace(/\/server\d+\//, '/server1/');

                const tryApi = async (urlToTry) => {
                    try {
                        const dlRes = await axios.get(`${CZ_API}/download?url=${urlToTry}`, { timeout: 20000 });
                        if (dlRes.data.success && dlRes.data.result?.downloadUrls) {
                            const httpUrl = dlRes.data.result.downloadUrls.find(u => u.url && u.url.startsWith('http') && !u.url.toLowerCase().includes('telegram'));
                            if (!httpUrl?.url) return false;

                            if (dlDetails.targetJid) await sendCard();
                            
                            const streamRes = await axios({ method: 'GET', url: httpUrl.url, responseType: 'stream', timeout: 300000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 10 });
                            const cl = parseInt(streamRes.headers['content-length'] || '0');
                            const size = cl ? (cl / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown';
                            
                            await socket.sendMessage(destJid, { document: { stream: streamRes.data }, mimetype: "video/mp4", fileName, caption: `${captionBase}\n📦 *Size:* ${size}\n> 👑 *SADEW-MINI*` }, { quoted: metaQuote });
                            
                            try { if (streamRes.data.destroy) streamRes.data.destroy(); } catch (err) {}
                            setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);
                            return true;
                        }
                        return false;
                    } catch (e) { return false; }
                };

                downloadSuccess = await tryApi(resolvedUrl);
                if (!downloadSuccess && fallbackUrl !== resolvedUrl) downloadSuccess = await tryApi(fallbackUrl);
            }
            return downloadSuccess;
        };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH (.cz / .cinesubz / .cinesend)
        // ════════════════════════════════════════════════════════
        if (command === "cz" || command === "cinesubz" || command === "cinesend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර නම ලබා දෙන්න!*\n_උදා: .cz batman_");

            const { query, targetJid } = parseCineSend(fullText);
            if (command === "cinesend" && !targetJid) return reply("❌ *නිවැරදි JID එකක් ලබාදෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });
                const res = await axios.get(`${CZ_API}/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                const data = res.data;

                if (!data.success || !data.result?.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, කිසිවක් හමුවූයේ නැත.*");
                }

                const topResults = data.result.slice(0, 10);
                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                topResults.forEach((mv, i) => {
                    const icon = mv.type === 'tvshows' ? '📺' : '🎬';
                    listText += `*${i + 1}.* ${icon} ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.date || 'N/A'}\n\n`;

                    const id = storeData({
                        url: mv.url, title: mv.title, img: mv.img,
                        date: mv.date, genres: mv.genres, imdb: mv.imdb,
                        runtime: mv.runtime, id: mv.id, targetJid: targetJid
                    });

                    buttons.push({
                        buttonId: `.cs_sel ${id}`,
                        buttonText: { displayText: `${icon} ${i + 1}. ${(mv.title || '').slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් Movie/TV Series එක තෝරන්න*`;
                await socket.sendMessage(sender, { text: listText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: metaQuote });
                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[CZ] Search Error:", e.message);
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. MOVIE / TV SHOW SELECT (.cs_sel)
        // ════════════════════════════════════════════════════════
        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* හි විස්තර සකසමින්...`);

                let downloads = [];

                try {
                    const movidlUrl = `${CZ_API}/movidl?url=${encodeURIComponent(movie.url)}`;
                    const dlRes = await axios.get(movidlUrl, { timeout: 20000 });
                    
                    if (dlRes.data.result?.type === 'tvshow' || dlRes.data.result?.episodes) {
                        const episodes = dlRes.data.result.episodes || [];
                        if (!episodes.length) return reply("❌ *Episodes හමු නොවිණි.*");

                        const tvId = storeData({ ...movie, episodes: episodes });

                        let tvCap = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗧𝗩 𝗦𝗲𝗿𝗶𝗲𝘀 📺] ¡! ❞*\n\n`;
                        tvCap += `📺 *Title:* ${movie.title}\n🔢 *Total Episodes:* ${episodes.length}\n`;
                        if (movie.targetJid) tvCap += `🎯 *Send Target:* \`${movie.targetJid}\`\n`;
                        tvCap += `\n> *ඔබට අවශ්‍ය Episode එක තෝරන්න* ⬇️`;

                        const tvButtons = [];
                        tvButtons.push({
                            buttonId: `.cs_all ${tvId}`,
                            buttonText: { displayText: `💎 Download All (Premium)` },
                            type: 1
                        });

                        episodes.forEach((ep, index) => {
                            tvButtons.push({
                                buttonId: `.cs_ep ${tvId} ${index}`,
                                buttonText: { displayText: `🎬 Ep ${ep.episode}` },
                                type: 1
                            });
                        });

                        const msgOpts = { caption: tvCap, footer: botName, buttons: tvButtons, headerType: movie.img ? 4 : 1 };
                        if (movie.img) msgOpts.image = { url: movie.img };
                        
                        await socket.sendMessage(sender, msgOpts, { quoted: msg });
                        await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                        return; 
                    }

                    downloads = dlRes.data.result?.downloads || [];
                } catch (dlErr) {
                    if (dlErr.response && (dlErr.response.status >= 500 || dlErr.response.status === 404)) {
                        try {
                            const oldRes = await axios.get(`${OLD_API}/extract?id=${movie.id}&type=mv`, { timeout: 15000 });
                            if (oldRes.data?.data) {
                                const directVideo = oldRes.data.data.find(v => v.is_direct_mp4) || oldRes.data.data[0];
                                if (directVideo?.link?.includes('player')) {
                                    downloads = [ { meta: "480p", resolvedUrl: directVideo.link, isPlayer: true }, { meta: "720p", resolvedUrl: directVideo.link, isPlayer: true } ];
                                }
                            }
                        } catch (oldErr) {}
                    }
                }

                if (!downloads.length) return reply("❌ *Download Links හමු නොවිණි.*");

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n⭐ *IMDB:* ${movie.imdb || 'N/A'}\n`;
                if (movie.targetJid) capText += `🎯 *Target:* \`${movie.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const resolvedUrl = dl.resolvedUrl || dl.ztLink || '';
                    if (!resolvedUrl) return;

                    const dlId = storeData({ ...movie, quality: dl.meta || 'HD', url: resolvedUrl, isPlayer: !!dl.isPlayer });
                    buttons.push({ buttonId: `.cs_dl ${dlId}`, buttonText: { displayText: `🎥 ${dl.meta || 'HD'}` }, type: 1 });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });

            } catch (e) {
                reply("❌ *Movie/TV details error.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. EPISODE QUALITY SELECT (.cs_ep)
        // ════════════════════════════════════════════════════════
        else if (command === "cs_ep") {
            const tvId = args[0];
            const epIndex = parseInt(args[1]);
            const tv = global.czStore[tvId];
            if (!tv || !tv.episodes[epIndex]) return reply("❌ *Link expired.*");

            const ep = tv.episodes[epIndex];
            const downloads = ep.downloads || [];
            if (!downloads.length) return reply(`❌ *Episode ${ep.episode} සඳහා ලින්ක්ස් නැත.*`);

            const buttons = [];
            let capText = `📺 *${tv.title}*\n🎬 *Episode ${ep.episode}:* ${ep.episodeTitle || 'N/A'}\n\n> *Quality එක තෝරන්න* ⬇️`;

            downloads.forEach((dl) => {
                let label = dl.meta || 'HD';
                let rawUrl = dl.resolvedUrl || dl.ztLink || '';
                
                const dlId = storeData({ ...tv, title: `${tv.title} - Ep ${ep.episode}`, quality: label, url: rawUrl, isPlayer: false });
                buttons.push({ buttonId: `.cs_dl ${dlId}`, buttonText: { displayText: `🎥 ${label.split('•')[0].trim()}` }, type: 1 });
            });

            await socket.sendMessage(sender, { text: capText, footer: botName, buttons: buttons, headerType: 1 }, { quoted: msg });
        }

        // ════════════════════════════════════════════════════════
        // 4. DOWNLOAD MOVIE/EPISODE (.cs_dl)
        // ════════════════════════════════════════════════════════
        else if (command === "cs_dl") {
            const dl = global.czStore[args[0]];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
            await reply(dl.targetJid ? `🚀 *[CineSend]* ඩවුන්ලෝඩ් කර යවමින් පවතී...` : `📥 *Downloading ${dl.title}...*`);

            const success = await executeDownload(dl);
            if (success) await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
            else reply("❌ *Download Failed! සර්වර් එකේ ලින්ක් එක Expire වී ඇත.*");
            delete global.czStore[args[0]];
        }

        // ════════════════════════════════════════════════════════
        // 5. 💎 PREMIUM DOWNLOAD ALL (.cs_all)
        // ════════════════════════════════════════════════════════
        else if (command === "cs_all") {
            if (!isPremium) return reply("❌ *මෙම පහසුකම Premium Users ලාට පමණි!* 💎\n_වෙන වෙනම බටන් ක්ලික් කර Episode එකෙන් එක ඩවුන්ලෝඩ් කරගන්න._");

            const tv = global.czStore[args[0]];
            if (!tv || !tv.episodes) return reply("❌ *Link expired.*");

            await socket.sendMessage(sender, { react: { text: "💎", key: msg.key } });
            await reply(`🚀 *[PREMIUM]* \`${tv.title}\` හි Episodes ${tv.episodes.length} ම ඩවුන්ලෝඩ් වීම ආරම්භ විය...`);

            for (let i = 0; i < tv.episodes.length; i++) {
                const ep = tv.episodes[i];
                if (!ep.downloads || !ep.downloads.length) continue;

                let selectedDl = ep.downloads.find(d => (d.meta || '').includes('720')) || ep.downloads[0];
                let rawUrl = selectedDl.resolvedUrl || selectedDl.ztLink || selectedDl.url || '';

                const details = { ...tv, title: `${tv.title} - Ep ${ep.episode}`, quality: selectedDl.meta || 'HD', url: rawUrl, isPlayer: false };

                const success = await executeDownload(details);
                if (!success) await reply(`⚠️ *Ep ${ep.episode}* Download Failed!`);

                await new Promise(r => setTimeout(r, 6000));
            }
            await reply(`✅ *[PREMIUM]* ${tv.title} හි සියල්ල යවා අවසන්!`);
        }
    }
};
