const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════
// GLOBAL STORE — short IDs for button data
// ════════════════════════════════════════════════════════
if (!global.anStore) global.anStore = {};

function genId() { return crypto.randomBytes(4).toString('hex'); }

function storeData(data, ttlMs = 15 * 60 * 1000) {
    const id = genId();
    global.anStore[id] = data;
    setTimeout(() => { delete global.anStore[id]; }, ttlMs);
    return id;
}

// 🎯 SMART PARSER FOR JID
function parseTargetJid(fullText) {
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
    name: "animost-downloader",
    category: 0,
    description: "Search and download Sinhala Dubbed Anime from AnimostLK",
    
    // Menu එකේ පෙන්වන ප්‍රධාන Commands
    commands: ["animost", "ani"],

    handler: async ({ socket, msg, sender, command, args, reply }) => {
        const botName = "👑 SADEW-MINI 👑";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_ANI" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Sadew Anime\nTEL;waid=94700000000:+94 70 000 0000\nEND:VCARD` } }
        };

        const subCmd = args[0]; 
        const subId = args[1];  

        // ════════════════════════════════════════════════════════
        // 1. ANIME SELECT (--sel) 
        // ════════════════════════════════════════════════════════
        if (subCmd === "--sel") {
            const id = subId;
            const anime = global.anStore[id];
            if (!anime) return reply("❌ *Link expired. නැවත search කරන්න.*");

            try {
                await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

                // Cheerio හරහා HTML කෝඩ් එකෙන් ලින්ක්ස් හොරාගැනීම (Scraping)
                const $ = cheerio.load(anime.content);
                let downloads = [];

                $('a').each((i, el) => {
                    let href = $(el).attr('href');
                    if (href && href.includes('.workers.dev')) {
                        // Quality එක හොයාගැනීම (e.g. 1080P | 2GB)
                        let qText = $(el).closest('.dlBox').prevAll('h3').first().text().trim() || "HD Video";
                        
                        // Direct Download වෙන්න හදමු
                        href = href.replace(/&amp;/g, '&');
                        if (!href.includes('download=true')) href += '&download=true';

                        if (!downloads.find(d => d.url === href)) {
                            downloads.push({ meta: qText, url: href });
                        }
                    }
                });

                if (!downloads.length) {
                    delete global.anStore[id];
                    return reply("❌ *මෙම Anime එක සඳහා Direct Download Links හමු නොවිණි. එය Telegram හරහා පමණක් ලබා දී තිබිය හැක.*");
                }

                const buttons = [];
                let capText = `*↳ ❝ [📺 𝗔𝗻𝗶𝗺𝗼𝘀𝘁 𝗟𝗞 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿 ] ¡! ❞*\n\n`;
                capText += `🎬 *Title:* ${anime.title}\n`;
                if (anime.targetJid) capText += `🎯 *Send Target:* \`${anime.targetJid}\`\n`;
                capText += `\n> *ඔබට අවශ්‍ය Quality එක පහලින් තෝරන්න* ⬇️`;

                downloads.forEach((dl) => {
                    const dlId = storeData({
                        title: anime.title, quality: dl.meta, url: dl.url,
                        targetJid: anime.targetJid, img: anime.img
                    });
                    buttons.push({
                        buttonId: `.ani --dl ${dlId}`,
                        buttonText: { displayText: `🎥 ${dl.meta.substring(0, 20)}` },
                        type: 1
                    });
                });

                const msgOpts = { caption: capText, footer: botName, buttons: buttons, headerType: anime.img ? 4 : 1 };
                if (anime.img) msgOpts.image = { url: anime.img };

                await socket.sendMessage(sender, msgOpts, { quoted: msg });
                await socket.sendMessage(sender, { react: { text: "📺", key: msg.key } });
                delete global.anStore[id];

            } catch (e) {
                console.error("[ANI] Select Error:", e.message);
                reply("❌ *දත්ත ලබා ගැනීමේ දෝෂයක්.*");
            }
        }

        // ════════════════════════════════════════════════════════
        // 2. DOWNLOAD ITEM (--dl)
        // ════════════════════════════════════════════════════════
        else if (subCmd === "--dl") {
            const id = subId;
            const dl = global.anStore[id];
            if (!dl) return reply("❌ *Link expired. නැවත search කරන්න.*");

            const destJid = dl.targetJid || sender;

            try {
                await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                
                if (dl.targetJid) {
                    await reply(`🚀 *[AnimostLK]* \`${dl.title}\` ඩවුන්ලෝඩ් කර \`${dl.targetJid}\` වෙත යවමින් පවතී...`);
                } else {
                    await reply(`📥 *Downloading ${dl.title}...*\n_Direct Link සම්බන්ධ වෙමින් පවතී..._`);
                }

                const targetCardText = `*↳ ❝ [📺 𝗡𝗘𝗪 𝗔𝗡𝗜𝗠𝗘 𝗔𝗥𝗥𝗜𝗩𝗔𝗟 📺] ¡! ❞*\n\n` +
                    `🎬 *Title:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n\n` +
                    `🍿 *වීඩියෝව පහතින් ලබාගන්න.* \n\n> 👑 *SADEW-MINI* 👑`;

                const fileName = `${dl.title.substring(0, 40).replace(/[^a-zA-Z0-9 .\-]/g, '').trim()} - ${dl.quality.split('|')[0].trim()}.mp4`;

                if (dl.targetJid) {
                    try {
                        if (dl.img) await socket.sendMessage(destJid, { image: { url: dl.img }, caption: targetCardText }, { quoted: metaQuote });
                        else await socket.sendMessage(destJid, { text: targetCardText }, { quoted: metaQuote });
                    } catch (cardErr) {}
                }

                // Download Processing
                const streamRes = await axios({
                    method: 'GET', url: dl.url, responseType: 'stream', timeout: 300000,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animostlk.blogspot.com/' }, maxRedirects: 10
                });

                let actualSize = 'Unknown';
                const cl = parseInt(streamRes.headers['content-length'] || '0');
                if (cl) actualSize = (cl / 1024 / 1024).toFixed(1) + ' MB';

                const finalCap = `🎬 *Name:* ${dl.title}\n📽 *Quality:* ${dl.quality}\n📦 *Real Size:* ${actualSize}\n\n> 👑 *SADEW-MINI* 👑`;

                await socket.sendMessage(destJid, {
                    document: { stream: streamRes.data },
                    mimetype: "video/mp4", fileName: fileName, caption: finalCap
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

                try { if (streamRes.data && typeof streamRes.data.destroy === 'function') streamRes.data.destroy(); } catch (err) {}
                setTimeout(() => { try { if (global.gc) global.gc(); } catch (e) {} }, 5000);

            } catch (e2) {
                console.error("[ANI] Stream failed:", e2.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                await reply("❌ *Download Failed!* සර්වර් එකෙන් වීඩියෝව ලබාගත නොහැකි විය.");
            }
            delete global.anStore[id];
        }

        // ════════════════════════════════════════════════════════
        // 3. NORMAL SEARCH (Main Command)
        // ════════════════════════════════════════════════════════
        else {
            const fullText = args.join(" ").trim();
            if (!fullText) return reply("🎬 *කරුණාකර Anime එකේ නම ලබා දෙන්න!*\n_උදා: .ani naruto_");

            const parsed = parseTargetJid(fullText);
            const query = parsed.query;
            const targetJid = parsed.targetJid;

            if (!query) return reply("🎬 *කරුණාකර Anime එකේ නම ලබා දෙන්න!*");

            try {
                await socket.sendMessage(sender, { react: { text: "🔍", key: msg.key } });

                // Blogger JSON API හරහා සර්ච් කිරීම (Max 15 results)
                const searchUrl = `https://animostlk.blogspot.com/feeds/posts/default?alt=json&q=${encodeURIComponent(query)}&max-results=15`;
                const res = await axios.get(searchUrl, { timeout: 15000 });
                const entries = res.data?.feed?.entry || [];

                if (!entries.length) {
                    await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                    return reply("❌ *සමාවෙන්න, Anime කිසිවක් හමුවූයේ නැත.*");
                }

                let listText = `*↳ ❝ [📺 𝗔𝗻𝗶𝗺𝗼𝘀𝘁 𝗟𝗞 𝗦𝗲𝗮𝗿𝗰𝗵 ] ¡! ❞*\n\n🔍 *සෙව්වේ:* ${query}\n📊 *Results:* ${entries.length}\n`;
                if (targetJid) listText += `🎯 *Target Send To:* \`${targetJid}\`\n\n`;
                else listText += `\n`;

                const buttons = [];
                entries.forEach((post, i) => {
                    const title = post.title.$t;
                    const contentHtml = post.content ? post.content.$t : "";
                    
                    // Thumbnail එක HTML එකෙන් හොයාගැනීම
                    let imgUrl = "";
                    const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch) imgUrl = imgMatch[1];
                    else if (post.media$thumbnail) imgUrl = post.media$thumbnail.url.replace('/s72-c/', '/s800/');

                    listText += `*${i + 1}.* ${title}\n\n`;

                    const id = storeData({
                        title: title, img: imgUrl, content: contentHtml, targetJid: targetJid
                    });

                    // Hide කරපු Button ID
                    buttons.push({
                        buttonId: `.ani --sel ${id}`,
                        buttonText: { displayText: `🎬 ${i + 1}. ${title.slice(0, 20)}` },
                        type: 1
                    });
                });

                listText += `> *📩 පහලින් Anime එක තෝරන්න*\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*`;

                await socket.sendMessage(sender, {
                    text: listText, footer: botName, buttons: buttons, headerType: 1
                }, { quoted: metaQuote });

                await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

            } catch (e) {
                console.error("[ANI] Search Error:", e.message);
                await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
                reply("❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*");
            }
        }
    }
};
