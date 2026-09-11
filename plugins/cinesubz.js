const axios = require('axios');
const cheerio = require('cheerio');
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
    name: "cinesubz-scraper",
    category: 0,
    description: "Search and download Sinhala Subbed movies/tv shows directly via Scraper",
    commands: ["cz", "cinesubz", "cinesend", "cs_sel", "cs_dl", "cs_ep"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_CZ" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Cinesubz\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

        // ════════════════════════════════════════════════════════
        // 1. SEARCH (.cz) - Direct Scrape from cinesubz.net
        // ════════════════════════════════════════════════════════
        if (command === "cz" || command === "cinesubz" || command === "cinesend") {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*\n_උදා: .cz batman_");

            const parsed = parseCineSend(fullText);
            const query = parsed.query;
            const targetJid = parsed.targetJid;

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                const res = await axios.get(`https://cinesubz.net/?s=${encodeURIComponent(query)}`, { headers: HEADERS, timeout: 20000 });
                const $ = cheerio.load(res.data);
                const results = [];
                
                $('.result-item, article').each((i, el) => {
                    if (results.length >= 10) return;
                    const url = $(el).find('a').attr('href');
                    const img = $(el).find('img').attr('src');
                    const title = $(el).find('.title, h3').text().trim() || $(el).find('img').attr('alt');
                    const year = $(el).find('.year').text().trim();
                    const imdb = $(el).find('.rating').text().trim();
                    
                    if (url && title && !url.includes('/author/')) {
                        results.push({ url, img, title, year, imdb });
                    }
                });

                if (results.length === 0) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Movies කිසිවක් හමුවූයේ නැත.*");
                }

                let listText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝘀𝘂𝗯𝘇 𝗦𝗲𝗮𝗿𝗰𝗵 🎬] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${results.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                results.forEach((mv, i) => {
                    listText += `*${i + 1}.* ${mv.title}\n   ⭐ ${mv.imdb || 'N/A'} | 📅 ${mv.year || 'N/A'}\n\n`;

                    const id = storeData({ url: mv.url, title: mv.title, img: mv.img, date: mv.year, targetJid: targetJid });

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
                console.error("[CZ] Search Scrape Error:", e.message);
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය. Site එකෙන් දත්ත ලබාගත නොහැක.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. SELECT (.cs_sel) - Extract Download Links or Episodes
        // ════════════════════════════════════════════════════════
        else if (command === "cs_sel") {
            const id = args[0];
            const movie = global.czStore[id];
            if (!movie) return reply("❌ *Link expired. නැවත .cz search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
                await reply(`📥 *${movie.title}* සඳහා දත්ත ලබා ගනිමින්...`);

                const res = await axios.get(movie.url, { headers: HEADERS, timeout: 20000 });
                const $ = cheerio.load(res.data);
                
                // 📺 Check for TV Show Episodes
                const episodes = [];
                $('.episodiotitle a').each((i, el) => {
                    episodes.push({ url: $(el).attr('href'), title: $(el).text().trim() });
                });

                if (episodes.length > 0) {
                    const buttons = [];
                    let capText = `*↳ ❝ [📺 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 - TV Series] ¡! ❞*\n\n`;
                    capText += `🎬 *Title:* ${movie.title}\n📺 *Episodes:* ${episodes.length}\n\n`;
                    if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n\n`;
                    capText += `> *ඔබට අවශ්‍ය Episode එක තෝරන්න* ⬇️`;

                    episodes.slice(0, 50).forEach((ep, idx) => {
                        const epId = storeData({
                            title: `${movie.title} - ${ep.title}`, url: ep.url,
                            targetJid: movie.targetJid, img: movie.img, date: movie.date
                        });
                        buttons.push({
                            buttonId: `.cs_sel ${epId}`, // Recursively call cs_sel for the episode page
                            buttonText: { displayText: `🎬 Ep ${idx + 1}: ${ep.title}`.substring(0, 20) },
                            type: 1
                        });
                    });

                    const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                    if (movie.img) msgOpts.image = { url: movie.img };
                    await socket.sendMessage(sender, msgOpts, { quoted: msg });
                    await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                    delete global.czStore[id];
                    return;
                }

                // 🎬 Extract Movie Download Links (zt-links)
                const downloads = [];
                $('a[href*="zt-links"]').each((i, el) => {
                    const link = $(el).attr('href');
                    const text = $(el).parent().text().trim() || $(el).text().trim();
                    
                    let qualityLabel = "HD";
                    if (text.includes("480")) qualityLabel = "480p";
                    if (text.includes("720")) qualityLabel = "720p";
                    if (text.includes("1080")) qualityLabel = "1080p";
                    
                    const sizeMatch = text.match(/[\d.]+\s*[M|G]B/i);
                    const size = sizeMatch ? sizeMatch[0] : "";

                    downloads.push({ url: link, meta: `${qualityLabel} ${size ? `(${size})` : ''}`.trim() });
                });

                if (downloads.length === 0) {
                    delete global.czStore[id];
                    return reply("❌ *මෙම වීඩියෝව සඳහා Download Links හමු නොවිණි.*");
                }

                const buttons = [];
                let capText = `*↳ ❝ [🎬 𝗦𝗮𝗱𝗲𝘄 𝗖𝗶𝗻𝗲𝗠𝗮𝘅 🎬] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${movie.title}\n📅 *Year:* ${movie.date || 'N/A'}\n\n`;
                if (movie.targetJid) capText += `🎯 *Send Target:* \`${movie.targetJid}\`\n\n`;
                capText += `> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const dlId = storeData({
                        title: movie.title, qualityLabel: dl.meta, url: dl.url,
                        targetJid: movie.targetJid, img: movie.img, date: movie.date
                    });
                    buttons.push({
                        buttonId: `.cs_dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${dl.meta}` },
                        type: 1
                    });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: movie.img ? 4 : 1 };
                if (movie.img) msgOpts.image = { url: movie.img };
                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "🎬", key: msg.key } });
                delete global.czStore[id];

            } catch (e) {
                console.error("[CZ] Select Scrape Error:", e.message);
                reply("❌ *Movie details ලබා ගැනීමේ දෝෂයක්.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 3. DOWNLOAD (.cs_dl) - Process zt-links and Download
        // ════════════════════════════════════════════════════════
        else if (command === "cs_dl") {
            const id = args[0];
            const dl = global.czStore[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) {
                    await reply(`🚀 *[CineSend]* \`${dl.title}\` (${dl.qualityLabel}) ඩවුන්ලෝඩ් කරමින් පවතී...`);
                } else {
                    await reply(`📥 *Downloading ${dl.title}*\n🎯 ${dl.qualityLabel}\n_Direct Link සම්බන්ධ වෙමින් පවතී..._`);
                }

                // 1. Fetch zt-links page HTML
                const ztRes = await axios.get(dl.url, { headers: HEADERS, timeout: 20000 });
                const ztHtml = ztRes.data;

                // 2. Extract the hidden google.com / sonic-cloud link
                const linkMatch = ztHtml.match(/<a id="link" href="([^"]+)"/);
                if (!linkMatch) return reply("❌ *Direct Link එක Site එකෙන් සොයාගත නොහැකි විය.*");
                
                let rawLink = linkMatch[1]; // e.g. https://google.com/server7/....mp4

                // 3. Extract urlMappings array from javascript and apply it! (Cinesubz Master Trick)
                const mappingMatch = ztHtml.match(/var urlMappings = (\[.*?\]);/);
                if (mappingMatch) {
                    try {
                        const mappings = JSON.parse(mappingMatch[1]);
                        let urlChanged = false;
                        mappings.forEach(map => {
                            if (urlChanged) return;
                            map.search.forEach(s => {
                                if (urlChanged) return;
                                const tempUrl = rawLink.replace(s, map.replace);
                                if (tempUrl !== rawLink) {
                                    rawLink = tempUrl;
                                    urlChanged = true;
                                }
                            });
                        });
                    } catch (e) { console.log("[CZ] Mapping JSON Error:", e.message); }
                }

                // 4. Fix extensions
                rawLink = rawLink.replace(/\.mp4\?bot=/, "?ext=mp4&bot=").replace(/\.mp4$/, "?ext=mp4");

                console.log("[CZ] Final Direct Link:", rawLink);

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

                // 5. Download the final rawLink!
                const streamRes = await axios({
                    method: 'GET', url: rawLink, responseType: 'stream', timeout: 300000,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': dl.url }, maxRedirects: 10
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
                await reply("❌ *Download Failed!* ලින්ක් එක Expire වී ඇත හෝ දෝෂයක් ඇත.");
            }
            delete global.czStore[id];
        }
    }
};
